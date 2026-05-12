import type { StorageBackend } from './types';

export function identifyStorageBackend(url: unknown): StorageBackend | 'external' {
  if (typeof url !== 'string' || !url) return 'external';

  if (url.includes('.supabase.co/storage/')) return 'supabase';

  if (url.includes('.myqcloud.com')) return 'tencent-cos';

  const customDomain = process.env.TENCENT_COS_CUSTOM_DOMAIN;
  if (customDomain && url.includes(customDomain)) return 'tencent-cos';

  return 'external';
}
