// tests/lib/workers/video-pipeline/reconcile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --------------------------------------------------------------------------
// Hoisted mocks — must be hoisted so vi.mock factories can reference them
// --------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const updateCalls: Array<{ data: Record<string, unknown>; noteId: string }> = [];
  return {
    selectSingleMock: vi.fn(),
    // Captures every notes update call for later inspection
    updateCalls,
    notesUpdateEqMock: vi.fn().mockImplementation((_col: string, noteId: string) => {
      return Promise.resolve({ error: null });
    }),
    notesUpdateMock: vi.fn().mockImplementation((data: Record<string, unknown>) => {
      return { eq: (_col: string, noteId: string) => {
        updateCalls.push({ data, noteId });
        return Promise.resolve({ error: null });
      }};
    }),
  };
});

vi.mock('@/lib/supabase/server-service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'video_jobs') {
        return {
          select: () => ({
            eq: () => ({
              single: mocks.selectSingleMock,
            }),
          }),
        };
      }
      if (table === 'notes') {
        return {
          update: mocks.notesUpdateMock,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { reconcileJob } from '@/lib/workers/video-pipeline/reconcile';

// --------------------------------------------------------------------------
// Helper: build a VideoJob row with sensible defaults (all done/happy path)
// --------------------------------------------------------------------------
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    note_id: 'note-1',
    download_status: 'done',
    audio_status: 'done',
    visual_status: 'done',
    probe_status: 'done',
    cover_status: 'done',
    frame_status: 'done',
    retry_count: 0,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------
describe('reconcileJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateCalls.length = 0;
  });

  // -------------------------------------------------------------------------
  // Scenario 1: all steps done → fully_ready + video_ready_at written
  // -------------------------------------------------------------------------
  it('sets fully_ready and writes video_ready_at when all steps are done', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({ data: makeJob(), error: null });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('fully_ready');
    expect(data.video_ready_at).toBeDefined();
    expect(typeof data.video_ready_at).toBe('string');
  });

  // -------------------------------------------------------------------------
  // Scenario 2: download done, audio in_progress → media_ready (no video_ready_at)
  // -------------------------------------------------------------------------
  it('sets media_ready when download is done but audio is still in_progress', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({ audio_status: 'in_progress', visual_status: 'pending' }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('media_ready');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 3: visual skipped + download/audio done → fully_ready
  // -------------------------------------------------------------------------
  it('sets fully_ready when visual is skipped but download and audio are done', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({ visual_status: 'skipped' }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('fully_ready');
    expect(data.video_ready_at).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 4: visual failed + download/audio done → fully_ready (visual does not block)
  // -------------------------------------------------------------------------
  it('sets fully_ready when visual failed but download and audio are done (visual does not block)', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({ visual_status: 'failed', retry_count: 0 }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('fully_ready');
    expect(data.video_ready_at).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 5: download need_browser_fallback → need_browser_fallback
  // (higher priority than failed — user can retry via browser extension)
  // -------------------------------------------------------------------------
  it('sets need_browser_fallback when download_status is need_browser_fallback', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({
        download_status: 'need_browser_fallback',
        audio_status: 'pending',
        visual_status: 'pending',
        retry_count: 3,  // even with retry_count >= 3, browser fallback wins
      }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('need_browser_fallback');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 6: audio failed with retry_count >= 3 → failed
  // -------------------------------------------------------------------------
  it('sets failed when audio_status is failed and retry_count >= 3', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({
        download_status: 'done',
        audio_status: 'failed',
        visual_status: 'done',
        retry_count: 3,
      }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('failed');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 7: download failed with retry_count >= 3 → failed
  // -------------------------------------------------------------------------
  it('sets failed when download_status is failed and retry_count >= 3', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({
        download_status: 'failed',
        audio_status: 'pending',
        visual_status: 'pending',
        retry_count: 4,
      }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('failed');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 8: audio failed but retry_count < 3 → processing (not failed yet)
  // -------------------------------------------------------------------------
  it('sets processing when a step is failed but retry_count < 3', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({
        download_status: 'in_progress',
        audio_status: 'failed',
        visual_status: 'pending',
        retry_count: 2,
      }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('processing');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 9: everything pending → processing (default fallthrough)
  // -------------------------------------------------------------------------
  it('sets processing when all steps are still pending (default)', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: makeJob({
        download_status: 'pending',
        audio_status: 'pending',
        visual_status: 'pending',
        probe_status: 'pending',
        cover_status: 'pending',
        frame_status: 'pending',
        retry_count: 0,
      }),
      error: null,
    });

    await reconcileJob('job-1');

    expect(mocks.updateCalls).toHaveLength(1);
    const { data } = mocks.updateCalls[0];
    expect(data.video_overall_status).toBe('processing');
    expect(data.video_ready_at).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 10: DB fetch error → throws
  // -------------------------------------------------------------------------
  it('throws when the job fetch returns an error', async () => {
    mocks.selectSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'row not found' },
    });

    await expect(reconcileJob('job-1')).rejects.toThrow('row not found');
  });
});
