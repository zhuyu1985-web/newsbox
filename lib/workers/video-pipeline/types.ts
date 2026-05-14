// lib/workers/video-pipeline/types.ts
export type VideoJobStepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
export type DownloadStatus = VideoJobStepStatus | 'need_browser_fallback';
export type DownloadStrategy = 'server' | 'browser';
export type OverallStatus =
  | 'processing'
  | 'media_ready'
  | 'fully_ready'
  | 'failed'
  | 'need_browser_fallback';

export interface VideoJob {
  id: string;
  note_id: string;
  user_id: string;
  source_url: string;
  platform: string;
  source_video_url: string;
  request_headers: Record<string, string> | null;
  download_strategy: DownloadStrategy;

  download_status: DownloadStatus;
  cos_key: string | null;
  cos_url: string | null;
  size_bytes: number | null;
  download_error: string | null;

  probe_status: VideoJobStepStatus;
  probe_data: any;

  cover_status: VideoJobStepStatus;
  cover_url: string | null;

  frame_status: VideoJobStepStatus;
  frames: any;

  audio_status: VideoJobStepStatus;
  audio_task_id: string | null;
  audio_result: any;
  audio_error: string | null;

  visual_status: VideoJobStepStatus;
  visual_result: any;
  visual_error: string | null;

  transcode_status: VideoJobStepStatus;
  transcode_job_id: string | null;
  transcoded_key: string | null;
  transcoded_url: string | null;

  retry_count: number;
  next_retry_at: string | null;
  updated_at: string;
}

export type StepName =
  | 'download' | 'probe' | 'cover' | 'transcode' | 'frame'
  | 'audio' | 'visual';
