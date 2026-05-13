// tests/lib/workers/video-pipeline/step-extract-frames.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  markStepMock,
  providerMock,
  getStorageProviderMock,
} = vi.hoisted(() => {
  const providerMock = {
    probe: vi.fn(),
    extractFrames: vi.fn(),
  };
  const getStorageProviderMock = vi.fn(() => providerMock);
  return {
    markStepMock: vi.fn(),
    providerMock,
    getStorageProviderMock,
  };
});

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: markStepMock,
  isStale: () => false,
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: getStorageProviderMock,
  hasMediaProcessing: (p: any) => typeof p.probe === 'function',
}));

import { runExtractFramesStep } from '@/lib/workers/video-pipeline/step-extract-frames';

const baseJob = {
  id: 'j1',
  note_id: 'n1',
  user_id: 'u1',
  cos_key: 'u1/videos/2026/05/12/video.mp4',
  download_status: 'done' as const,
  probe_status: 'done' as const,
  frame_status: 'pending' as const,
  probe_data: { durationSec: 180, width: 1920, height: 1080, videoCodec: 'h264', audioCodec: 'aac', sizeBytes: 60_000_000 },
  audio_result: null,
  updated_at: new Date().toISOString(),
};

const framesResult = [
  { timestamp: 30, key: 'u1/frames/j1/f_30.jpg', url: 'https://cos.example.com/u1/frames/j1/f_30.jpg' },
  { timestamp: 90, key: 'u1/frames/j1/f_90.jpg', url: 'https://cos.example.com/u1/frames/j1/f_90.jpg' },
  { timestamp: 150, key: 'u1/frames/j1/f_150.jpg', url: 'https://cos.example.com/u1/frames/j1/f_150.jpg' },
];

describe('runExtractFramesStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: normal happy path — download done, probe done, no chapters → equal intervals
  it('extracts frames at equal intervals when no chapters available', async () => {
    providerMock.extractFrames.mockResolvedValueOnce(framesResult);

    await runExtractFramesStep(baseJob as any);

    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'in_progress');
    expect(providerMock.extractFrames).toHaveBeenCalledWith({
      sourceKey: 'u1/videos/2026/05/12/video.mp4',
      timestamps: expect.arrayContaining([expect.any(Number)]),
      outputKeyPrefix: 'u1/frames/j1/f',
    });
    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'done', {
      frames: framesResult,
    });
  });

  // Scenario 2: chapters available → use chapter midpoints
  it('uses chapter midpoints when audio_result.chapters is present', async () => {
    const chapters = [
      { start: 0, end: 60, title: 'Intro', summary: '' },
      { start: 60, end: 120, title: 'Main', summary: '' },
      { start: 120, end: 180, title: 'Outro', summary: '' },
    ];
    const jobWithChapters = {
      ...baseJob,
      audio_result: { chapters },
    };

    const chapterFrames = [
      { timestamp: 30, key: 'u1/frames/j1/f_30.jpg', url: 'https://cos.example.com/u1/frames/j1/f_30.jpg' },
      { timestamp: 90, key: 'u1/frames/j1/f_90.jpg', url: 'https://cos.example.com/u1/frames/j1/f_90.jpg' },
      { timestamp: 150, key: 'u1/frames/j1/f_150.jpg', url: 'https://cos.example.com/u1/frames/j1/f_150.jpg' },
    ];
    providerMock.extractFrames.mockResolvedValueOnce(chapterFrames);

    await runExtractFramesStep(jobWithChapters as any);

    const call = providerMock.extractFrames.mock.calls[0][0];
    // midpoints of each chapter: (0+60)/2=30, (60+120)/2=90, (120+180)/2=150
    expect(call.timestamps).toEqual([30, 90, 150]);
    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'done', { frames: chapterFrames });
  });

  // Scenario 3: provider has no MediaProcessingCapability → mark 'skipped'
  it('marks frame as skipped when provider has no MediaProcessingCapability', async () => {
    // Provider without probe = no CI capability
    getStorageProviderMock.mockReturnValueOnce({
      name: 'supabase',
      upload: vi.fn(),
      createUploadCredential: vi.fn(),
      getPublicUrl: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as any);

    await runExtractFramesStep(baseJob as any);

    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'skipped');
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });

  // Scenario 4: frame_status is not 'pending' → early return (idempotency)
  it('returns early when frame_status is already in_progress', async () => {
    await runExtractFramesStep({
      ...baseJob,
      frame_status: 'in_progress',
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });

  // Scenario 5: download_status is not 'done' → early return
  it('returns early when download_status is not done', async () => {
    await runExtractFramesStep({
      ...baseJob,
      download_status: 'in_progress',
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });

  // Scenario 6: cos_key is null → early return
  it('returns early when cos_key is null', async () => {
    await runExtractFramesStep({
      ...baseJob,
      cos_key: null,
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });

  // Scenario 7: probe_status is not 'done' → early return (need duration)
  it('returns early when probe_status is not done', async () => {
    await runExtractFramesStep({
      ...baseJob,
      probe_status: 'pending',
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });

  // Scenario 8: extractFrames throws → marks 'failed'
  it('marks frame failed when extractFrames throws', async () => {
    providerMock.extractFrames.mockRejectedValueOnce(new Error('CI timeout'));

    await runExtractFramesStep(baseJob as any);

    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'in_progress');
    expect(markStepMock).toHaveBeenCalledWith('j1', 'frame', 'failed');
    // should not mark done
    const doneCalls = markStepMock.mock.calls.filter(([, , s]) => s === 'done');
    expect(doneCalls).toHaveLength(0);
  });

  // Scenario 9: duration=0 in probe_data → returns [0] as single timestamp
  it('returns single timestamp [0] when duration is 0', async () => {
    providerMock.extractFrames.mockResolvedValueOnce([
      { timestamp: 0, key: 'u1/frames/j1/f_0.jpg', url: 'https://cos.example.com/u1/frames/j1/f_0.jpg' },
    ]);

    await runExtractFramesStep({
      ...baseJob,
      probe_data: { durationSec: 0 },
    } as any);

    const call = providerMock.extractFrames.mock.calls[0][0];
    expect(call.timestamps).toEqual([0]);
  });

  // Scenario 10: many chapters → capped at 20 frames
  it('caps timestamps at 20 even with many chapters', async () => {
    const manyChapters = Array.from({ length: 30 }, (_, i) => ({
      start: i * 10,
      end: (i + 1) * 10,
      title: `Ch${i}`,
    }));

    providerMock.extractFrames.mockResolvedValueOnce([]);

    await runExtractFramesStep({
      ...baseJob,
      audio_result: { chapters: manyChapters },
    } as any);

    const call = providerMock.extractFrames.mock.calls[0][0];
    expect(call.timestamps).toHaveLength(20);
  });

  // Scenario 11: long video (1800s) without chapters → multiple intervals, max 20
  it('uses multiple equal intervals for long videos without chapters', async () => {
    providerMock.extractFrames.mockResolvedValueOnce([]);

    await runExtractFramesStep({
      ...baseJob,
      probe_data: { durationSec: 1800 }, // 30 min
    } as any);

    const call = providerMock.extractFrames.mock.calls[0][0];
    // 1800 / 60 = 30 intervals, capped to 20
    expect(call.timestamps).toHaveLength(20);
    // all timestamps should be within range
    for (const t of call.timestamps) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1800);
    }
  });

  // Scenario 12: frame_status 'done' → early return (idempotency)
  it('returns early when frame_status is done', async () => {
    await runExtractFramesStep({
      ...baseJob,
      frame_status: 'done',
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.extractFrames).not.toHaveBeenCalled();
  });
});
