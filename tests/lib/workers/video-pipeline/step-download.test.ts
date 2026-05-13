// tests/lib/workers/video-pipeline/step-download.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { markStepMock, incrementRetryMock, uploadMock, fetchMock } = vi.hoisted(() => ({
  markStepMock: vi.fn(),
  incrementRetryMock: vi.fn(),
  uploadMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: markStepMock,
  incrementRetry: incrementRetryMock,
  isStale: () => false,
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: () => ({
    upload: uploadMock,
    getPublicUrl: (k: string) => `https://cos.example.com/${k}`,
  }),
  buildStorageKey: (input: any) => `${input.userId}/${input.kind}/2026/05/12/abc.${input.ext}`,
}));

import { runDownloadStep } from '@/lib/workers/video-pipeline/step-download';

const baseJob = {
  id: 'j1',
  user_id: 'u1',
  source_video_url: 'https://platform.com/v.mp4',
  request_headers: { Referer: 'https://platform.com' },
  download_strategy: 'server' as const,
  download_status: 'pending' as const,
  updated_at: new Date().toISOString(),
};

describe('runDownloadStep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads and uploads to COS, marks done', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'video/mp4' },
      arrayBuffer: async () => new ArrayBuffer(1024),
    });
    uploadMock.mockResolvedValueOnce({
      url: 'https://cos.example.com/u1/videos/2026/05/12/abc.mp4',
      key: 'u1/videos/2026/05/12/abc.mp4',
      size: 1024,
    });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenCalledWith('j1', 'download', 'in_progress');
    expect(uploadMock).toHaveBeenCalledWith(expect.objectContaining({
      contentType: expect.any(String),
    }));
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'done', expect.objectContaining({
      cos_key: 'u1/videos/2026/05/12/abc.mp4',
      cos_url: expect.stringContaining('cos.example.com'),
      size_bytes: 1024,
    }));
  });

  it('skips when download_status is done', async () => {
    await runDownloadStep({ ...baseJob, download_status: 'done' } as any);
    expect(markStepMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when strategy is browser (插件代下载)', async () => {
    await runDownloadStep({ ...baseJob, download_strategy: 'browser' } as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks need_browser_fallback on 403 (anti-hotlink)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'need_browser_fallback', expect.any(Object));
  });

  it('marks failed and increments retry on 5xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'failed', expect.objectContaining({
      download_error: expect.stringContaining('502'),
    }));
    expect(incrementRetryMock).toHaveBeenCalledWith('j1');
  });
});
