"use client";
import useSWR from 'swr';

type StepKey = 'download' | 'probe' | 'cover' | 'frame' | 'audio' | 'visual';

interface JobStatusResponse {
  jobId: string;
  noteId: string;
  steps: Record<StepKey, string>;
  coverUrl?: string | null;
  errors?: {
    download?: string | null;
    audio?: string | null;
    visual?: string | null;
  };
  retryCount?: number;
}

const STEPS: readonly StepKey[] = ['download', 'probe', 'cover', 'frame', 'audio', 'visual'] as const;
const STEP_LABELS: Record<StepKey, string> = {
  download: '视频下载',
  probe: '元信息探测',
  cover: '智能封面',
  frame: '关键帧抽取',
  audio: '字幕生成',
  visual: '视觉分析',
};

export interface AnalysisStep {
  key: StepKey;
  label: string;
  status: string;
}

export function useAnalysisProgress(jobId: string | null) {
  const { data, error, mutate } = useSWR<JobStatusResponse>(
    jobId ? `/api/ai/video/${jobId}/status` : null,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: (latest) => {
        if (!latest) return 5000;
        const allDone = STEPS.every((s) => {
          const v = latest.steps?.[s];
          return v === 'done' || v === 'failed' || v === 'skipped';
        });
        return allDone ? 0 : 5000;
      },
      refreshWhenHidden: false,
    }
  );

  const steps: AnalysisStep[] = STEPS.map((s) => ({
    key: s,
    label: STEP_LABELS[s],
    status: data?.steps?.[s] ?? 'pending',
  }));
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const overallPercent = Math.round((doneCount / STEPS.length) * 100);
  const isComplete = doneCount === STEPS.length;

  return { steps, overallPercent, isComplete, error, refetch: mutate, data };
}
