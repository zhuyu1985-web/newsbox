// lib/workers/video-pipeline/step-analyze-audio.ts
import { getAudioAnalysisProvider } from '@/lib/ai-analysis';
import { markStep } from './db';
import type { VideoJob } from './types';

export async function runAnalyzeAudioStep(job: VideoJob): Promise<void> {
  // Preconditions: video must be downloaded and COS URL available
  if (job.download_status !== 'done' || !job.cos_url) return;

  // **必须等转码进入终态后再起 ASR**。
  // 原因：B 站 DASH 视频的原始 cos_url 是无音轨的 m4s，AudioMix 合流后才有音频。
  // 若与 transcode 并发跑（早期 bug），audio 提交时只有原始视频 → 听悟立刻
  // 抛 TSC.AudioSampleRate → audio_status=failed（终态）→ 永久卡死。
  // skipped 表示不需转码（原始已是 H.264 mp4 含音轨），可直接用 cos_url。
  if (job.transcode_status !== 'done' && job.transcode_status !== 'skipped') return;

  // Skip if already completed or permanently failed
  if (job.audio_status === 'done' || job.audio_status === 'failed') return;

  // P1 #6：无音频流直接 skipped，避免无音视频被听悟拒（TSC.AudioSampleRate）。
  // probe 阶段已采集 audioCodec；空字符串 = 文件里没有音频流（纯视频 m4s 等）。
  // 注意：DASH 双轨场景下 transcode 会通过 AudioMix 注入音频，此时 transcode_status='done'，
  // probe_data.audioCodec 仍记录的是"原始源"的状态(可能为空)。所以仅当 transcode_status='skipped'
  // 时才用 audioCodec 判断 —— done 意味着 AudioMix 已经把音频合进 transcoded_key。
  if (job.transcode_status === 'skipped' && job.audio_status === 'pending') {
    const probe = job.probe_data as { audioCodec?: string } | null;
    const audioCodec = (probe?.audioCodec ?? '').trim();
    if (!audioCodec) {
      await markStep(job.id, 'audio', 'skipped', {
        audio_error: 'no audio stream detected in source (probe.audioCodec empty)',
      });
      return;
    }
  }

  const provider = getAudioAnalysisProvider();

  // 优先用转码产物（含 DASH 合流后的音轨）；skipped 时回退原始 cos_url。
  const mediaUrl = job.transcoded_url ?? job.cos_url;

  // -----------------------------------------------------------------------
  // Phase 1: Submit to Tingwu (audio_status === 'pending')
  // -----------------------------------------------------------------------
  if (job.audio_status === 'pending') {
    try {
      const { taskId } = await provider.submit({
        mediaUrl,
        capabilities: ['transcript', 'chapters', 'summary', 'key_points', 'qa'],
        language: 'zh',
      });
      await markStep(job.id, 'audio', 'in_progress', { audio_task_id: taskId });
    } catch (err) {
      await markStep(job.id, 'audio', 'failed', { audio_error: String(err) }, { incrementRetry: true });
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
      }, { incrementRetry: true });
    }
    // status === 'processing' | 'pending' → stay quiet, next loop will poll again
  } catch (err) {
    await markStep(job.id, 'audio', 'failed', { audio_error: String(err) }, { incrementRetry: true });
  }
}
