// tests/lib/storage/adapters/tencent-cos.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const putObjectMock = vi.fn();
const deleteObjectMock = vi.fn();
const headObjectMock = vi.fn();
const getObjectUrlMock = vi.fn();

vi.mock('cos-nodejs-sdk-v5', () => {
  return {
    default: class MockCos {
      putObject = putObjectMock;
      deleteObject = deleteObjectMock;
      headObject = headObjectMock;
      getObjectUrl = getObjectUrlMock;
    },
  };
});

import { TencentCosAdapter } from '@/lib/storage/adapters/tencent-cos';

describe('TencentCosAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENCENT_COS_SECRET_ID = 'id';
    process.env.TENCENT_COS_SECRET_KEY = 'key';
    process.env.TENCENT_COS_REGION = 'ap-shanghai';
    process.env.TENCENT_COS_BUCKET = 'my-bucket-12345';
  });

  it('upload puts object and returns public url', async () => {
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: 'my-bucket-12345.cos.ap-shanghai.myqcloud.com/u/x.jpg' })
    );
    const a = new TencentCosAdapter();
    const r = await a.upload({ key: 'u/x.jpg', body: Buffer.from('abc'), contentType: 'image/jpeg' });
    expect(r.key).toBe('u/x.jpg');
    expect(r.size).toBe(3);
    expect(r.url).toContain('my-bucket-12345.cos.ap-shanghai.myqcloud.com');
  });

  it('upload rejects on SDK error', async () => {
    putObjectMock.mockImplementation((_p: any, cb: any) => cb(new Error('cos failed')));
    const a = new TencentCosAdapter();
    await expect(a.upload({ key: 'k', body: Buffer.from(''), contentType: 'image/jpeg' }))
      .rejects.toThrow(/cos failed/);
  });

  it('getPublicUrl with custom domain', () => {
    process.env.TENCENT_COS_CUSTOM_DOMAIN = 'cdn.example.com';
    const a = new TencentCosAdapter();
    expect(a.getPublicUrl('u/x.jpg')).toBe('https://cdn.example.com/u/x.jpg');
  });

  it('getPublicUrl falls back to bucket+region when no custom domain', () => {
    delete process.env.TENCENT_COS_CUSTOM_DOMAIN;
    const a = new TencentCosAdapter();
    expect(a.getPublicUrl('u/x.jpg'))
      .toBe('https://my-bucket-12345.cos.ap-shanghai.myqcloud.com/u/x.jpg');
  });

  it('exists returns true when HeadObject succeeds', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb(null, { statusCode: 200 }));
    const a = new TencentCosAdapter();
    expect(await a.exists('u/x.jpg')).toBe(true);
  });

  it('exists returns false on 404', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb({ statusCode: 404 }));
    const a = new TencentCosAdapter();
    expect(await a.exists('u/missing.jpg')).toBe(false);
  });

  it('exists rethrows non-404 errors', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb({ statusCode: 500, message: 'oops' }));
    const a = new TencentCosAdapter();
    await expect(a.exists('u/x.jpg')).rejects.toThrow(/oops|500/);
  });

  it('delete calls deleteObject', async () => {
    deleteObjectMock.mockImplementation((_p: any, cb: any) => cb(null, { statusCode: 204 }));
    const a = new TencentCosAdapter();
    await a.delete('u/x.jpg');
    expect(deleteObjectMock).toHaveBeenCalled();
  });

  it('createUploadCredential returns presigned PUT url', async () => {
    getObjectUrlMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Url: 'https://signed.example.com/u/x.mp4?signature=xxx' })
    );
    const a = new TencentCosAdapter();
    const c = await a.createUploadCredential({ key: 'u/x.mp4', contentType: 'video/mp4' });
    expect(c.method).toBe('PUT');
    expect(c.uploadUrl).toContain('signed.example.com');
    expect(c.publicUrl).toContain('my-bucket-12345.cos.ap-shanghai.myqcloud.com');
  });

  it('throws when env credentials missing', () => {
    delete process.env.TENCENT_COS_SECRET_ID;
    expect(() => new TencentCosAdapter()).toThrow(/TENCENT_COS_SECRET_ID/);
  });
});
