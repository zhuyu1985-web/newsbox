// tests/lib/storage/adapters/tencent-cos-media.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchMock, putObjectMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  putObjectMock: vi.fn(),
}));

vi.stubGlobal('fetch', fetchMock);

vi.mock('cos-nodejs-sdk-v5', () => ({
  default: class MockCos {
    request = vi.fn();
    putObject = putObjectMock;
    deleteObject = vi.fn();
    headObject = vi.fn();
    getObjectUrl = vi.fn();
  },
}));

import { TencentCosAdapter } from '@/lib/storage/adapters/tencent-cos';

describe('TencentCosAdapter media processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENCENT_COS_SECRET_ID = 'id';
    process.env.TENCENT_COS_SECRET_KEY = 'key';
    process.env.TENCENT_COS_REGION = 'ap-shanghai';
    process.env.TENCENT_COS_BUCKET = 'b';
    delete process.env.TENCENT_COS_CUSTOM_DOMAIN;
  });

  it('probe parses GetMediaInfo XML response', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Response>
  <MediaInfo>
    <Format>
      <Duration>125.5</Duration>
      <Bitrate>2000</Bitrate>
      <Size>12345678</Size>
    </Format>
    <Stream>
      <Video>
        <Width>1920</Width>
        <Height>1080</Height>
        <CodecName>h264</CodecName>
      </Video>
      <Audio>
        <CodecName>aac</CodecName>
      </Audio>
    </Stream>
  </MediaInfo>
</Response>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const a = new TencentCosAdapter();
    const info = await a.probe('u/v.mp4');
    expect(info.durationSec).toBe(125.5);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.sizeBytes).toBe(12345678);

    // 验证 fetch 调用了 videoinfo URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('?ci-process=videoinfo'),
      expect.any(Object)
    );
  });

  it('probe throws when CI returns non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Media processing service is not activated',
    });
    const a = new TencentCosAdapter();
    await expect(a.probe('u/v.mp4')).rejects.toThrow(/403/);
  });

  it('extractFrames returns one URL per timestamp', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('FAKE0').buffer })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('FAKE30').buffer })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('FAKE60').buffer });
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: '...' })
    );

    const a = new TencentCosAdapter();
    const frames = await a.extractFrames({
      sourceKey: 'u/v.mp4',
      timestamps: [0, 30, 60],
      outputKeyPrefix: 'u/frames/v',
    });
    expect(frames).toHaveLength(3);
    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].key).toMatch(/u\/frames\/v.*30/);
  });

  it('generateSmartCover uploads cover and returns url', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('COVER').buffer,
    });
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: '...' })
    );
    const a = new TencentCosAdapter();
    const cover = await a.generateSmartCover({
      sourceKey: 'u/v.mp4',
      outputKey: 'u/covers/v.jpg',
    });
    expect(cover.key).toBe('u/covers/v.jpg');
    expect(cover.url).toContain('u/covers/v.jpg');
  });

  it('generateSpriteSheet returns sprite url', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Response>
  <OutputFile>
    <ObjectName>u/sprites/v.jpg</ObjectName>
  </OutputFile>
</Response>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const a = new TencentCosAdapter();
    const r = await a.generateSpriteSheet({
      sourceKey: 'u/v.mp4',
      outputKey: 'u/sprites/v.jpg',
      rows: 5,
      cols: 5,
    });
    expect(r.key).toBe('u/sprites/v.jpg');
  });
});
