// tests/lib/workers/video-pipeline/step-transcode.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  markStepMock: vi.fn(),
  incrementRetryMock: vi.fn(),
  notesUpdateMock: vi.fn(),
  // storage provider with MediaProcessing capability (default: has CI)
  storageProvider: {
    name: 'tencent-cos' as const,
    submitTranscode: vi.fn(),
    getTranscodeStatus: vi.fn(),
    getPublicUrl: vi.fn((key: string) => `https://cos.example.com/${key}`),
    upload: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    createUploadCredential: vi.fn(),
    probe: vi.fn(), // presence of probe means hasMediaProcessing === true
  },
  hasCI: true, // toggled in tests that want a non-CI provider
}));

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: mocks.markStepMock,
  incrementRetry: mocks.incrementRetryMock,
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: () => mocks.storageProvider,
}));

vi.mock('@/lib/storage/types', () => ({
  hasMediaProcessing: (p: any) =>
    typeof p.probe === 'function' && typeof p.submitTranscode === 'function',
}));

vi.mock('@/lib/supabase/server-service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'notes') {
        return {
          update: (data: any) => ({
            eq: (_col: string, _id: string) => {
              mocks.notesUpdateMock(data);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { runTranscodeStep } from '@/lib/workers/video-pipeline/step-transcode';

// ---------------------------------------------------------------------------
// Base fixtures
// ---------------------------------------------------------------------------
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'j1',
    note_id: 'n1',
    user_id: 'u1',
    download_status: 'done' as const,
    probe_status: 'done' as const,
    cos_key: 'u1/videos/2026/05/video.mov',
    cos_url: 'https://cos.example.com/u1/videos/2026/05/video.mov',
    probe_data: { videoCodec: 'hevc', audioCodec: 'aac', durationSec: 120, width: 1920, height: 1080, sizeBytes: 100_000_000 },
    transcode_status: 'pending' as const,
    transcode_job_id: null as string | null,
    transcoded_key: null as string | null,
    transcoded_url: null as string | null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runTranscodeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Phase 1a: video already H.264 → skipped
  // -------------------------------------------------------------------------
  it('skips transcode when probe_data.videoCodec is already h264', async () => {
    const job = makeJob({ probe_data: { videoCodec: 'h264' } });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'skipped');
    expect(mocks.storageProvider.submitTranscode).not.toHaveBeenCalled();
  });

  it('skips transcode when videoCodec is avc (H.264 alias)', async () => {
    const job = makeJob({ probe_data: { videoCodec: 'avc' } });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'skipped');
  });

  // -------------------------------------------------------------------------
  // Phase 1b: HEVC → submit transcode job
  // -------------------------------------------------------------------------
  it('submits transcode job for HEVC video and marks in_progress with job_id', async () => {
    mocks.storageProvider.submitTranscode.mockResolvedValueOnce({ jobId: 'ci-job-123' });

    const job = makeJob();
    await runTranscodeStep(job as any);

    expect(mocks.storageProvider.submitTranscode).toHaveBeenCalledWith({
      sourceKey: 'u1/videos/2026/05/video.mov',
      outputKey: 'u1/videos/2026/05/video_h264.mp4',
      targetCodec: 'h264',
    });
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'in_progress', {
      transcode_job_id: 'ci-job-123',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('marks failed and increments retry when submitTranscode throws', async () => {
    mocks.storageProvider.submitTranscode.mockRejectedValueOnce(new Error('CI API error'));

    const job = makeJob();
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'failed');
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
  });

  // -------------------------------------------------------------------------
  // Phase 2: poll
  // -------------------------------------------------------------------------
  it('polls CI, marks done, updates cos_key/cos_url, and updates notes.media_url when done', async () => {
    mocks.storageProvider.getTranscodeStatus.mockResolvedValueOnce({ status: 'done' });

    const job = makeJob({
      transcode_status: 'in_progress',
      transcode_job_id: 'ci-job-456',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    await runTranscodeStep(job as any);

    expect(mocks.storageProvider.getTranscodeStatus).toHaveBeenCalledWith('ci-job-456');
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'done', {
      transcoded_url: 'https://cos.example.com/u1/videos/2026/05/video_h264.mp4',
      cos_key: 'u1/videos/2026/05/video_h264.mp4',
      cos_url: 'https://cos.example.com/u1/videos/2026/05/video_h264.mp4',
    });
    expect(mocks.notesUpdateMock).toHaveBeenCalledWith({
      media_url: 'https://cos.example.com/u1/videos/2026/05/video_h264.mp4',
    });
  });

  it('marks failed and increments retry when poll returns failed', async () => {
    mocks.storageProvider.getTranscodeStatus.mockResolvedValueOnce({
      status: 'failed',
      error: 'unsupported codec',
    });

    const job = makeJob({
      transcode_status: 'in_progress',
      transcode_job_id: 'ci-job-789',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'failed');
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
    expect(mocks.notesUpdateMock).not.toHaveBeenCalled();
  });

  it('does nothing when poll returns running (wait for next tick)', async () => {
    mocks.storageProvider.getTranscodeStatus.mockResolvedValueOnce({ status: 'running' });

    const job = makeJob({
      transcode_status: 'in_progress',
      transcode_job_id: 'ci-job-abc',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('does nothing when poll returns pending (wait for next tick)', async () => {
    mocks.storageProvider.getTranscodeStatus.mockResolvedValueOnce({ status: 'pending' });

    const job = makeJob({
      transcode_status: 'in_progress',
      transcode_job_id: 'ci-job-pend',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('marks failed and increments retry when getTranscodeStatus throws', async () => {
    mocks.storageProvider.getTranscodeStatus.mockRejectedValueOnce(new Error('Network timeout'));

    const job = makeJob({
      transcode_status: 'in_progress',
      transcode_job_id: 'ci-job-err',
      transcoded_key: 'u1/videos/2026/05/video_h264.mp4',
    });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'transcode', 'failed');
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
  });

  // -------------------------------------------------------------------------
  // Guard conditions / early returns
  // -------------------------------------------------------------------------
  it('returns early when probe_status is not done', async () => {
    const job = makeJob({ probe_status: 'in_progress' });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect(mocks.storageProvider.submitTranscode).not.toHaveBeenCalled();
  });

  it('returns early when download_status is not done', async () => {
    const job = makeJob({ download_status: 'in_progress' });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when transcode_status is already done', async () => {
    const job = makeJob({ transcode_status: 'done' });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect(mocks.storageProvider.submitTranscode).not.toHaveBeenCalled();
  });

  it('returns early when transcode_status is already skipped', async () => {
    const job = makeJob({ transcode_status: 'skipped' });
    await runTranscodeStep(job as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when transcode_status is in_progress but transcode_job_id is null', async () => {
    const job = makeJob({ transcode_status: 'in_progress', transcode_job_id: null });
    await runTranscodeStep(job as any);

    expect(mocks.storageProvider.getTranscodeStatus).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });
});
