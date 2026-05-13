// lib/workers/video-pipeline/step-analyze-visual.ts
import { getVisualAnalysisProvider } from '@/lib/ai-analysis';
import { markStep } from './db';
import type { VideoJob } from './types';

export async function runAnalyzeVisualStep(job: VideoJob, noteTitle?: string): Promise<void> {
  // Preconditions
  if (job.visual_status !== 'pending') return;
  if (job.frame_status !== 'done' || !job.frames) return;

  const provider = getVisualAnalysisProvider();

  // Provider not configured (e.g. VISUAL_ANALYSIS_PROVIDER=none) → skip gracefully
  // This does NOT block fully_ready (spec §7.2)
  if (!provider) {
    await markStep(job.id, 'visual', 'skipped');
    return;
  }

  await markStep(job.id, 'visual', 'in_progress');
  try {
    // Strip extra fields — only pass { timestamp, url } to the provider
    const frames = (job.frames as Array<{ timestamp: number; url: string }>)
      .map(f => ({ timestamp: f.timestamp, url: f.url }));

    const result = await provider.analyzeFrames({ frames, context: noteTitle });
    await markStep(job.id, 'visual', 'done', { visual_result: result });
  } catch (err) {
    // Visual failure must not propagate — mark failed and let reconcile continue
    await markStep(job.id, 'visual', 'failed', { visual_error: String(err) });
  }
}
