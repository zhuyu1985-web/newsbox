import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('video_jobs')
    .select('id, download_status, probe_status, cover_status, frame_status, audio_status, visual_status, cover_url, download_error, audio_error, visual_error, retry_count, note_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    jobId: data.id,
    noteId: data.note_id,
    steps: {
      download: data.download_status,
      probe: data.probe_status,
      cover: data.cover_status,
      frame: data.frame_status,
      audio: data.audio_status,
      visual: data.visual_status,
    },
    coverUrl: data.cover_url,
    errors: {
      download: data.download_error,
      audio: data.audio_error,
      visual: data.visual_error,
    },
    retryCount: data.retry_count,
  });
}
