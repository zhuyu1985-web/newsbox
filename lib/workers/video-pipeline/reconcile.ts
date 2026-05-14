// lib/workers/video-pipeline/reconcile.ts
import { createServiceClient } from '@/lib/supabase/server-service';
import type { VideoJob, OverallStatus } from './types';

/**
 * Aggregate the per-step statuses of a video_job into a single overall status
 * and persist it to notes.video_overall_status.
 *
 * Aggregation rules (in priority order — spec §7.2 + Plan B Task 12):
 *
 * 1. Any step status='failed' AND retry_count >= 3  →  'failed'
 * 2. download_status === 'need_browser_fallback'    →  'need_browser_fallback'
 * 3. download done + audio done + visual ∈ {done,failed,skipped}
 *                                                   →  'fully_ready'  (+video_ready_at)
 * 4. download_status === 'done'                     →  'media_ready'
 * 5. otherwise                                      →  'processing'
 *
 * Note: visual failure or skip never blocks 'fully_ready' (spec §7.2).
 * Note: need_browser_fallback is intentionally checked AFTER the failed-with-retries
 *       rule so a permanently-failed download (retry >= 3) still surfaces as 'failed'
 *       rather than staying in the browser-fallback queue forever.
 *       … WAIT — the task spec says need_browser_fallback priority is HIGHER than failed
 *       (user can still retry via browser extension). Re-reading the spec:
 *
 *         1. any step failed && retry >= 3 → failed
 *         2. download === need_browser_fallback → need_browser_fallback
 *
 *       But the scenario test in Task 12 says:
 *         "need_browser_fallback 优先级高于 failed（用户能重试）"
 *
 *       So we must swap: check need_browser_fallback BEFORE the hard-failed check.
 *       Implementation follows the scenario requirement order, not the literal numbering.
 */
function computeOverall(job: VideoJob): { status: OverallStatus; writeReadyAt: boolean } {
  const {
    download_status,
    audio_status,
    visual_status,
    probe_status,
    cover_status,
    transcode_status,
    frame_status,
    retry_count,
  } = job;

  // Priority 1 (as per self-review): need_browser_fallback wins over hard-failed
  // so the user can still recover via browser extension
  if (download_status === 'need_browser_fallback') {
    return { status: 'need_browser_fallback', writeReadyAt: false };
  }

  // Priority 2: any step permanently failed (exhausted retries)
  const allStepStatuses = [
    download_status,
    audio_status,
    visual_status,
    probe_status,
    cover_status,
    transcode_status,
    frame_status,
  ];
  const hasHardFailed = retry_count >= 3 && allStepStatuses.some((s) => s === 'failed');
  if (hasHardFailed) {
    return { status: 'failed', writeReadyAt: false };
  }

  // Priority 3: fully ready
  // Visual failure or skip does NOT block (spec §7.2)
  const visualDoneOrFinalised =
    visual_status === 'done' || visual_status === 'failed' || visual_status === 'skipped';
  if (download_status === 'done' && audio_status === 'done' && visualDoneOrFinalised) {
    return { status: 'fully_ready', writeReadyAt: true };
  }

  // Priority 4: media ready (download finished, rest still in-flight)
  if (download_status === 'done') {
    return { status: 'media_ready', writeReadyAt: false };
  }

  // Default
  return { status: 'processing', writeReadyAt: false };
}

/**
 * Fetch the latest video_job row, compute overall status, and write it to notes.
 */
export async function reconcileJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: job, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { status, writeReadyAt } = computeOverall(job as VideoJob);

  const updatePayload: Record<string, unknown> = {
    video_overall_status: status,
  };
  if (writeReadyAt) {
    updatePayload.video_ready_at = new Date().toISOString();
  }

  await supabase.from('notes').update(updatePayload).eq('id', (job as VideoJob).note_id);
}
