// tests/lib/storage/adapters/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadMock = vi.fn();
const removeMock = vi.fn();
const listMock = vi.fn();
const getPublicUrlMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        list: listMock,
        getPublicUrl: getPublicUrlMock,
        createSignedUploadUrl: createSignedUploadUrlMock,
      }),
    },
  })),
}));

import { SupabaseAdapter } from '@/lib/storage/adapters/supabase';

describe('SupabaseAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET = 'user-files';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  it('upload returns url + key + size', async () => {
    uploadMock.mockResolvedValueOnce({ data: { path: 'u/images/2026/05/12/x.jpg' }, error: null });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/u/images/2026/05/12/x.jpg' } });

    const a = new SupabaseAdapter();
    const body = Buffer.from('abc');
    const r = await a.upload({ key: 'u/images/2026/05/12/x.jpg', body, contentType: 'image/jpeg' });

    expect(r.key).toBe('u/images/2026/05/12/x.jpg');
    expect(r.size).toBe(3);
    expect(r.url).toContain('test.supabase.co');
  });

  it('upload throws on supabase error', async () => {
    uploadMock.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    const a = new SupabaseAdapter();
    await expect(a.upload({ key: 'k', body: Buffer.from(''), contentType: 'image/jpeg' }))
      .rejects.toThrow(/denied/);
  });

  it('getPublicUrl builds expected URL shape', () => {
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/foo.jpg' } });
    const a = new SupabaseAdapter();
    expect(a.getPublicUrl('foo.jpg')).toContain('foo.jpg');
  });

  it('exists returns true when list finds the file', async () => {
    listMock.mockResolvedValueOnce({ data: [{ name: 'x.jpg' }], error: null });
    const a = new SupabaseAdapter();
    expect(await a.exists('u/images/x.jpg')).toBe(true);
  });

  it('exists returns false when list empty', async () => {
    listMock.mockResolvedValueOnce({ data: [], error: null });
    const a = new SupabaseAdapter();
    expect(await a.exists('u/missing.jpg')).toBe(false);
  });

  it('delete calls remove with key', async () => {
    removeMock.mockResolvedValueOnce({ data: [], error: null });
    const a = new SupabaseAdapter();
    await a.delete('u/x.jpg');
    expect(removeMock).toHaveBeenCalledWith(['u/x.jpg']);
  });

  it('createUploadCredential returns signed url', async () => {
    createSignedUploadUrlMock.mockResolvedValueOnce({
      data: { signedUrl: 'https://test.supabase.co/storage/v1/object/upload/sign/...', token: 't', path: 'k' },
      error: null,
    });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/k' } });
    const a = new SupabaseAdapter();
    const c = await a.createUploadCredential({ key: 'k', contentType: 'video/mp4' });
    expect(c.method).toBe('PUT');
    expect(c.publicUrl).toContain('test.supabase.co');
  });
});
