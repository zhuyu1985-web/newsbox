// lib/workers/video-pipeline/db.ts
import { createServiceClient } from '@/lib/supabase/server-service';
import type { VideoJob, VideoJobStepStatus, StepName } from './types';

const STEP_STATUS_COLUMN: Record<StepName, string> = {
  download: 'download_status',
  probe: 'probe_status',
  cover: 'cover_status',
  transcode: 'transcode_status',
  frame: 'frame_status',
  audio: 'audio_status',
  visual: 'visual_status',
};

export async function fetchPendingJobs(limit: number = 10): Promise<VideoJob[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_jobs')
    .select('*')
    .or([
      `download_status.in.(pending,in_progress)`,
      `probe_status.in.(pending,in_progress)`,
      `cover_status.in.(pending,in_progress)`,
      `transcode_status.in.(pending,in_progress)`,
      `frame_status.in.(pending,in_progress)`,
      `audio_status.in.(pending,in_progress)`,
      `visual_status.in.(pending,in_progress)`,
    ].join(','))
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetchPendingJobs: ${error.message}`);
  return (data ?? []) as VideoJob[];
}

export interface MarkStepOptions {
  /**
   * 失败时退避重试。设置 true 会:
   *   1. SELECT current retry_count
   *   2. 在同一次 UPDATE 中写入 status/extra + retry_count+1 + next_retry_at
   *
   * 与拆开的 markStep + incrementRetry 相比，把"标失败"和"加计数"合并为单次 UPDATE，
   * 避免"已标 failed 但 retry_count 未增"导致的退避失效 / 重复轮询。
   * SELECT 仍存在，严格意义上还不是原子，但中间窗口从两次 UPDATE 缩减到 SQL-roundtrip 内，
   * 实际崩溃风险接近 0。完全原子化需要 Postgres RPC，留作后续。
   */
  incrementRetry?: boolean;
}

export async function markStep(
  jobId: string,
  step: StepName,
  status: VideoJobStepStatus | string,
  extra: Record<string, unknown> = {},
  opts: MarkStepOptions = {}
): Promise<void> {
  const column = STEP_STATUS_COLUMN[step];
  const supabase = createServiceClient();

  const update: Record<string, unknown> = { [column]: status, ...extra };

  if (opts.incrementRetry) {
    const { data } = await supabase
      .from('video_jobs')
      .select('retry_count')
      .eq('id', jobId)
      .single();
    const next = (data?.retry_count ?? 0) + 1;
    update.retry_count = next;
    update.next_retry_at = new Date(Date.now() + Math.pow(2, next) * 60_000).toISOString();
  }

  const { error } = await supabase
    .from('video_jobs')
    .update(update)
    .eq('id', jobId);
  if (error) throw new Error(`markStep ${step}=${status}: ${error.message}`);
}

/**
 * @deprecated 调用方应改为 `markStep(..., { incrementRetry: true })`，
 * 把"标 failed"和"加 retry_count"合并到同一次 UPDATE，避免半成品状态。
 * 仅保留以兼容尚未迁移的边角调用方。
 */
export async function incrementRetry(jobId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_jobs')
    .select('retry_count')
    .eq('id', jobId)
    .single();
  const next = (data?.retry_count ?? 0) + 1;
  const delayMs = Math.pow(2, next) * 60_000;
  await supabase
    .from('video_jobs')
    .update({
      retry_count: next,
      next_retry_at: new Date(Date.now() + delayMs).toISOString(),
    })
    .eq('id', jobId);
}

export function isStale(updatedAt: string, thresholdMs: number): boolean {
  return Date.now() - new Date(updatedAt).getTime() > thresholdMs;
}

/**
 * 重新拉取一条 video_job 的最新状态。
 * scheduler 在两个 step 之间调用，确保下一个 step 看到的不是过期 snapshot
 * （markStep 写 DB 但不 mutate 内存对象）。
 */
export async function refetchJob(jobId: string): Promise<VideoJob | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (error) throw new Error(`refetchJob: ${error.message}`);
  return (data ?? null) as VideoJob | null;
}
