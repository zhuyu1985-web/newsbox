// tests/lib/workers/video-pipeline/step-probe-and-cover.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  markStepMock,
  providerMock,
  getStorageProviderMock,
  notesUpdateEqMock,
  supabaseFromMock,
} = vi.hoisted(() => {
  const notesUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const supabaseFromMock = vi.fn();
  const providerMock = {
    probe: vi.fn(),
    generateSmartCover: vi.fn(),
  };
  // getStorageProvider is a vi.fn() so tests can override with mockReturnValueOnce
  const getStorageProviderMock = vi.fn(() => providerMock);
  return {
    markStepMock: vi.fn(),
    providerMock,
    getStorageProviderMock,
    notesUpdateEqMock,
    supabaseFromMock,
  };
});

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: markStepMock,
  isStale: () => false,
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: getStorageProviderMock,
  hasMediaProcessing: (p: any) => typeof p.probe === 'function',
  buildStorageKey: (input: any) =>
    `${input.userId}/${input.kind}/2026/05/12/cover.${input.ext}`,
}));

vi.mock('@/lib/supabase/server-service', () => ({
  createServiceClient: () => ({
    from: supabaseFromMock,
  }),
}));

import { runProbeAndCoverStep } from '@/lib/workers/video-pipeline/step-probe-and-cover';

/** Helper: configure supabaseFromMock for notes update chain */
function setupNotesUpdate() {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'notes') {
      return {
        update: vi.fn().mockReturnValue({
          eq: notesUpdateEqMock,
        }),
      };
    }
    return {};
  });
}

const baseJob = {
  id: 'j1',
  note_id: 'n1',
  user_id: 'u1',
  cos_key: 'u1/videos/2026/05/12/video.mp4',
  download_status: 'done' as const,
  probe_status: 'pending' as const,
  cover_status: 'pending' as const,
  updated_at: new Date().toISOString(),
};

const probeResult = {
  durationSec: 120,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  audioCodec: 'aac',
  sizeBytes: 50_000_000,
};

