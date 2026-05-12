import type { StorageBackend } from './types';

export function identifyStorageBackend(url: unknown): StorageBackend | 'external' {
  if (typeof url !== 'string' || !url) return 'external';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'external';
  }

  // 通过 hostname 严格判定，避免路径注入
  if (parsed.hostname.endsWith('.supabase.co')) return 'supabase';
  if (parsed.hostname.endsWith('.myqcloud.com')) return 'tencent-cos';

  const customDomain = process.env.TENCENT_COS_CUSTOM_DOMAIN;
  if (customDomain && parsed.hostname === customDomain) return 'tencent-cos';

  return 'external';
}
