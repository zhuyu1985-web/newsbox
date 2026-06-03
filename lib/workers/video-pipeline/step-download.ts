// lib/workers/video-pipeline/step-download.ts
import { getStorageProvider, buildStorageKey } from '@/lib/storage';
import { markStep, isStale } from './db';
import type { VideoJob } from './types';

const STALENESS_MS = 30 * 60_000;

export async function runDownloadStep(job: VideoJob): Promise<void> {
  // Skip terminal or deferred statuses
  if (
    job.download_status === 'done' ||
    job.download_status === 'failed' ||
    job.download_status === 'need_browser_fallback'
  ) {
    return;
  }

  // B 路径：由插件下载，step-download 直接跳过
  if (job.download_strategy === 'browser') {
    return;
  }

  // Another worker is already processing and it's not stale — skip
  if (job.download_status === 'in_progress' && !isStale(job.updated_at, STALENESS_MS)) {
    return;
  }

  await markStep(job.id, 'download', 'in_progress');

  try {
    const res = await fetch(job.source_video_url, {
      headers: job.request_headers ?? {},
    });

    if (res.status === 403) {
      // 反盗链或 IP 拦截 — 降级给插件处理，不计 retry
      await markStep(job.id, 'download', 'need_browser_fallback', {
        download_error: `HTTP 403 (likely anti-hotlink) — needs browser fallback`,
      });
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'video/mp4';
    const ext = guessExt(contentType, job.source_video_url);
    const key = buildStorageKey({ userId: job.user_id, kind: 'videos', ext });

    const result = await getStorageProvider().upload({ key, body: buf, contentType });

    await markStep(job.id, 'download', 'done', {
      cos_key: result.key,
      cos_url: result.url,
      size_bytes: result.size,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markStep(job.id, 'download', 'failed', { download_error: msg }, { incrementRetry: true });
  }
}

/**
 * Guess file extension from Content-Type header, falling back to URL path.
 */
function guessExt(contentType: string, url: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('quicktime')) return 'mov';
  if (lower.includes('mpegurl')) return 'm3u8';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('avi')) return 'avi';
  // URL fallback: strip query string, take last extension
  const urlPath = url.split('?')[0];
  const urlExt = urlPath.split('.').pop()?.toLowerCase();
  if (urlExt && urlExt.length >= 2 && urlExt.length <= 5) return urlExt;
  return 'mp4';
}
