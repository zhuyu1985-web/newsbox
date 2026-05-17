import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

const STEP_COLS = [
  'download_status',
  'probe_status',
  'cover_status',
  'transcode_status',
  'frame_status',
  'audio_status',
  'visual_status',
] as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const service = createServiceClient();
  const { data: job } = await service
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 重置规则：
  //   - 任何 failed 的 step → pending（标准重试）
  //   - transcode 特殊处理：null / 空 / skipped 都重置为 pending
  //     · null / 空：旧数据 / 列刚加未被流水线扫描
  //     · skipped：判定逻辑可能已经更新（如 .mov 容器现在也要强制转码），重新评估
  const jobRow = job as unknown as Record<string, unknown>;
  const updates: Record<string, string> = {};
  for (const col of STEP_COLS) {
    const v = jobRow[col];
    if (v === 'failed') {
      updates[col] = 'pending';
    } else if (col === 'transcode_status' && (v == null || v === '' || v === 'skipped')) {
      updates[col] = 'pending';
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no failed or stuck steps to retry' }, { status: 400 });
  }

  await service
    .from('video_jobs')
    .update({ ...updates, retry_count: 0, next_retry_at: null })
    .eq('id', jobId);
  return NextResponse.json({ ok: true, retriedSteps: Object.keys(updates) });
}
