// lib/workers/index.ts
import { startScheduler } from './video-pipeline/scheduler';
import { runRecovery } from './video-pipeline/recovery';

export async function startVideoWorker(): Promise<void> {
  if (process.env.VIDEO_WORKER_ENABLED !== 'true') {
    console.log('[video-worker] disabled by env');
    return;
  }
  try {
    await runRecovery();
    startScheduler();
  } catch (err) {
    console.error('[video-worker] startup failed', err);
  }
}
