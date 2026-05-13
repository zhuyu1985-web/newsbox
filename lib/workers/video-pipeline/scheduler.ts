// lib/workers/video-pipeline/scheduler.ts
import { fetchPendingJobs } from './db';
import { runDownloadStep } from './step-download';
import { runProbeAndCoverStep } from './step-probe-and-cover';
import { runExtractFramesStep } from './step-extract-frames';
import { runAnalyzeAudioStep } from './step-analyze-audio';
import { runAnalyzeVisualStep } from './step-analyze-visual';
import { reconcileJob } from './reconcile';
import type { VideoJob } from './types';

let timer: NodeJS.Timeout | null = null;
let running = false;

const INTERVAL_MS = Number(process.env.VIDEO_WORKER_INTERVAL_MS || 10_000);
const BATCH_SIZE = Number(process.env.VIDEO_WORKER_BATCH_SIZE || 5);

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  console.log(`[video-worker] scheduler started (interval=${INTERVAL_MS}ms)`);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function tick(): Promise<void> {
  if (running) return; // 上一轮还没跑完，跳过本轮
  running = true;
  try {
    const jobs = await fetchPendingJobs(BATCH_SIZE);
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[video-worker] tick error', err);
  } finally {
    running = false;
  }
}

async function processJob(job: VideoJob): Promise<void> {
  try {
    // 顺序：download → probe & cover → audio → frame → visual → reconcile
    await runDownloadStep(job);
    await runProbeAndCoverStep(job);
    await runAnalyzeAudioStep(job);
    await runExtractFramesStep(job);
    await runAnalyzeVisualStep(job);
    await reconcileJob(job.id);
  } catch (err) {
    // Error isolation: single job failure does not abort remaining jobs
    console.error(`[video-worker] processJob error (job=${job.id})`, err);
  }
}
