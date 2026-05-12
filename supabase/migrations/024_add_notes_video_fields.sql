-- 024_add_notes_video_fields.sql
-- notes 表新增视频相关字段，由 worker 在状态推进时同步维护
-- 详见 docs/superpowers/specs/2026-05-12-video-and-storage-design.md §4.5

ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_job_id uuid REFERENCES video_jobs(id);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_ready_at timestamptz;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_overall_status text
  CHECK (video_overall_status IN ('processing', 'media_ready', 'fully_ready', 'failed', 'need_browser_fallback'));

-- 视频笔记卡片轮询用：只扫尚未 fully_ready 的视频笔记
CREATE INDEX IF NOT EXISTS idx_notes_video_overall_status
  ON notes (video_overall_status)
  WHERE video_overall_status IS NOT NULL AND video_overall_status != 'fully_ready';
