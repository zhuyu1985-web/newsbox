// tests/lib/workers/video-pipeline/step-analyze-visual.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  markStepMock: vi.fn(),
  visualProviderMock: {
    analyzeFrames: vi.fn(),
  } as { analyzeFrames: ReturnType<typeof vi.fn> } | null,
  getVisualAnalysisProviderMock: vi.fn(),
}));

// Set up default return: return the visualProviderMock
mocks.getVisualAnalysisProviderMock.mockImplementation(() => mocks.visualProviderMock);

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: mocks.markStepMock,
  isStale: () => false,
}));

vi.mock('@/lib/ai-analysis', () => ({
  getVisualAnalysisProvider: mocks.getVisualAnalysisProviderMock,
}));

import { runAnalyzeVisualStep } from '@/lib/workers/video-pipeline/step-analyze-visual';

const baseFrames = [
  { timestamp: 30, key: 'u1/frames/j1/f_30.jpg', url: 'https://cos.example.com/u1/frames/j1/f_30.jpg' },
  { timestamp: 90, key: 'u1/frames/j1/f_90.jpg', url: 'https://cos.example.com/u1/frames/j1/f_90.jpg' },
];

const baseJob = {
  id: 'j1',
  note_id: 'n1',
  user_id: 'u1',
  visual_status: 'pending' as const,
  frame_status: 'done' as const,
  frames: baseFrames,
  updated_at: new Date().toISOString(),
};

const visualResult = [
  {
    timestamp: 30,
    sceneDescription: 'A presenter stands in front of a whiteboard',
    entities: ['person', 'whiteboard'],
    onScreenText: 'Introduction',
  },
  {
    timestamp: 90,
    sceneDescription: 'Code editor showing TypeScript code',
    entities: ['screen', 'code'],
    onScreenText: 'const x = 1;',
  },
];

describe('runAnalyzeVisualStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to return the provider mock by default
    mocks.getVisualAnalysisProviderMock.mockImplementation(() => mocks.visualProviderMock);
  });

  // Scenario 1: happy path — provider available, frames present, analyzeFrames succeeds
  it('calls analyzeFrames and marks done when provider and frames are available', async () => {
    (mocks.visualProviderMock as any).analyzeFrames.mockResolvedValueOnce(visualResult);

    await runAnalyzeVisualStep(baseJob as any, 'My Video Title');

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'in_progress');
    expect((mocks.visualProviderMock as any).analyzeFrames).toHaveBeenCalledWith({
      frames: [
        { timestamp: 30, url: 'https://cos.example.com/u1/frames/j1/f_30.jpg' },
        { timestamp: 90, url: 'https://cos.example.com/u1/frames/j1/f_90.jpg' },
      ],
      context: 'My Video Title',
    });
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'done', {
      visual_result: visualResult,
    });
  });

  // Scenario 2: provider returns null (VISUAL_ANALYSIS_PROVIDER=none) → mark 'skipped'
  it('marks visual as skipped when getVisualAnalysisProvider returns null', async () => {
    mocks.getVisualAnalysisProviderMock.mockReturnValueOnce(null);

    await runAnalyzeVisualStep(baseJob as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'skipped');
    // Should not call analyzeFrames or mark in_progress
    expect(mocks.markStepMock).not.toHaveBeenCalledWith('j1', 'visual', 'in_progress');
  });

  // Scenario 3: visual_status is not 'pending' → early return (idempotency)
  it('returns early when visual_status is already in_progress', async () => {
    await runAnalyzeVisualStep({
      ...baseJob,
      visual_status: 'in_progress',
    } as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect((mocks.visualProviderMock as any).analyzeFrames).not.toHaveBeenCalled();
  });

  // Scenario 4: frame_status is not 'done' → early return
  it('returns early when frame_status is not done', async () => {
    await runAnalyzeVisualStep({
      ...baseJob,
      frame_status: 'pending',
    } as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect((mocks.visualProviderMock as any).analyzeFrames).not.toHaveBeenCalled();
  });

  // Scenario 5: frames is null/undefined → early return
  it('returns early when frames is null', async () => {
    await runAnalyzeVisualStep({
      ...baseJob,
      frames: null,
    } as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect((mocks.visualProviderMock as any).analyzeFrames).not.toHaveBeenCalled();
  });

  // Scenario 6: analyzeFrames throws → marks 'failed' with error message (does not rethrow)
  it('marks visual failed with error message when analyzeFrames throws', async () => {
    const err = new Error('Qwen-VL API timeout');
    (mocks.visualProviderMock as any).analyzeFrames.mockRejectedValueOnce(err);

    // Must NOT throw — visual failure should not block fully_ready (spec §7.2)
    await expect(runAnalyzeVisualStep(baseJob as any)).resolves.toBeUndefined();

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'in_progress');
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'failed', {
      visual_error: 'Error: Qwen-VL API timeout',
    });
    // should not mark done
    const doneCalls = mocks.markStepMock.mock.calls.filter(([, , s]) => s === 'done');
    expect(doneCalls).toHaveLength(0);
  });

  // Scenario 7: noteTitle is undefined → passes undefined as context (graceful)
  it('passes undefined context when noteTitle is not provided', async () => {
    (mocks.visualProviderMock as any).analyzeFrames.mockResolvedValueOnce([]);

    await runAnalyzeVisualStep(baseJob as any);

    const call = (mocks.visualProviderMock as any).analyzeFrames.mock.calls[0][0];
    expect(call.context).toBeUndefined();
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'visual', 'done', { visual_result: [] });
  });

  // Scenario 8: visual_status 'done' → early return (already completed)
  it('returns early when visual_status is done', async () => {
    await runAnalyzeVisualStep({
      ...baseJob,
      visual_status: 'done',
    } as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect((mocks.visualProviderMock as any).analyzeFrames).not.toHaveBeenCalled();
  });

  // Scenario 9: visual_status 'skipped' → early return
  it('returns early when visual_status is skipped', async () => {
    await runAnalyzeVisualStep({
      ...baseJob,
      visual_status: 'skipped',
    } as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  // Scenario 10: frames only contains timestamp and url fields — extras stripped correctly
  it('strips extra frame fields, passing only timestamp and url to analyzeFrames', async () => {
    const framesWithExtras = [
      { timestamp: 30, key: 'u1/frames/j1/f_30.jpg', url: 'https://cos.example.com/f_30.jpg', extra: 'data' },
    ];
    (mocks.visualProviderMock as any).analyzeFrames.mockResolvedValueOnce([]);

    await runAnalyzeVisualStep({
      ...baseJob,
      frames: framesWithExtras,
    } as any, 'Title');

    const call = (mocks.visualProviderMock as any).analyzeFrames.mock.calls[0][0];
    expect(call.frames).toEqual([
      { timestamp: 30, url: 'https://cos.example.com/f_30.jpg' },
    ]);
    // 'key' and 'extra' should not be passed
    expect(call.frames[0]).not.toHaveProperty('key');
    expect(call.frames[0]).not.toHaveProperty('extra');
  });
});
