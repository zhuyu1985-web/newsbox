// tests/lib/workers/video-pipeline/scheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted ensures they are available inside vi.mock factory
// ---------------------------------------------------------------------------
const {
  fetchPendingJobsMock,
  refetchJobMock,
  runDownloadStepMock,
  runProbeAndCoverStepMock,
  runTranscodeStepMock,
  runAnalyzeAudioStepMock,
  runExtractFramesStepMock,
  runAnalyzeVisualStepMock,
  reconcileJobMock,
} = vi.hoisted(() => ({
  fetchPendingJobsMock: vi.fn(),
  refetchJobMock: vi.fn(),
  runDownloadStepMock: vi.fn(),
  runProbeAndCoverStepMock: vi.fn(),
  runTranscodeStepMock: vi.fn(),
  runAnalyzeAudioStepMock: vi.fn(),
  runExtractFramesStepMock: vi.fn(),
  runAnalyzeVisualStepMock: vi.fn(),
  reconcileJobMock: vi.fn(),
}));

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  fetchPendingJobs: fetchPendingJobsMock,
  refetchJob: refetchJobMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-download', () => ({
  runDownloadStep: runDownloadStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-probe-and-cover', () => ({
  runProbeAndCoverStep: runProbeAndCoverStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-transcode', () => ({
  runTranscodeStep: runTranscodeStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-analyze-audio', () => ({
  runAnalyzeAudioStep: runAnalyzeAudioStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-extract-frames', () => ({
  runExtractFramesStep: runExtractFramesStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/step-analyze-visual', () => ({
  runAnalyzeVisualStep: runAnalyzeVisualStepMock,
}));

