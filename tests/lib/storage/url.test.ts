import { describe, it, expect, beforeEach } from 'vitest';
import { identifyStorageBackend } from '@/lib/storage/url';

describe('identifyStorageBackend', () => {
  beforeEach(() => {
    delete process.env.TENCENT_COS_CUSTOM_DOMAIN;
  });

  it('identifies supabase storage URLs', () => {
    expect(identifyStorageBackend('https://xyz.supabase.co/storage/v1/object/public/user-files/a.jpg'))
      .toBe('supabase');
  });

  it('identifies tencent COS standard URLs', () => {
    expect(identifyStorageBackend('https://my-bucket.cos.ap-shanghai.myqcloud.com/a.mp4'))
      .toBe('tencent-cos');
  });

  it('identifies tencent COS custom domain when env is set', () => {
    process.env.TENCENT_COS_CUSTOM_DOMAIN = 'cdn.example.com';
    expect(identifyStorageBackend('https://cdn.example.com/a.jpg'))
      .toBe('tencent-cos');
  });

  it('returns external for unrelated URLs', () => {
    expect(identifyStorageBackend('https://random.cdn.com/a.jpg')).toBe('external');
    expect(identifyStorageBackend('https://example.com/a.png')).toBe('external');
  });

  it('handles empty / falsy input safely', () => {
    expect(identifyStorageBackend('')).toBe('external');
    expect(identifyStorageBackend(null)).toBe('external');
    expect(identifyStorageBackend(undefined)).toBe('external');
  });

  it('rejects path-injection attacks via fake subpath', () => {
    expect(identifyStorageBackend('https://attacker.com/.supabase.co/storage/x')).toBe('external');
    expect(identifyStorageBackend('https://attacker.com/.myqcloud.com/x')).toBe('external');
  });

  it('rejects malformed URLs', () => {
    expect(identifyStorageBackend('not a url')).toBe('external');
    expect(identifyStorageBackend('javascript:alert(1)')).toBe('external');
  });
});
