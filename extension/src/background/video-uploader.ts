import { api } from '../shared/api';
import type { VideoCapture } from '../content/video-extractors/base';
import { withRefererRule } from './dnr-rules';

interface UploadCredFields {
  uploadUrl: string;
  method: string;
  headers?: Record<string, string>;
  publicUrl: string;
  expiresAt: number;
}
interface UploadCred extends UploadCredFields {
  jobId: string;
  cosKey: string;
  /** DASH 分轨：音频 cred；null 表示无需独立上传音频 */
  audio?: (UploadCredFields & { cosKey: string }) | null;
}

/** capture.videoHeaders 里大小写不一定，统一抓 Referer */
function pickReferer(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === 'referer') return headers[k];
  }
  return undefined;
}

export async function uploadVideoBytes(capture: VideoCapture, cred: UploadCred): Promise<void> {
  // alarms 权限缺失时 create 会 throw，必须保护好不然整个上传直接没了
  try {
    chrome.alarms?.create?.('video-upload-heartbeat', { periodInMinutes: 0.5 });
  } catch (err) {
    console.warn('[video-uploader] alarm create failed', err);
  }

  try {
    // B 站等防盗链 CDN：Referer 是 fetch 的 forbidden header，必须走 DNR 注入。
    // 否则浏览器静默剥离 Referer → CDN 返回 403。
    const videoReferer = pickReferer(capture.videoHeaders);
    const audioReferer = pickReferer(capture.audioHeaders) ?? videoReferer;
    const videoHost = new URL(capture.videoUrl).host;
    const audioHost = capture.audioUrl ? new URL(capture.audioUrl).host : null;

    const fetchToBlob = async (
      url: string,
      headers: Record<string, string> | undefined,
    ): Promise<Blob> => {
      const res = await fetch(url, { headers: headers ?? {} });
      if (!res.ok) throw new Error(`download failed: ${res.status} @ ${url.slice(0, 60)}…`);
      return await res.blob();
    };

    const putToCos = async (
      blob: Blob,
      cf: UploadCredFields,
      label: string,
    ): Promise<void> => {
      const putRes = await fetch(cf.uploadUrl, {
        method: cf.method,
        headers: cf.headers,
        body: blob,
      });
      if (!putRes.ok) throw new Error(`cos PUT failed (${label}): ${putRes.status}`);
    };

    // ---- 视频流 ----
    const videoBlob = videoReferer
      ? await withRefererRule({ referer: videoReferer, targetHost: videoHost }, () =>
          fetchToBlob(capture.videoUrl, capture.videoHeaders),
        )
      : await fetchToBlob(capture.videoUrl, capture.videoHeaders);
    await putToCos(videoBlob, cred, 'video');

    // ---- 音频流（DASH 分轨）----
    let audioCosKey: string | undefined;
    if (capture.audioUrl && cred.audio && audioHost) {
      const audioBlob = audioReferer
        ? await withRefererRule({ referer: audioReferer, targetHost: audioHost }, () =>
            fetchToBlob(capture.audioUrl!, capture.audioHeaders),
          )
        : await fetchToBlob(capture.audioUrl, capture.audioHeaders);
      await putToCos(audioBlob, cred.audio, 'audio');
      audioCosKey = cred.audio.cosKey;
    }

    await api.reportUploadDone({
      jobId: cred.jobId,
      cosKey: cred.cosKey,
      sizeBytes: videoBlob.size,
      audioCosKey,
    });
    chrome.notifications?.create?.({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'NewsBox',
      message: audioCosKey
        ? `视频+音频上传完成：${capture.meta.title}`
        : `视频上传完成：${capture.meta.title}`,
    });
  } catch (err) {
    console.error('[video-uploader]', err);
    chrome.notifications?.create?.({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'NewsBox 视频上传失败',
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    chrome.alarms?.clear?.('video-upload-heartbeat');
  }
}