describe('runProbeAndCoverStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotesUpdate();
  });

  // Scenario 1: download_status='done' + probe/cover pending → both run and complete
  it('probes and generates cover when download is done and statuses are pending', async () => {
    providerMock.probe.mockResolvedValueOnce(probeResult);
    providerMock.generateSmartCover.mockResolvedValueOnce({
      key: 'u1/covers/2026/05/12/cover.jpg',
      url: 'https://cos.example.com/u1/covers/2026/05/12/cover.jpg',
    });

    await runProbeAndCoverStep(baseJob as any);

    // probe flow
    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'in_progress');
    expect(providerMock.probe).toHaveBeenCalledWith(baseJob.cos_key);
    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'done', {
      probe_data: probeResult,
    });

    // notes.media_duration sync
    expect(supabaseFromMock).toHaveBeenCalledWith('notes');
    expect(notesUpdateEqMock).toHaveBeenCalledWith('id', 'n1');

    // cover flow
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'in_progress');
    expect(providerMock.generateSmartCover).toHaveBeenCalledWith({
      sourceKey: baseJob.cos_key,
      outputKey: 'u1/covers/2026/05/12/cover.jpg',
    });
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'done', {
      cover_url: 'https://cos.example.com/u1/covers/2026/05/12/cover.jpg',
    });
  });

  // Scenario 2: download_status='pending' → early return, probe/cover not triggered
  it('returns early when download_status is not done', async () => {
    await runProbeAndCoverStep({
      ...baseJob,
      download_status: 'pending',
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.probe).not.toHaveBeenCalled();
    expect(providerMock.generateSmartCover).not.toHaveBeenCalled();
  });

  // Scenario 2b: cos_key is null → early return
  it('returns early when cos_key is null even if download is done', async () => {
    await runProbeAndCoverStep({
      ...baseJob,
      cos_key: null,
    } as any);

    expect(markStepMock).not.toHaveBeenCalled();
    expect(providerMock.probe).not.toHaveBeenCalled();
  });

  // Scenario 3: provider has no MediaProcessingCapability → both marked 'skipped'
  it('marks probe and cover as skipped when provider has no MediaProcessingCapability', async () => {
    // Override to a provider without probe (Supabase-style, no CI)
    getStorageProviderMock.mockReturnValueOnce({
      name: 'supabase',
      upload: vi.fn(),
      createUploadCredential: vi.fn(),
      getPublicUrl: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as any);

    await runProbeAndCoverStep(baseJob as any);

    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'skipped');
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'skipped');
    expect(providerMock.probe).not.toHaveBeenCalled();
    expect(providerMock.generateSmartCover).not.toHaveBeenCalled();
  });

  // Scenario 4: probe fails → probe marked 'failed', cover still runs
  it('marks probe failed but still attempts cover when probe throws', async () => {
    providerMock.probe.mockRejectedValueOnce(new Error('CI probe timeout'));
    providerMock.generateSmartCover.mockResolvedValueOnce({
      key: 'u1/covers/2026/05/12/cover.jpg',
      url: 'https://cos.example.com/u1/covers/2026/05/12/cover.jpg',
    });

    await runProbeAndCoverStep(baseJob as any);

    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'in_progress');
    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'failed');

    // Cover should still run
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'in_progress');
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'done', {
      cover_url: 'https://cos.example.com/u1/covers/2026/05/12/cover.jpg',
    });

    // notes.media_duration should NOT be updated when probe fails
    expect(notesUpdateEqMock).not.toHaveBeenCalled();
  });

  // Scenario 5: cover fails → cover marked 'failed'
  it('marks cover failed when generateSmartCover throws', async () => {
    providerMock.probe.mockResolvedValueOnce(probeResult);
    providerMock.generateSmartCover.mockRejectedValueOnce(new Error('CI cover generation failed'));

    await runProbeAndCoverStep(baseJob as any);

    // Probe should succeed
    expect(markStepMock).toHaveBeenCalledWith('j1', 'probe', 'done', {
      probe_data: probeResult,
    });
    // notes.media_duration synced from probe success
    expect(notesUpdateEqMock).toHaveBeenCalledWith('id', 'n1');

    // Cover should fail
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'in_progress');
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'failed');
    // cover_url should NOT be set
    const doneCallsWithCoverUrl = markStepMock.mock.calls.filter(
      ([, step, status]) => step === 'cover' && status === 'done'
    );
    expect(doneCallsWithCoverUrl).toHaveLength(0);
  });

  // Scenario 6: already completed statuses → skip re-execution
  it('skips probe when probe_status is done', async () => {
    await runProbeAndCoverStep({
      ...baseJob,
      probe_status: 'done',
      cover_status: 'done',
    } as any);

    expect(providerMock.probe).not.toHaveBeenCalled();
    expect(providerMock.generateSmartCover).not.toHaveBeenCalled();
    // markStep should NOT be called for already-done statuses
    const probeCalls = markStepMock.mock.calls.filter(([, step]) => step === 'probe');
    const coverCalls = markStepMock.mock.calls.filter(([, step]) => step === 'cover');
    expect(probeCalls).toHaveLength(0);
    expect(coverCalls).toHaveLength(0);
  });

  // Scenario 7: only cover is pending (probe already done)
  it('skips probe but runs cover when probe_status is done and cover is pending', async () => {
    providerMock.generateSmartCover.mockResolvedValueOnce({
      key: 'u1/covers/2026/05/12/cover.jpg',
      url: 'https://cos.example.com/u1/covers/2026/05/12/cover.jpg',
    });

    await runProbeAndCoverStep({
      ...baseJob,
      probe_status: 'done',
      cover_status: 'pending',
    } as any);

    expect(providerMock.probe).not.toHaveBeenCalled();
    expect(providerMock.generateSmartCover).toHaveBeenCalledOnce();
    expect(markStepMock).toHaveBeenCalledWith('j1', 'cover', 'done', expect.objectContaining({
      cover_url: expect.stringContaining('cos.example.com'),
    }));
  });
});
