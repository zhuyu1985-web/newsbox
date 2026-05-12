// tests/lib/storage/adapters/tencent-cos-media.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();
const putObjectMock = vi.fn();

vi.mock('cos-nodejs-sdk-v5', () => ({
  default: class MockCos {
    request = requestMock;
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

  it('probe parses GetMediaInfo response', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, {
        statusCode: 200,
        Response: {
          MediaInfo: {
            Format: { Duration: '125.5', Bitrate: '2000', Size: '12345678' },
            Stream: {
              Video: { Width: '1920', Height: '1080', Codec_name: 'h264' },
              Audio: { Codec_name: 'aac' },
            },
          },
        },
      })
    );
    const a = new TencentCosAdapter();
    const info = await a.probe('u/v.mp4');
    expect(info.durationSec).toBe(125.5);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.sizeBytes).toBe(12345678);
  });

  it('extractFrames returns one URL per timestamp', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { statusCode: 200, Body: Buffer.from('FAKEIMG') })
    );
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
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { statusCode: 200, Body: Buffer.from('COVER') })
    );
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

  it('generateSpriteSheet returns sprite + vtt urls', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, {
        statusCode: 200,
        Response: {
          OutputFile: { ObjectName: 'u/sprites/v.jpg' },
          OutputVttFile: { ObjectName: 'u/sprites/v.vtt' },
        },
      })
    );
    const a = new TencentCosAdapter();
    const r = await a.generateSpriteSheet({
      sourceKey: 'u/v.mp4',
      outputKey: 'u/sprites/v.jpg',
      rows: 5,
      cols: 5,
    });
    expect(r.key).toBe('u/sprites/v.jpg');
    expect(r.vttKey).toBe('u/sprites/v.vtt');
  });
});
