import type { StorageBackend } from './types';

// Supabase Cloud 的 legacy 域名，保留以兼容历史 URL
const SUPABASE_CLOUD_SUFFIX = '.supabase.co';

function getConfiguredSupabaseHost(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// 判断 hostname 是否属于 Supabase（自托管或 Cloud）
export function isSupabaseHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.endsWith(SUPABASE_CLOUD_SUFFIX)) return true;
  const configured = getConfiguredSupabaseHost();
  return Boolean(configured && h === configured);
}

// 判断 URL 是否是 Supabase Storage 的对象 URL
// 用于 VideoPlayer / knowledge-view 等判断是否走 direct video 播放
export function isSupabaseStorageUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return isSupabaseHost(parsed.hostname) && parsed.pathname.includes('/storage/');
}

// 判断 URL 是否能作为 <video> 直接源
// - 解析 pathname 而非整个 URL，避免被 query string（COS 签名）干扰
// - 覆盖常见视频扩展名 + 已知存储主机（Supabase / COS / GCS）
export function isDirectVideoUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname.toLowerCase();
  if (/\.(mp4|m3u8|webm|mov|m4v|mpd)$/.test(path)) return true;

  const host = parsed.hostname.toLowerCase();
  if (host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com')) return true;
  if (isSupabaseHost(host) && parsed.pathname.includes('/storage/')) return true;
  // 腾讯云 COS（含签名 URL，pathname 通常带扩展名，但兜底）
  if (host.endsWith('.myqcloud.com') || host.endsWith('.tencentcos.cn')) return true;
  return false;
}

export function identifyStorageBackend(url: unknown): StorageBackend | 'external' {
  if (typeof url !== 'string' || !url) return 'external';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'external';
  }

  // 通过 hostname 严格判定，避免路径注入
  if (isSupabaseHost(parsed.hostname)) return 'supabase';
  if (parsed.hostname.endsWith('.myqcloud.com')) return 'tencent-cos';

  const customDomain = process.env.TENCENT_COS_CUSTOM_DOMAIN;
  if (customDomain && parsed.hostname === customDomain) return 'tencent-cos';

  return 'external';
}
