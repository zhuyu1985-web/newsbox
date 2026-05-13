// lib/workers/video-pipeline/step-probe-and-cover.ts
import { getStorageProvider, hasMediaProcessing, buildStorageKey } from '@/lib/storage';
import { createServiceClient } from '@/lib/supabase/server-service';
import { markStep, isStale } from './db';
import type { VideoJob } from './types';

const STALENESS_MS = 10 * 60_000;

export async function runProbeAndCoverStep(job: VideoJob): Promise<void> {
  // Precondition: download must be complete and cos_key must exist
  if (job.download_status !== 'done' || !job.cos_key) return;

  const provider = getStorageProvider();

  // Supabase adapter has no CI capability — skip both steps
  if (!hasMediaProcessing(provider)) {
    await markStep(job.id, 'probe', 'skipped');
    await markStep(job.id, 'cover', 'skipped');
    return;
  }

  // --- probe step ---
  const probeReady =
    job.probe_status === 'pending' ||
    (job.probe_status === 'in_progress' && isStale(job.updated_at, STALENESS_MS));

  if (probeReady) {
    try {
      await markStep(job.id, 'probe', 'in_progress');
      const info = await provider.probe(job.cos_key);
      await markStep(job.id, 'probe', 'done', { probe_data: info });

      // Sync duration to notes table
      const supabase = createServiceClient();
      await supabase
        .from('notes')
        .update({ media_duration: Math.round(info.durationSec) })
        .eq('id', job.note_id);
    } catch {
      await markStep(job.id, 'probe', 'failed');
    }
  }

  // --- cover step (independent of probe success) ---
  const coverReady =
    job.cover_status === 'pending' ||
    (job.cover_status === 'in_progress' && isStale(job.updated_at, STALENESS_MS));

  if (coverReady) {
    try {
      await markStep(job.id, 'cover', 'in_progress');
      const outKey = buildStorageKey({ userId: job.user_id, kind: 'covers', ext: 'jpg' });
      const cover = await provider.generateSmartCover({
        sourceKey: job.cos_key,
        outputKey: outKey,
      });
      await markStep(job.id, 'cover', 'done', { cover_url: cover.url });
    } catch {
      await markStep(job.id, 'cover', 'failed');
    }
  }
}
