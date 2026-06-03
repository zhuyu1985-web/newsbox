"use client";
import useSWR from 'swr';

export type StepKey = 'download' | 'probe' | 'cover' | 'transcode' | 'frame' | 'audio' | 'visual';

export interface JobStatusResponse {
  jobId: string;
  noteId: string;
  overallStatus?: string | null;
  steps: Record<StepKey, string>;
  coverUrl?: string | null;
  errors?: {
    download?: string | null;
    transcode?: string | null;
    audio?: string | null;
    visual?: string | null;
  };
  retryCount?: number;
}

const STEPS: readonly StepKey[] = ['download', 'probe', 'cover', 'transcode', 'frame', 'audio', 'visual'] as const;
const STEP_LABELS: Record<StepKey, string> = {
  download: '视频下载',
  probe: '元信息探测',
  cover: '智能封面',
  transcode: '转码',
  frame: '关键帧抽取',
  audio: '字幕生成',
  visual: '视觉分析',
};

const TERMINAL = new Set(['done', 'failed', 'skipped']);

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
        const allTerminal = STEPS.every((s) => TERMINAL.has(latest.steps?.[s]));
        return allTerminal ? 0 : 5000;
      },
      refreshWhenHidden: false,
    }
  );

  const steps: AnalysisStep[] = STEPS.map((s) => ({
    key: s,
    label: STEP_LABELS[s],
    status: data?.steps?.[s] ?? 'pending',
  }));
  // failed 是终态，必须算进进度，否则一直卡在 ~83%（5/6）。
  // hasFailures 让 UI 区分"完成但有失败"vs"完全成功"。
  const terminalCount = steps.filter((s) => TERMINAL.has(s.status)).length;
  const overallPercent = Math.round((terminalCount / STEPS.length) * 100);
  const isComplete = terminalCount === STEPS.length;
  const hasFailures = steps.some((s) => s.status === 'failed');

  return { steps, overallPercent, isComplete, hasFailures, error, refetch: mutate, data };
}