vi.mock('@/lib/workers/video-pipeline/reconcile', () => ({
  reconcileJob: reconcileJobMock,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up
// ---------------------------------------------------------------------------
import { startScheduler, stopScheduler, tick } from '@/lib/workers/video-pipeline/scheduler';

// ---------------------------------------------------------------------------
// Helper: minimal VideoJob fixture
// ---------------------------------------------------------------------------
function makeJob(id: string) {
  return {
    id,
    note_id: `note-${id}`,
    user_id: 'u1',
    source_url: `https://platform.com/v/${id}`,
    platform: 'bilibili',
    source_video_url: `https://cdn.example.com/${id}.mp4`,
    request_headers: null,
    download_strategy: 'server' as const,
    download_status: 'pending' as const,
    probe_status: 'pending' as const,
    cover_status: 'pending' as const,
    transcode_status: 'pending' as const,
    frame_status: 'pending' as const,
    audio_status: 'pending' as const,
    visual_status: 'pending' as const,
    cos_key: null,
    cos_url: null,
    size_bytes: null,
    download_error: null,
    probe_data: null,
    cover_url: null,
    frames: null,
    audio_task_id: null,
    audio_result: null,
    audio_error: null,
    visual_result: null,
    visual_error: null,
    transcode_job_id: null,
    transcoded_key: null,
    transcoded_url: null,
    retry_count: 0,
    next_retry_at: null,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Ensure all step mocks resolve successfully by default
    fetchPendingJobsMock.mockResolvedValue([]);
    // refetchJob returns a minimal stub by default — tests that care can override
    refetchJobMock.mockImplementation(async (id: string) => makeJob(id));
    runDownloadStepMock.mockResolvedValue(undefined);
    runProbeAndCoverStepMock.mockResolvedValue(undefined);
    runTranscodeStepMock.mockResolvedValue(undefined);
    runAnalyzeAudioStepMock.mockResolvedValue(undefined);
    runExtractFramesStepMock.mockResolvedValue(undefined);
    runAnalyzeVisualStepMock.mockResolvedValue(undefined);
    reconcileJobMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopScheduler();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. startScheduler / stopScheduler
  // -------------------------------------------------------------------------
  it('startScheduler registers an interval timer and stopScheduler clears it', async () => {
    startScheduler();
    // Interval should have been set — advance time past one interval
    const INTERVAL_MS = Number(process.env.VIDEO_WORKER_INTERVAL_MS || 10_000);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 100);
    // tick should have been triggered (fetchPendingJobs called at least once)
    expect(fetchPendingJobsMock).toHaveBeenCalled();

    stopScheduler();
    const callCount = fetchPendingJobsMock.mock.calls.length;
    // After stop, no more ticks should fire
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    expect(fetchPendingJobsMock.mock.calls.length).toBe(callCount);
  });

  it('startScheduler is idempotent — calling twice does not create a second interval', async () => {
    startScheduler();
    startScheduler(); // second call should be a no-op
    const INTERVAL_MS = Number(process.env.VIDEO_WORKER_INTERVAL_MS || 10_000);
    // Advance a few intervals; if two timers existed, calls would double
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2 + 100);
    // Exactly 2 ticks from a single interval over 2 intervals (+100ms buffer)
    expect(fetchPendingJobsMock.mock.calls.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 2. tick(): step ordering for a single job
  // -------------------------------------------------------------------------
  it('tick processes steps in the correct order: download → probe → transcode → audio → frame → visual → reconcile', async () => {
    const job = makeJob('j1');
    fetchPendingJobsMock.mockResolvedValue([job]);
    const callOrder: string[] = [];

    runDownloadStepMock.mockImplementation(async () => { callOrder.push('download'); });
    runProbeAndCoverStepMock.mockImplementation(async () => { callOrder.push('probe'); });
    runTranscodeStepMock.mockImplementation(async () => { callOrder.push('transcode'); });
    runAnalyzeAudioStepMock.mockImplementation(async () => { callOrder.push('audio'); });
    runExtractFramesStepMock.mockImplementation(async () => { callOrder.push('frame'); });
    runAnalyzeVisualStepMock.mockImplementation(async () => { callOrder.push('visual'); });
    reconcileJobMock.mockImplementation(async () => { callOrder.push('reconcile'); });

    await tick();

    expect(callOrder).toEqual(['download', 'probe', 'transcode', 'audio', 'frame', 'visual', 'reconcile']);
    expect(reconcileJobMock).toHaveBeenCalledWith('j1');
  });

  // -------------------------------------------------------------------------
  // 3. tick(): concurrency guard
  // -------------------------------------------------------------------------
  it('concurrent tick invocations are dropped while the first is still running', async () => {
    const job = makeJob('j2');
    fetchPendingJobsMock.mockResolvedValue([job]);

    // Make runDownloadStep slow — it will hold the 'running' flag
    let resolveDownload!: () => void;
    runDownloadStepMock.mockReturnValue(
      new Promise<void>((res) => { resolveDownload = res; })
    );

    // Start the first tick (will suspend at runDownloadStep)
    const tick1 = tick();

    // Second tick should return immediately (running === true)
    const tick2 = tick();

    // Resolve the second tick first — it should have been a no-op
    await tick2;
    // fetchPendingJobs should only have been called once so far
    expect(fetchPendingJobsMock).toHaveBeenCalledTimes(1);

    // Now let the first tick finish
    resolveDownload();
    await tick1;

    // Still only one call total
    expect(fetchPendingJobsMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 4. tick(): error isolation — one job failing does not prevent others
  // -------------------------------------------------------------------------
  it('error in one job does not prevent subsequent jobs from being processed', async () => {
    const job1 = makeJob('bad-job');
    const job2 = makeJob('good-job');
    fetchPendingJobsMock.mockResolvedValue([job1, job2]);

    // job1's download throws
    runDownloadStepMock
      .mockRejectedValueOnce(new Error('download exploded'))
      .mockResolvedValueOnce(undefined);

    // job2 should still be processed — track its reconcile call
    const processedIds: string[] = [];
    reconcileJobMock.mockImplementation(async (id: string) => { processedIds.push(id); });

    await tick();

    // job2 should still have gone through reconcile despite job1 failing
    expect(processedIds).toContain('good-job');
  });

  // -------------------------------------------------------------------------
  // 5. tick(): multiple jobs are all processed
  // -------------------------------------------------------------------------
  it('tick processes every job returned by fetchPendingJobs', async () => {
    const jobs = [makeJob('a'), makeJob('b'), makeJob('c')];
    fetchPendingJobsMock.mockResolvedValue(jobs);

    await tick();

    expect(reconcileJobMock).toHaveBeenCalledTimes(3);
    expect(reconcileJobMock).toHaveBeenCalledWith('a');
    expect(reconcileJobMock).toHaveBeenCalledWith('b');
    expect(reconcileJobMock).toHaveBeenCalledWith('c');
  });
});
