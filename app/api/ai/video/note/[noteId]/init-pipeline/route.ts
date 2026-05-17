// 补建视频流水线记录
//
// 用途：视频文件已经在 COS 上但 notes.video_job_id 为空（历史数据 / 上传链路断裂），
// 调用此接口为该 note 创建 video_jobs 记录，跳过 download 步骤直接从 probe 开始。
// 之后 worker 会自动 probe → 必要时 transcode → 用 H.264 版本回填 notes.media_url。

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

function extractCosKey(url: string): string | null {
  try {
    const u = new URL(url);
    // 仅处理腾讯云 COS URL：pathname 以 "/" 开头，去掉
    if (!u.hostname.endsWith('.myqcloud.com') && !u.hostname.endsWith('.tencentcos.cn')) {
      return null;
    }
    return u.pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ noteId: string }> },
) {
  const { noteId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const service = createServiceClient();

  const { data: note, error: noteErr } = await service
    .from('notes')
    .select('id, user_id, content_type, media_url, source_url, video_job_id')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single();

  if (noteErr || !note) {
    return NextResponse.json({ error: 'note not found' }, { status: 404 });
  }
  if (note.content_type !== 'video') {
    return NextResponse.json({ error: 'not a video note' }, { status: 400 });
  }
  if (!note.media_url) {
    return NextResponse.json({ error: 'note has no media_url' }, { status: 400 });
  }

  const cosKey = extractCosKey(note.media_url);
  if (!cosKey) {
    return NextResponse.json(
      { error: 'media_url is not a COS URL — cannot init pipeline' },
      { status: 400 },
    );
  }

  // 已有 video_job：检查是否需要重置 transcode_status
  if (note.video_job_id) {
    const { data: existing } = await service
      .from('video_jobs')
      .select('id, transcode_status, probe_status, cos_key, cos_url')
      .eq('id', note.video_job_id)
      .single();

    if (existing) {
      const updates: Record<string, string> = {};
      if (!existing.cos_key) updates.cos_key = cosKey;
      if (!existing.cos_url) updates.cos_url = note.media_url;
      if (existing.probe_status == null || existing.probe_status === 'failed') {
        updates.probe_status = 'pending';
      }
      if (existing.transcode_status == null || existing.transcode_status === 'failed') {
        updates.transcode_status = 'pending';
      }
      if (Object.keys(updates).length > 0) {
        await service
          .from('video_jobs')
          .update({ ...updates, download_status: 'done', retry_count: 0, next_retry_at: null })
          .eq('id', existing.id);
      }
      return NextResponse.json({ ok: true, mode: 'reset', jobId: existing.id });
    }
    // video_job_id 指向不存在的行 → 走下方创建逻辑
  }

  // 创建新 video_job：download 已完成（文件已在 COS），probe / transcode 从 pending 开始
  const { data: job, error: jobErr } = await service
    .from('video_jobs')
    .insert({
      note_id: note.id,
      user_id: user.id,
      source_url: note.source_url ?? note.media_url,
      platform: 'manual',
      source_video_url: note.media_url,
      download_strategy: 'browser',
      download_status: 'done',
      cos_key: cosKey,
      cos_url: note.media_url,
      probe_status: 'pending',
      transcode_status: 'pending',
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: jobErr?.message ?? 'failed to create video_job' },
      { status: 500 },
    );
  }

  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  return NextResponse.json({ ok: true, mode: 'created', jobId: job.id });
}
