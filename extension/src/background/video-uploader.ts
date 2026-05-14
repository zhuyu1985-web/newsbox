import { api } from '../shared/api';
import type { VideoCapture } from '../content/video-extractors/base';

interface UploadCred {
  jobId: string;
  cosKey: string;
  uploadUrl: string;
  method: string;
  headers?: Record<string, string>;
  publicUrl: string;
  expiresAt: number;
}

export async function uploadVideoBytes(capture: VideoCapture, cred: UploadCred): Promise<void> {
  chrome.alarms.create('video-upload-heartbeat', { periodInMinutes: 0.5 });
  try {
    const res = await fetch(capture.videoUrl, { headers: capture.videoHeaders ?? {} });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const blob = await res.blob();
    const putRes = await fetch(cred.uploadUrl, {
      method: cred.method,
      headers: cred.headers,
      body: blob,
    });
    if (!putRes.ok) throw new Error(`cos PUT failed: ${putRes.status}`);
    await api.reportUploadDone({
      jobId: cred.jobId,
      cosKey: cred.cosKey,
      sizeBytes: blob.size,
    });
    chrome.notifications?.create?.({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'NewsBox',
      message: `视频上传完成：${capture.meta.title}`,
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
