-- 023_add_video_jobs.sql
-- 视频抓取流水线状态机：每条视频笔记对应一行 video_jobs
-- 详见 docs/superpowers/specs/2026-05-12-video-and-storage-design.md §4.5

CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,

  -- 源信息
  source_url text NOT NULL,
  platform text NOT NULL,
  source_video_url text NOT NULL,
  request_headers jsonb,
  download_strategy text NOT NULL CHECK (download_strategy IN ('server', 'browser')),

  -- 下载阶段
  download_status text NOT NULL DEFAULT 'pending'
    CHECK (download_status IN ('pending', 'in_progress', 'done', 'failed', 'need_browser_fallback')),
  cos_key text,
  cos_url text,
  size_bytes bigint,
  download_error text,

  -- 元信息探测
  probe_status text NOT NULL DEFAULT 'pending'
    CHECK (probe_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  probe_data jsonb,

  -- 智能封面
  cover_status text NOT NULL DEFAULT 'pending'
    CHECK (cover_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  cover_url text,

  -- 关键帧抽取
  frame_status text NOT NULL DEFAULT 'pending'
    CHECK (frame_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  frames jsonb,

  -- 音频/文本分析（听悟）
  audio_status text NOT NULL DEFAULT 'pending'
    CHECK (audio_status IN ('pending', 'in_progress', 'done', 'failed')),
  audio_task_id text,
  audio_result jsonb,
  audio_error text,

  -- 视觉分析（Qwen-VL）
  visual_status text NOT NULL DEFAULT 'pending'
    CHECK (visual_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  visual_result jsonb,
  visual_error text,

  -- 重试控制
  retry_count int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- worker 扫表索引：只扫活跃 job
CREATE INDEX IF NOT EXISTS idx_video_jobs_active ON video_jobs (updated_at)
  WHERE download_status IN ('pending', 'in_progress')
     OR probe_status    IN ('pending', 'in_progress')
     OR cover_status    IN ('pending', 'in_progress')
     OR frame_status    IN ('pending', 'in_progress')
     OR audio_status    IN ('pending', 'in_progress')
     OR visual_status   IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_note_id ON video_jobs (note_id);

-- RLS：用户只能访问自己的 job
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_jobs_user_select" ON video_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_insert" ON video_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_update" ON video_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_delete" ON video_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 自动触发器
CREATE OR REPLACE FUNCTION trigger_set_video_jobs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_video_jobs_timestamp ON video_jobs;
CREATE TRIGGER set_video_jobs_timestamp
  BEFORE UPDATE ON video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_video_jobs_timestamp();
