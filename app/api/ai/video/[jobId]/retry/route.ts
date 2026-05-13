import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const service = createServiceClient();
  // 把任何 failed 的 step 改为 pending
  const updates: Record<string, string> = {};
  const { data: job } = await service.from('video_jobs').select('*').eq('id', jobId).eq('user_id', user.id).single();
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  for (const col of ['download_status', 'probe_status', 'cover_status', 'frame_status', 'audio_status', 'visual_status']) {
    if (job[col] === 'failed') updates[col] = 'pending';
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no failed steps to retry' }, { status: 400 });
  }
  await service.from('video_jobs').update({ ...updates, retry_count: 0, next_retry_at: null }).eq('id', jobId);
  return NextResponse.json({ ok: true, retriedSteps: Object.keys(updates) });
}
