// lib/workers/video-pipeline/recovery.ts
import { createServiceClient } from '@/lib/supabase/server-service';

/**
 * 启动时把 in_progress 但卡太久的 step 重置为 pending（防止僵死）。
 *
 * ⚠️ audio 的 in_progress 通常表示已提交给听悟并在等待轮询，
 *    重置为 pending 会丢失 task_id 让任务重新提交（浪费配额）。
 *    但 24h 仍卡 in_progress 的 audio 几乎可以确定是 Tingwu task 已失效
 *    / 已过期(正常处理时间 < 2h)。这种情况 poll 永远拿不到 done 也拿不
 *    到 failed，scheduler 会无限轮询。所以加 24h 兜底:标 failed,保留
 *    task_id 让用户手动重试时仍可参考。
 */
export async function runRecovery(): Promise<void> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();

  // Reset download_status first
  await supabase
    .from('video_jobs')
    .update({ download_status: 'pending' })
    .eq('download_status', 'in_progress')
    .lt('updated_at', cutoff);

  // Reset the other step statuses (probe, cover, frame, visual)
  // audio is intentionally excluded above — Tingwu tasks continue polling via audio_task_id
  for (const col of ['probe_status', 'cover_status', 'frame_status', 'visual_status'] as const) {
    await supabase
      .from('video_jobs')
      .update({ [col]: 'pending' })
      .eq(col, 'in_progress')
      .lt('updated_at', cutoff);
  }

  // P1 #4：audio 卡死兜底 —— 24h 仍 in_progress = Tingwu task 已失效，标 failed 让 scheduler 退出轮询
  const audioStuckCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { error: audioStuckErr } = await supabase
    .from('video_jobs')
    .update({
      audio_status: 'failed',
      audio_error: 'recovery: stuck in_progress > 24h, Tingwu task likely expired',
    })
    .eq('audio_status', 'in_progress')
    .lt('updated_at', audioStuckCutoff);
  if (audioStuckErr) console.error('[video-worker] recovery audio-stuck failed:', audioStuckErr.message);

  console.log('[video-worker] recovery completed');
}
