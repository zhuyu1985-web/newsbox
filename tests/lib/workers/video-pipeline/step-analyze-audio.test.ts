// tests/lib/workers/video-pipeline/step-analyze-audio.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  markStepMock: vi.fn(),
  incrementRetryMock: vi.fn(),
  audioProvider: {
    submit: vi.fn(),
    poll: vi.fn(),
    name: 'tingwu' as const,
  },
}));

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: mocks.markStepMock,
  incrementRetry: mocks.incrementRetryMock,
  isStale: () => false,
}));

vi.mock('@/lib/ai-analysis', () => ({
  getAudioAnalysisProvider: () => mocks.audioProvider,
}));

import { runAnalyzeAudioStep } from '@/lib/workers/video-pipeline/step-analyze-audio';

// ---------------------------------------------------------------------------
// Base fixtures
// ---------------------------------------------------------------------------

const baseJob = {
  id: 'j1',
  note_id: 'n1',
  user_id: 'u1',
  download_status: 'done' as const,
  cos_url: 'https://cos.example.com/u1/videos/v.mp4',
  audio_status: 'pending' as const,
  audio_task_id: null as string | null,
  audio_result: null,
  audio_error: null,
  updated_at: new Date().toISOString(),
};

const audioResult = {
  transcript: [{ start: 0, end: 5, text: 'Hello world', speaker: 'A' }],
  chapters: [{ start: 0, end: 60, title: 'Introduction', summary: 'Intro chapter' }],
  summary: 'A brief summary',
  keyPoints: ['point 1', 'point 2'],
  qaPairs: [{ q: 'What is this?', a: 'A demo video.' }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAnalyzeAudioStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // PHASE 1: submit (audio_status === 'pending')
  // ------------------------------------------------------------------

  it('submits to Tingwu, writes audio_task_id, marks in_progress', async () => {
    mocks.audioProvider.submit.mockResolvedValueOnce({ taskId: 'tw-task-123' });

    await runAnalyzeAudioStep(baseJob as any);

    expect(mocks.audioProvider.submit).toHaveBeenCalledWith({
      mediaUrl: 'https://cos.example.com/u1/videos/v.mp4',
      capabilities: ['transcript', 'chapters', 'summary', 'key_points', 'qa'],
      language: 'zh',
    });
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'audio', 'in_progress', {
      audio_task_id: 'tw-task-123',
    });
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('marks failed and increments retry when submit throws', async () => {
    mocks.audioProvider.submit.mockRejectedValueOnce(new Error('Tingwu API error'));

    await runAnalyzeAudioStep(baseJob as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith(
      'j1',
      'audio',
      'failed',
      expect.objectContaining({ audio_error: expect.stringContaining('Tingwu API error') }),
    );
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
  });

  // ------------------------------------------------------------------
  // PHASE 2: poll (audio_status === 'in_progress' + audio_task_id set)
  // ------------------------------------------------------------------

  it('polls Tingwu and marks done when poll returns done', async () => {
    const inProgressJob = {
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: 'tw-task-456',
    };

    mocks.audioProvider.poll.mockResolvedValueOnce({
      status: 'done',
      result: audioResult,
    });

    await runAnalyzeAudioStep(inProgressJob as any);

    expect(mocks.audioProvider.poll).toHaveBeenCalledWith('tw-task-456');
    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'audio', 'done', {
      audio_result: audioResult,
    });
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('marks failed and increments retry when poll returns failed', async () => {
    const inProgressJob = {
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: 'tw-task-789',
    };

    mocks.audioProvider.poll.mockResolvedValueOnce({
      status: 'failed',
      error: { code: 'E001', message: 'Transcription error' },
    });

    await runAnalyzeAudioStep(inProgressJob as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'audio', 'failed', {
      audio_error: 'E001: Transcription error',
    });
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
  });

  it('does nothing (no markStep, no retry) when poll returns processing', async () => {
    const inProgressJob = {
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: 'tw-task-abc',
    };

    mocks.audioProvider.poll.mockResolvedValueOnce({
      status: 'processing',
      progress: 45,
    });

    await runAnalyzeAudioStep(inProgressJob as any);

    expect(mocks.audioProvider.poll).toHaveBeenCalledWith('tw-task-abc');
    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('does nothing (no markStep, no retry) when poll returns pending', async () => {
    const inProgressJob = {
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: 'tw-task-pend',
    };

    mocks.audioProvider.poll.mockResolvedValueOnce({ status: 'pending' });

    await runAnalyzeAudioStep(inProgressJob as any);

    expect(mocks.markStepMock).not.toHaveBeenCalled();
    expect(mocks.incrementRetryMock).not.toHaveBeenCalled();
  });

  it('marks failed and increments retry when poll throws', async () => {
    const inProgressJob = {
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: 'tw-task-throw',
    };

    mocks.audioProvider.poll.mockRejectedValueOnce(new Error('Network timeout'));

    await runAnalyzeAudioStep(inProgressJob as any);

    expect(mocks.markStepMock).toHaveBeenCalledWith('j1', 'audio', 'failed', {
      audio_error: expect.stringContaining('Network timeout'),
    });
    expect(mocks.incrementRetryMock).toHaveBeenCalledWith('j1');
  });

  // ------------------------------------------------------------------
  // Early-return / guard conditions
  // ------------------------------------------------------------------

  it('returns early when download_status is not done', async () => {
    await runAnalyzeAudioStep({ ...baseJob, download_status: 'pending' } as any);

    expect(mocks.audioProvider.submit).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when cos_url is null even if download_status is done', async () => {
    await runAnalyzeAudioStep({ ...baseJob, cos_url: null } as any);

    expect(mocks.audioProvider.submit).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when audio_status is already done', async () => {
    await runAnalyzeAudioStep({ ...baseJob, audio_status: 'done' } as any);

    expect(mocks.audioProvider.submit).not.toHaveBeenCalled();
    expect(mocks.audioProvider.poll).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when audio_status is failed (do not retry without explicit trigger)', async () => {
    await runAnalyzeAudioStep({ ...baseJob, audio_status: 'failed' } as any);

    expect(mocks.audioProvider.submit).not.toHaveBeenCalled();
    expect(mocks.audioProvider.poll).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });

  it('returns early when audio_status is in_progress but audio_task_id is null', async () => {
    await runAnalyzeAudioStep({
      ...baseJob,
      audio_status: 'in_progress' as const,
      audio_task_id: null,
    } as any);

    expect(mocks.audioProvider.poll).not.toHaveBeenCalled();
    expect(mocks.markStepMock).not.toHaveBeenCalled();
  });
});
