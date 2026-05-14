-- 025_add_transcode_columns.sql
-- 为 video_jobs 增加转码步骤字段（HEVC → H.264）
-- 当 probe 探测到非 H.264 编码时，调用 COS CI 转码，使视频在 Chrome/Firefox 可播放。

ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS transcode_status text NOT NULL DEFAULT 'pending'
    CHECK (transcode_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS transcode_job_id text,
  ADD COLUMN IF NOT EXISTS transcoded_key text,
  ADD COLUMN IF NOT EXISTS transcoded_url text;

-- 重建 active job 索引，加入 transcode_status 的活跃状态过滤
DROP INDEX IF EXISTS idx_video_jobs_active;

CREATE INDEX idx_video_jobs_active ON video_jobs (updated_at)
  WHERE download_status   IN ('pending', 'in_progress')
     OR probe_status      IN ('pending', 'in_progress')
     OR cover_status      IN ('pending', 'in_progress')
     OR transcode_status  IN ('pending', 'in_progress')
     OR frame_status      IN ('pending', 'in_progress')
     OR audio_status      IN ('pending', 'in_progress')
     OR visual_status     IN ('pending', 'in_progress');
