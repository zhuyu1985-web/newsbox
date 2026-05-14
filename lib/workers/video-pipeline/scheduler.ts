// lib/workers/video-pipeline/scheduler.ts
import { fetchPendingJobs, refetchJob } from './db';
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

async function processJob(initial: VideoJob): Promise<void> {
  // 每个 step 之间 refetch，避免上一个 step 通过 markStep 改了 DB 但内存对象仍是过期 snapshot，
  // 导致下一个 step 的前置条件检查（例如 download_status === 'done'）误判为未就绪。
  const steps: Array<{ name: string; run: (j: VideoJob) => Promise<void> }> = [
    { name: 'download', run: runDownloadStep },
    { name: 'probe+cover', run: runProbeAndCoverStep },
    { name: 'audio', run: runAnalyzeAudioStep },
    { name: 'frame', run: runExtractFramesStep },
    { name: 'visual', run: runAnalyzeVisualStep },
  ];

  let job: VideoJob | null = initial;
  for (const step of steps) {
    if (!job) break;
    try {
      await step.run(job);
    } catch (err) {
      // Error isolation: single step failure does not abort remaining steps
      console.error(`[video-worker] step ${step.name} error (job=${job.id})`, err);
    }
    try {
      job = await refetchJob(initial.id);
    } catch (err) {
      console.error(`[video-worker] refetch after ${step.name} error (job=${initial.id})`, err);
      job = null;
    }
  }

  try {
    await reconcileJob(initial.id);
  } catch (err) {
    console.error(`[video-worker] reconcile error (job=${initial.id})`, err);
  }
}
