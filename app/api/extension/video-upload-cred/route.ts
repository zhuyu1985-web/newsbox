import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider, buildStorageKey } from '@/lib/storage';

interface CapturePayload {
  platform: string;
  sourceUrl: string;
  videoUrl: string;
  videoHeaders?: Record<string, string>;
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
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'capture.videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 创建 notes + job（同 save-video 但 download_strategy='browser', download_status='in_progress'）
  const { data: note } = await service.from('notes').insert({
    user_id: user.id,
    title: body.capture.meta.title,
    source_url: body.capture.sourceUrl,
    content_type: 'video',
    video_overall_status: 'processing',
    captured_at: new Date().toISOString(),
  }).select().single();
  if (!note) return NextResponse.json({ error: 'note creation failed' }, { status: 500 });

  const key = buildStorageKey({ userId: user.id, kind: 'videos', ext: body.ext });
  const { data: job } = await service.from('video_jobs').insert({
    note_id: note.id,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    download_strategy: 'browser',
    download_status: 'in_progress',
    cos_key: key,
  }).select().single();
  if (!job) {
    await service.from('notes').delete().eq('id', note.id);
    return NextResponse.json({ error: 'job creation failed' }, { status: 500 });
  }
  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  const cred = await getStorageProvider().createUploadCredential({
    key,
    contentType: body.contentType,
    expiresIn: 3600,
  });

  return NextResponse.json({
    jobId: job.id,
    noteId: note.id,
    cosKey: key,
    uploadUrl: cred.uploadUrl,
    method: cred.method,
    headers: cred.headers,
    publicUrl: cred.publicUrl,
    expiresAt: cred.expiresAt,
  });
}
