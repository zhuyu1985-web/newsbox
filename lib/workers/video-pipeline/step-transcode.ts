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
import { markStep } from './db';
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

    // DASH 分轨场景：音频独立上传到 audio_cos_key，必须经 AudioMix 合流，
    // 即使视频已是 H.264 + mp4 容器也不能跳过——否则输出仍然是无声视频。
    const needsAudioMix = !!job.audio_cos_key;

    // 仅当「H.264 codec」+「mp4 容器」+「不需要 AudioMix」才跳过转码
    if (isH264 && isMp4Container && !needsAudioMix) {
      await markStep(job.id, 'transcode', 'skipped');
      return;
    }

    // Submit transcode job（双轨场景透传 audio_cos_key 让 CI 做 AudioMix）
    try {
      const outputKey = buildTranscodeOutputKey(job.cos_key);
      const { jobId } = await storage.submitTranscode({
        sourceKey: job.cos_key,
        outputKey,
        targetCodec: 'h264',
        audioMixSourceKey: job.audio_cos_key ?? undefined,
      });
      await markStep(job.id, 'transcode', 'in_progress', {
        transcode_job_id: jobId,
        transcoded_key: outputKey,
      });
    } catch (err) {
      await markStep(job.id, 'transcode', 'failed', {
        transcode_error: err instanceof Error ? err.message : String(err),
      }, { incrementRetry: true });
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
      // P0 #3 守卫：Phase 1 submit 时就该写入 transcoded_key；如果到 done 阶段还是 null，
      // 说明 DB 被外部改过或 Phase 1 / Phase 2 跨进程状态漂移。继续往下会把空 key 当成
      // 产物路径写入 transcoded_url，导致下游 step 读到空 URL 永久卡死 / fallback 到无
      // 音轨的原始 cos_key。这里强制 fail 让重试走 Phase 1 重新 submit。
      if (!job.transcoded_key) {
        await markStep(job.id, 'transcode', 'failed', {
          transcode_job_id: null,
          transcode_error: 'transcoded_key missing at done phase (state corruption)',
        }, { incrementRetry: true });
        return;
      }
      const transcodedKey = job.transcoded_key;

      // 防腐：COS CI 偶发"返回 Success 但产物缺失"。HEAD 校验产物真实可访问，
      // 否则把 status 写成 failed，避免后续步骤拉空 cos_url 永远卡死。
      const exists = await storage.exists(transcodedKey).catch(() => false);
      if (!exists) {
        await markStep(job.id, 'transcode', 'failed', {
          // 清掉 job_id，下次重试走 Phase 1 重新 submit 而不是 poll 假死的旧 job
          transcode_job_id: null,
          transcoded_key: null,
          transcode_error: 'CI returned done but HEAD check failed (artifact missing)',
        }, { incrementRetry: true });
        return;
      }

      const transcodedUrl = storage.getPublicUrl(transcodedKey);
      // 关键改动：不再覆盖 cos_key / cos_url。
      // 原因：若 CI 假成功（HEAD 漏检/事后被删），覆盖后原始可用文件被丢，整条 job 自损。
      // 下游 step-audio / step-extract-frames / player 都改成优先用 transcoded_*，
      // 找不到再回退 cos_*。这样既能利用转码产物，又保留原始救火路径。
      await markStep(job.id, 'transcode', 'done', {
        transcoded_url: transcodedUrl,
      });

      // 同步 notes.media_url 指到转码产物（player 仍走 transcoded > cos > media 优先级）
      const supabase = createServiceClient();
      await supabase
        .from('notes')
        .update({ media_url: transcodedUrl })
        .eq('id', job.note_id);
    } else if (result.status === 'failed') {
      await markStep(job.id, 'transcode', 'failed', {
        transcode_job_id: null,
        transcoded_key: null,
        transcode_error: 'CI reported failed',
      }, { incrementRetry: true });
    }
    // 'pending' | 'running' → stay quiet, next tick will poll again
  } catch (err) {
    await markStep(job.id, 'transcode', 'failed', {
      transcode_job_id: null,
      transcoded_key: null,
      transcode_error: err instanceof Error ? err.message : String(err),
    }, { incrementRetry: true });
  }
}
