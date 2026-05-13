// lib/workers/video-pipeline/step-extract-frames.ts
import { getStorageProvider, hasMediaProcessing } from '@/lib/storage';
import { markStep } from './db';
import type { VideoJob } from './types';

export async function runExtractFramesStep(job: VideoJob): Promise<void> {
  // Preconditions
  if (job.frame_status !== 'pending') return;
  if (job.download_status !== 'done' || !job.cos_key) return;
  if (job.probe_status !== 'done') return; // need duration for equal-interval fallback

  const provider = getStorageProvider();

  // Provider has no CI MediaProcessingCapability → skip
  if (!hasMediaProcessing(provider)) {
    await markStep(job.id, 'frame', 'skipped');
    return;
  }

  await markStep(job.id, 'frame', 'in_progress');
  try {
    const timestamps = computeFrameTimestamps(job);
    const prefix = `${job.user_id}/frames/${job.id}/f`;
    const frames = await provider.extractFrames({
      sourceKey: job.cos_key,
      timestamps,
      outputKeyPrefix: prefix,
    });
    await markStep(job.id, 'frame', 'done', { frames });
  } catch {
    await markStep(job.id, 'frame', 'failed');
  }
}

/**
 * Compute frame timestamps to extract.
 *
 * Priority:
 * 1. If audio_result.chapters is available → take midpoint of each chapter (max 20)
 * 2. Otherwise → equal intervals every 60 seconds (max 20)
 *
 * Edge case: duration <= 0 → return [0]
 */
export function computeFrameTimestamps(job: VideoJob): number[] {
  const chapters = job.audio_result?.chapters as Array<{ start: number; end: number }> | undefined;
  if (chapters && chapters.length > 0) {
    return chapters
      .map(c => Math.round((c.start + c.end) / 2))
      .slice(0, 20);
  }

  // Fallback: equal intervals, max 20 frames
  const dur: number = job.probe_data?.durationSec ?? 0;
  if (dur <= 0) return [0];
  const count = Math.min(20, Math.max(1, Math.ceil(dur / 60)));
  return Array.from({ length: count }, (_, i) => Math.round(i * dur / count));
}
