// app/api/extension/save-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

interface SaveVideoBody {
  capture: {
    platform: string;
    sourceUrl: string;
    videoUrl: string;
    videoHeaders?: Record<string, string>;
    recommendedStrategy: 'server' | 'browser';
    meta: {
      title: string;
      authorName?: string;
      authorUrl?: string;
      coverUrl?: string;
      durationSec?: number;
      publishedAt?: string;
    };
  };
  folder_id?: string;
  tag_ids?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: SaveVideoBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 1. 命中既有行（含软删除）→ UPDATE；否则 INSERT。
  //    避开 (user_id, source_url) 唯一约束撞车的 "note creation failed"。
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

  let noteId: string;
  if (existing) {
    const { error } = await service.from('notes').update(noteFields).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    noteId = existing.id;
  } else {
    const { data: inserted, error } = await service.from('notes').insert({
      user_id: user.id,
      source_url: body.capture.sourceUrl,
      ...noteFields,
    }).select('id').single();
    if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'note creation failed' }, { status: 500 });
    noteId = inserted.id;
  }

  // 1.5 标签关联：UPDATE 路径先清旧关系
  if (existing) {
    await service.from('note_tags').delete().eq('note_id', noteId);
  }
  if (body.tag_ids && body.tag_ids.length > 0) {
    const tagRows = body.tag_ids.map((tagId) => ({ note_id: noteId, tag_id: tagId }));
    await service.from('note_tags').insert(tagRows);
  }

  // 2. 创建新的 video_jobs（重抓总是开新 job；旧 job 留着不动，pipeline 自行收口）
  const { data: job, error: jobErr } = await service.from('video_jobs').insert({
    note_id: noteId,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    request_headers: body.capture.videoHeaders ?? null,
    download_strategy: body.capture.recommendedStrategy,
  }).select().single();
  if (jobErr || !job) {
    // 新建场景下回滚 note；命中既有行不删，避免把用户已有的 note 抹掉
    if (!existing) {
      await service.from('notes').delete().eq('id', noteId);
    }
    return NextResponse.json({ error: jobErr?.message ?? 'job creation failed' }, { status: 500 });
  }

  // 3. note 反向关联到新 job
  await service.from('notes').update({ video_job_id: job.id }).eq('id', noteId);

  return NextResponse.json({ noteId, jobId: job.id });
}
