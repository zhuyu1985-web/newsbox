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
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: SaveVideoBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 1. 创建 notes 记录
  const { data: note, error: noteErr } = await service.from('notes').insert({
    user_id: user.id,
    title: body.capture.meta.title,
    source_url: body.capture.sourceUrl,
    content_type: 'video',
    video_overall_status: 'processing',
    media_duration: body.capture.meta.durationSec ?? null,
    published_at: body.capture.meta.publishedAt ?? null,
    captured_at: new Date().toISOString(),
  }).select().single();
  if (noteErr || !note) return NextResponse.json({ error: noteErr?.message ?? 'note creation failed' }, { status: 500 });

  // 2. 创建 video_jobs 记录
  const { data: job, error: jobErr } = await service.from('video_jobs').insert({
    note_id: note.id,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    request_headers: body.capture.videoHeaders ?? null,
    download_strategy: body.capture.recommendedStrategy,
  }).select().single();
  if (jobErr || !job) {
    // 回滚 note
    await service.from('notes').delete().eq('id', note.id);
    return NextResponse.json({ error: jobErr?.message ?? 'job creation failed' }, { status: 500 });
  }

  // 3. note 反向关联 job
  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  return NextResponse.json({ noteId: note.id, jobId: job.id });
}
