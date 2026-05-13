// lib/workers/video-pipeline/step-analyze-audio.ts
import { getAudioAnalysisProvider } from '@/lib/ai-analysis';
import { markStep, incrementRetry } from './db';
import type { VideoJob } from './types';

export async function runAnalyzeAudioStep(job: VideoJob): Promise<void> {
  // Preconditions: video must be downloaded and COS URL available
  if (job.download_status !== 'done' || !job.cos_url) return;
  // Skip if already completed or permanently failed
  if (job.audio_status === 'done' || job.audio_status === 'failed') return;

  const provider = getAudioAnalysisProvider();

  // -----------------------------------------------------------------------
  // Phase 1: Submit to Tingwu (audio_status === 'pending')
  // -----------------------------------------------------------------------
  if (job.audio_status === 'pending') {
    try {
      const { taskId } = await provider.submit({
        mediaUrl: job.cos_url,
        capabilities: ['transcript', 'chapters', 'summary', 'key_points', 'qa'],
        language: 'zh',
      });
      await markStep(job.id, 'audio', 'in_progress', { audio_task_id: taskId });
    } catch (err) {
      await markStep(job.id, 'audio', 'failed', { audio_error: String(err) });
      await incrementRetry(job.id);
    }
    return;
  }

  // -----------------------------------------------------------------------
  // Phase 2: Poll Tingwu (audio_status === 'in_progress' + audio_task_id set)
  // -----------------------------------------------------------------------
  if (!job.audio_task_id) return;

  try {
    const r = await provider.poll(job.audio_task_id);
    if (r.status === 'done' && r.result) {
      await markStep(job.id, 'audio', 'done', { audio_result: r.result });
    } else if (r.status === 'failed') {
      await markStep(job.id, 'audio', 'failed', {
        audio_error: r.error ? `${r.error.code}: ${r.error.message}` : 'unknown',
      });
      await incrementRetry(job.id);
    }
    // status === 'processing' | 'pending' → stay quiet, next loop will poll again
  } catch (err) {
    await markStep(job.id, 'audio', 'failed', { audio_error: String(err) });
    await incrementRetry(job.id);
  }
}
