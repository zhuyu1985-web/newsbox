// lib/workers/video-pipeline/step-transcode.ts
//
// HEVC → H.264 transcode step.
//
// Preconditions:
//   - probe_status === 'done'  (so we know the codec)
//   - download_status === 'done'  (so cos_key/cos_url are set)
//
// Flow (two-phase, same pattern as step-analyze-audio):
//
//   Phase 1 (transcode_status === 'pending'):
//     - Read probe_data.videoCodec
//     - If already 'h264' → mark 'skipped', done
//     - Else → submit COS CI transcode job, mark 'in_progress' + store transcode_job_id
//
//   Phase 2 (transcode_status === 'in_progress' + transcode_job_id set):
//     - Poll COS CI for job state
//     - done  → mark 'done', write transcoded_key/transcoded_url,
//               AND update cos_key/cos_url + notes.media_url to transcoded version
//     - failed → mark 'failed', incrementRetry
//     - pending/running → silent, next tick will re-poll

import { getStorageProvider } from '@/lib/storage';
import { hasMediaProcessing } from '@/lib/storage/types';
import { markStep, incrementRetry } from './db';
import { createServiceClient } from '@/lib/supabase/server-service';
import type { VideoJob } from './types';

/** Derive the output COS key for a transcoded file from the source key */
function buildTranscodeOutputKey(sourceKey: string): string {
  // e.g.  "userId/videos/2026/05/file.mov"  →  "userId/videos/2026/05/file_h264.mp4"
  const dotIdx = sourceKey.lastIndexOf('.');
  const base = dotIdx >= 0 ? sourceKey.slice(0, dotIdx) : sourceKey;
  return `${base}_h264.mp4`;
}

export async function runTranscodeStep(job: VideoJob): Promise<void> {
  // Preconditions
  if (job.probe_status !== 'done' || job.download_status !== 'done') return;
  if (!job.cos_key || !job.cos_url) return;

  // Skip if step is already terminal
  if (
    job.transcode_status === 'done' ||
    job.transcode_status === 'skipped' ||
    job.transcode_status === 'failed'
  ) return;

  const storage = getStorageProvider();
  if (!hasMediaProcessing(storage)) {
    // No CI capability → skip silently (e.g. Supabase adapter in tests)
    await markStep(job.id, 'transcode', 'skipped');
    return;
  }

  // -------------------------------------------------------------------------
  // Phase 1: submit (transcode_status === 'pending')
  // -------------------------------------------------------------------------
  if (job.transcode_status === 'pending') {
    const probeData = job.probe_data as { videoCodec?: string } | null;
    const codec = (probeData?.videoCodec ?? '').toLowerCase();

    // 容器格式判定：.mp4 容器才可直接浏览器播放（即便内部 codec 是 H.264）
    // .mov / .mkv / .avi / .flv / .wmv 等容器在 Chrome/Firefox 上常因
    // Content-Type 或解析问题导致失败 → 必须 remux 到 mp4
    const sourceKey = job.cos_key.toLowerCase();
    const isMp4Container = sourceKey.endsWith('.mp4');
    const isH264 = codec === 'h264' || codec === 'avc' || codec === 'avc1';

    // 仅当「H.264 codec」且「已经是 mp4 容器」才跳过转码
    if (isH264 && isMp4Container) {
      await markStep(job.id, 'transcode', 'skipped');
      return;
    }

    // Submit transcode job
    try {
      const outputKey = buildTranscodeOutputKey(job.cos_key);
      const { jobId } = await storage.submitTranscode({
        sourceKey: job.cos_key,
        outputKey,
        targetCodec: 'h264',
      });
      await markStep(job.id, 'transcode', 'in_progress', {
        transcode_job_id: jobId,
        transcoded_key: outputKey,
      });
    } catch (err) {
      await markStep(job.id, 'transcode', 'failed');
      await incrementRetry(job.id);
    }
    return;
  }

  // -------------------------------------------------------------------------
  // Phase 2: poll (transcode_status === 'in_progress' + transcode_job_id set)
  // -------------------------------------------------------------------------
  if (!job.transcode_job_id) return;

  try {
    const result = await storage.getTranscodeStatus(job.transcode_job_id);

    if (result.status === 'done') {
      // transcoded_key was stored during submit; derive public URL from it
      const transcodedKey = job.transcoded_key!;
      const transcodedUrl = storage.getPublicUrl(transcodedKey);

      await markStep(job.id, 'transcode', 'done', {
        transcoded_url: transcodedUrl,
        // Switch pipeline to use transcoded version so downstream steps (audio, frames, visual)
        // pick up the H.264 file.
        cos_key: transcodedKey,
        cos_url: transcodedUrl,
      });

      // Also update notes.media_url so the player serves the H.264 version
      const supabase = createServiceClient();
      await supabase
        .from('notes')
        .update({ media_url: transcodedUrl })
        .eq('id', job.note_id);
    } else if (result.status === 'failed') {
      await markStep(job.id, 'transcode', 'failed');
      await incrementRetry(job.id);
    }
    // 'pending' | 'running' → stay quiet, next tick will poll again
  } catch (err) {
    await markStep(job.id, 'transcode', 'failed');
    await incrementRetry(job.id);
  }
}
