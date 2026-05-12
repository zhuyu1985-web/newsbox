// tests/lib/storage/provider.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/storage/adapters/supabase', () => ({
  SupabaseAdapter: class { readonly name = 'supabase'; },
}));
vi.mock('@/lib/storage/adapters/tencent-cos', () => ({
  TencentCosAdapter: class { readonly name = 'tencent-cos'; },
}));
vi.mock('@/lib/storage/adapters/volcengine-tos', () => ({
  VolcengineTosAdapter: class {
    constructor() { throw new Error('not implemented'); }
  },
}));

import { getStorageProvider, _resetProviderCache } from '@/lib/storage/provider';

describe('getStorageProvider', () => {
  beforeEach(() => {
    _resetProviderCache();
    delete process.env.STORAGE_PROVIDER;
  });

  it('defaults to supabase', () => {
    expect(getStorageProvider().name).toBe('supabase');
  });

  it('returns tencent-cos when env=tencent-cos', () => {
    process.env.STORAGE_PROVIDER = 'tencent-cos';
    expect(getStorageProvider().name).toBe('tencent-cos');
  });

  it('throws on volcengine-tos', () => {
    process.env.STORAGE_PROVIDER = 'volcengine-tos';
    expect(() => getStorageProvider()).toThrow(/not implemented/);
  });

  it('throws on unknown provider', () => {
    process.env.STORAGE_PROVIDER = 'aws-s3';
    expect(() => getStorageProvider()).toThrow(/unknown STORAGE_PROVIDER/i);
  });

  it('caches the provider instance', () => {
    process.env.STORAGE_PROVIDER = 'supabase';
    const a = getStorageProvider();
    const b = getStorageProvider();
    expect(a).toBe(b);
  });
});
