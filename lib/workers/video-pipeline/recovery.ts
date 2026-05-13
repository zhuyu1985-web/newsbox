// lib/workers/video-pipeline/recovery.ts
import { createServiceClient } from '@/lib/supabase/server-service';

/**
 * 启动时把 in_progress 但卡太久的 step 重置为 pending（防止僵死）。
 *
 * ⚠️ audio 的 in_progress 通常表示已提交给听悟并在等待轮询，
 *    重置会丢失 task_id，所以不重置 audio_status。
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
  // audio is intentionally excluded — Tingwu tasks continue polling via audio_task_id
  for (const col of ['probe_status', 'cover_status', 'frame_status', 'visual_status'] as const) {
    await supabase
      .from('video_jobs')
      .update({ [col]: 'pending' })
      .eq(col, 'in_progress')
      .lt('updated_at', cutoff);
  }

  console.log('[video-worker] recovery completed');
}
