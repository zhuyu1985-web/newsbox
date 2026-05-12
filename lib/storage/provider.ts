import type { StorageProvider } from './types';
import { SupabaseAdapter } from './adapters/supabase';
import { TencentCosAdapter } from './adapters/tencent-cos';
import { VolcengineTosAdapter } from './adapters/volcengine-tos';

let cached: StorageProvider | null = null;
let cachedFor: string | null = null;

export function getStorageProvider(): StorageProvider {
  const requested = process.env.STORAGE_PROVIDER ?? 'supabase';
  if (cached && cachedFor === requested) return cached;

  switch (requested) {
    case 'supabase':
      cached = new SupabaseAdapter(); break;
    case 'tencent-cos':
      cached = new TencentCosAdapter(); break;
    case 'volcengine-tos':
      cached = new VolcengineTosAdapter(); break;
    default:
      throw new Error(`unknown STORAGE_PROVIDER: ${requested}`);
  }
  cachedFor = requested;
  return cached;
}

/** Test only — resets the singleton cache between tests */
export function _resetProviderCache() {
  cached = null;
  cachedFor = null;
}
