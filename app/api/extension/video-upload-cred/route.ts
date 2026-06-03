import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider, buildStorageKey } from '@/lib/storage';
import { resolveContentType } from '@/lib/storage/mime';

interface CapturePayload {
  platform: string;
  sourceUrl: string;
  videoUrl: string;
  videoHeaders?: Record<string, string>;
  audioUrl?: string;
  audioHeaders?: Record<string, string>;
  meta: {
    title: string;
    authorName?: string;
    authorUrl?: string;
    coverUrl?: string;
    durationSec?: number;
    publishedAt?: string;
  };
}

interface Body {
  capture: CapturePayload;
  ext: string;
  contentType: string;
  /** B 站 DASH 音频流的扩展名（m4s/m4a），仅当 capture.audioUrl 存在时使用 */
  audioExt?: string;
  audioContentType?: string;
  folder_id?: string;
  tag_ids?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'capture.videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 查既有行：(user_id, source_url) 唯一约束意味着同一个 URL 重保存会撞 insert。
  // 命中既有行（包含软删除残留）→ UPDATE 并清掉 deleted_at；否则 INSERT 新行。
  const noteFields = {
    title: body.capture.meta.title,
    content_type: 'video' as const,
    video_overall_status: 'processing',
    media_duration: body.capture.meta.durationSec ?? null,
    published_at: body.capture.meta.publishedAt ?? null,
    cover_image_url: body.capture.meta.coverUrl ?? null,
    author: body.capture.meta.authorName ?? null,
    captured_at: new Date().toISOString(),
    folder_id: body.folder_id ?? null,
    deleted_at: null as string | null,
  };

  const { data: existing } = await service
    .from('notes')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_url', body.capture.sourceUrl)
    .maybeSingle();

  let note: { id: string } | null = null;
  if (existing) {
    const { data, error } = await service
      .from('notes')
      .update(noteFields)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    note = data;
  } else {
    const { data, error } = await service
      .from('notes')
      .insert({
        user_id: user.id,
        source_url: body.capture.sourceUrl,
        ...noteFields,
      })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'note creation failed' }, { status: 500 });
    note = data;
  }
  if (!note) return NextResponse.json({ error: 'note creation failed' }, { status: 500 });

  // 标签：UPDATE 路径要先清掉旧的避免脏数据；INSERT 路径不必但加了也无害
  if (existing) {
    await service.from('note_tags').delete().eq('note_id', note.id);
  }
  if (body.tag_ids && body.tag_ids.length > 0) {
    const tagRows = body.tag_ids.map((tagId) => ({ note_id: note!.id, tag_id: tagId }));
    await service.from('note_tags').insert(tagRows);
  }

  const key = buildStorageKey({ userId: user.id, kind: 'videos', ext: body.ext });
  // DASH 分轨：同时签发 audio key（音频独立 COS 对象，转码时由 CI <AudioMix> 合流）
  const audioKey = body.capture.audioUrl
    ? buildStorageKey({ userId: user.id, kind: 'videos', ext: body.audioExt || 'm4s' })
    : null;

  const { data: job, error: jobErr } = await service.from('video_jobs').insert({
    note_id: note.id,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    source_audio_url: body.capture.audioUrl ?? null,
    download_strategy: 'browser',
    download_status: 'in_progress',
    cos_key: key,
    audio_cos_key: audioKey,
  }).select().single();
  if (jobErr || !job) {
    // 命中既有行不删，避免把用户已有笔记抹掉；只有新建场景才回滚
    if (!existing) {
      await service.from('notes').delete().eq('id', note.id);
    }
    console.error('[video-upload-cred] job insert failed', {
      message: jobErr?.message,
      code: (jobErr as { code?: string } | null)?.code,
      details: (jobErr as { details?: string } | null)?.details,
      hint: (jobErr as { hint?: string } | null)?.hint,
    });
    return NextResponse.json(
      { error: jobErr?.message ?? 'job creation failed' },
      { status: 500 },
    );
  }
  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  // 扩展传过来的 contentType 在某些情况下会是空 / octet-stream（比如从剪贴板取的视频）
  // 服务端按扩展名兜底，确保最终签发到 COS 的 PUT 携带正确 Content-Type
  const safeContentType = resolveContentType(body.contentType, `x.${body.ext}`);
  const storage = getStorageProvider();

  const cred = await storage.createUploadCredential({
    key,
    contentType: safeContentType,
    expiresIn: 3600,
  });

  // 双轨：音频凭据并行签发，扩展拿到后两路 PUT 并行上传
  let audioCred:
    | {
        uploadUrl: string;
        method: string;
        headers?: Record<string, string>;
        publicUrl: string;
        expiresAt: number;
      }
    | null = null;
  if (audioKey) {
    const safeAudioCt = resolveContentType(body.audioContentType || '', `x.${body.audioExt || 'm4s'}`);
    audioCred = await storage.createUploadCredential({
      key: audioKey,
      contentType: safeAudioCt,
      expiresIn: 3600,
    });
  }

  return NextResponse.json({
    jobId: job.id,
    noteId: note.id,
    cosKey: key,
    uploadUrl: cred.uploadUrl,
    method: cred.method,
    headers: cred.headers,
    publicUrl: cred.publicUrl,
    expiresAt: cred.expiresAt,
    // 双轨字段（无 audio 时为 null，扩展按 null 判跳过音频上传）
    audio: audioCred && audioKey
      ? {
          cosKey: audioKey,
          uploadUrl: audioCred.uploadUrl,
          method: audioCred.method,
          headers: audioCred.headers,
          publicUrl: audioCred.publicUrl,
          expiresAt: audioCred.expiresAt,
        }
      : null,
  });
}
