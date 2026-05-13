// tests/lib/workers/video-pipeline/db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to avoid hoisting errors when referencing mock fns inside vi.mock factory
const { fromMock, updateMock, eqMock, selectMock, limitMock, orderMock, orMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    updateMock: vi.fn(),
    eqMock: vi.fn(),
    selectMock: vi.fn(),
    limitMock: vi.fn(),
    orderMock: vi.fn(),
    orMock: vi.fn(),
  })
);

vi.mock('@/lib/supabase/server-service', () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

import { fetchPendingJobs, markStep, isStale } from '@/lib/workers/video-pipeline/db';

describe('isStale', () => {
  it('returns true when updated_at older than threshold', () => {
    const old = new Date(Date.now() - 31 * 60_000).toISOString();
    expect(isStale(old, 30 * 60_000)).toBe(true);
  });
  it('returns false when updated_at recent', () => {
    const recent = new Date().toISOString();
    expect(isStale(recent, 30 * 60_000)).toBe(false);
  });
});

describe('markStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      update: updateMock.mockReturnValue({
        eq: eqMock.mockResolvedValue({ error: null }),
      }),
    });
  });
  it('updates download status to in_progress', async () => {
    await markStep('job-1', 'download', 'in_progress');
    expect(updateMock).toHaveBeenCalledWith({ download_status: 'in_progress' });
    expect(eqMock).toHaveBeenCalledWith('id', 'job-1');
  });
  it('updates with extra fields', async () => {
    await markStep('job-1', 'audio', 'done', { audio_task_id: 'tw-x' });
    expect(updateMock).toHaveBeenCalledWith({ audio_status: 'done', audio_task_id: 'tw-x' });
  });
});

describe('fetchPendingJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      select: selectMock.mockReturnValue({
        or: orMock.mockReturnValue({
          order: orderMock.mockReturnValue({
            limit: limitMock.mockResolvedValue({ data: [{ id: 'j1' }, { id: 'j2' }], error: null }),
          }),
        }),
      }),
    });
  });
  it('returns up to 10 jobs needing work', async () => {
    const r = await fetchPendingJobs(10);
    expect(r).toHaveLength(2);
    expect(orMock).toHaveBeenCalled();
    expect(limitMock).toHaveBeenCalledWith(10);
  });
});
