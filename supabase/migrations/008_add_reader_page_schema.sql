-- ============================================================================
-- Migration 008: 沉浸式新闻笔记阅读详情页
-- Description: 添加网页存档、视频章节、转写、阅读进度、用户设置等表，并扩展现有表
-- Created: 2025-12-29
-- ============================================================================

-- ============================================================================
-- 1. 新增表
-- ============================================================================

-- 1.1 web_archives: 网页存档
CREATE TABLE IF NOT EXISTS web_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  snapshot_url TEXT NOT NULL,          -- Supabase Storage URL
  screenshot_url TEXT,                  -- 全页截图URL
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT web_archives_note_id_unique UNIQUE (note_id)
);

CREATE INDEX idx_web_archives_user_id ON web_archives(user_id);
CREATE INDEX idx_web_archives_note_id ON web_archives(note_id);

COMMENT ON TABLE web_archives IS '网页永久存档，用于证据留存和原链接失效后的访问';

-- 1.2 video_chapters: 视频章节
CREATE TABLE IF NOT EXISTS video_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,         -- 开始时间（秒）
  end_time INTEGER,                     -- 结束时间（秒）
  position INTEGER NOT NULL,            -- 章节顺序
  
  -- AI生成相关
  generated_by_ai BOOLEAN DEFAULT TRUE,
  confidence_score REAL,                -- AI生成置信度 (0-1)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_chapters_note_id ON video_chapters(note_id);
CREATE INDEX idx_video_chapters_note_id_position ON video_chapters(note_id, position);

COMMENT ON TABLE video_chapters IS '视频智能章节，支持AI自动生成和手动编辑';

-- 1.3 transcripts: ASR转写逐字稿
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  full_text TEXT NOT NULL,
  segments JSONB NOT NULL,              -- [{start, end, text, speaker}]
  
  -- ASR元数据
  language TEXT DEFAULT 'zh-CN',
  provider TEXT DEFAULT 'tencent',      -- tencent, openai-whisper
  audio_duration INTEGER,               -- 音频时长（秒）
  
  -- 状态
  status TEXT DEFAULT 'completed',      -- pending, processing, completed, failed
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT transcripts_note_id_unique UNIQUE (note_id)
);

CREATE INDEX idx_transcripts_note_id ON transcripts(note_id);
CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);

COMMENT ON TABLE transcripts IS 'ASR转写结果，包含完整文本和逐句时间戳';

-- 1.4 reading_progress: 阅读进度追踪
CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  scroll_position INTEGER DEFAULT 0,    -- 滚动位置（px）
  scroll_percentage REAL DEFAULT 0,     -- 阅读百分比 (0-100)
  video_position INTEGER,                -- 视频播放位置（秒）
  
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  read_count INTEGER DEFAULT 1,
  total_read_time INTEGER DEFAULT 0,    -- 累计阅读时长（秒）
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT reading_progress_user_note_unique UNIQUE (user_id, note_id)
);

CREATE INDEX idx_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX idx_reading_progress_note_id ON reading_progress(note_id);
CREATE INDEX idx_reading_progress_last_read_at ON reading_progress(last_read_at DESC);

COMMENT ON TABLE reading_progress IS '阅读进度记录，支持断点续读和统计';

-- 1.5 user_settings: 用户阅读器设置
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 阅读器设置
  reader_preferences JSONB DEFAULT '{
    "fontSize": 16,
    "lineHeight": 1.8,
    "fontFamily": "system",
    "theme": "auto",
    "maxWidth": 800,
    "margin": "comfortable"
  }'::jsonb,
  
  -- 视频设置
  video_preferences JSONB DEFAULT '{
    "subtitleSize": 16,
    "subtitleOpacity": 0.9,
    "defaultSpeed": 1.0,
    "autoplay": false,
    "backgroundBlur": true
  }'::jsonb,
  
  -- AI设置
  ai_preferences JSONB DEFAULT '{
    "autoGenerate": true,
    "language": "zh-CN"
  }'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

COMMENT ON TABLE user_settings IS '用户全局阅读器偏好设置';

-- ============================================================================
-- 2. 扩展现有表
-- ============================================================================

-- 2.1 扩展 notes 表
DO $$ 
BEGIN
  -- reading_position
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notes' AND column_name = 'reading_position'
  ) THEN
    ALTER TABLE notes ADD COLUMN reading_position INTEGER DEFAULT 0;
  END IF;

  -- read_percentage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notes' AND column_name = 'read_percentage'
  ) THEN
    ALTER TABLE notes ADD COLUMN read_percentage REAL DEFAULT 0;
  END IF;

  -- estimated_read_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notes' AND column_name = 'estimated_read_time'
  ) THEN
    ALTER TABLE notes ADD COLUMN estimated_read_time INTEGER;
    COMMENT ON COLUMN notes.estimated_read_time IS '预估阅读时间（分钟）';
  END IF;

  -- reader_preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notes' AND column_name = 'reader_preferences'
  ) THEN
    ALTER TABLE notes ADD COLUMN reader_preferences JSONB;
    COMMENT ON COLUMN notes.reader_preferences IS '单篇笔记的阅读器设置覆盖';
  END IF;
END $$;

-- 2.2 扩展 ai_outputs 表
DO $$ 
BEGIN
  -- journalist_view
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_outputs' AND column_name = 'journalist_view'
  ) THEN
    ALTER TABLE ai_outputs ADD COLUMN journalist_view JSONB;
    COMMENT ON COLUMN ai_outputs.journalist_view IS '记者视角分析（消息源、利益相关方、偏见）';
  END IF;

  -- timeline
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_outputs' AND column_name = 'timeline'
  ) THEN
    ALTER TABLE ai_outputs ADD COLUMN timeline JSONB;
    COMMENT ON COLUMN ai_outputs.timeline IS '事件时间线';
  END IF;

  -- visual_summary
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_outputs' AND column_name = 'visual_summary'
  ) THEN
    ALTER TABLE ai_outputs ADD COLUMN visual_summary JSONB;
    COMMENT ON COLUMN ai_outputs.visual_summary IS '视频视觉摘要（关键帧、场景）';
  END IF;

  -- deepfake_warning
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_outputs' AND column_name = 'deepfake_warning'
  ) THEN
    ALTER TABLE ai_outputs ADD COLUMN deepfake_warning JSONB;
    COMMENT ON COLUMN ai_outputs.deepfake_warning IS 'AI生成内容预警';
  END IF;
END $$;

-- 2.3 扩展 highlights 表（支持视频批注）
DO $$ 
BEGIN
  -- timecode
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'highlights' AND column_name = 'timecode'
  ) THEN
    ALTER TABLE highlights ADD COLUMN timecode INTEGER;
    COMMENT ON COLUMN highlights.timecode IS '视频高亮的时间戳（秒）';
  END IF;

  -- screenshot_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'highlights' AND column_name = 'screenshot_url'
  ) THEN
    ALTER TABLE highlights ADD COLUMN screenshot_url TEXT;
    COMMENT ON COLUMN highlights.screenshot_url IS '视频截帧URL';
  END IF;

  -- color (如果不存在)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'highlights' AND column_name = 'color'
  ) THEN
    ALTER TABLE highlights ADD COLUMN color TEXT DEFAULT 'yellow';
    COMMENT ON COLUMN highlights.color IS '高亮颜色';
  END IF;
END $$;

-- 2.4 扩展 annotations 表
DO $$ 
BEGIN
  -- timecode
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'annotations' AND column_name = 'timecode'
  ) THEN
    ALTER TABLE annotations ADD COLUMN timecode INTEGER;
    COMMENT ON COLUMN annotations.timecode IS '视频批注的时间戳（秒）';
  END IF;

  -- screenshot_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'annotations' AND column_name = 'screenshot_url'
  ) THEN
    ALTER TABLE annotations ADD COLUMN screenshot_url TEXT;
    COMMENT ON COLUMN annotations.screenshot_url IS '视频批注的截帧URL';
  END IF;

  -- is_floating (浮顶功能)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'annotations' AND column_name = 'is_floating'
  ) THEN
    ALTER TABLE annotations ADD COLUMN is_floating BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN annotations.is_floating IS '是否为浮顶批注';
  END IF;
END $$;

-- ============================================================================
-- 3. RLS (Row Level Security) Policies
-- ============================================================================

-- 3.1 web_archives RLS
ALTER TABLE web_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own archives"
  ON web_archives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own archives"
  ON web_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own archives"
  ON web_archives FOR DELETE
  USING (auth.uid() = user_id);

-- 3.2 video_chapters RLS
ALTER TABLE video_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chapters of their notes"
  ON video_chapters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create chapters for their notes"
  ON video_chapters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their chapters"
  ON video_chapters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their chapters"
  ON video_chapters FOR DELETE
  USING (auth.uid() = user_id);

-- 3.3 transcripts RLS
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transcripts"
  ON transcripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transcripts"
  ON transcripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcripts"
  ON transcripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transcripts"
  ON transcripts FOR DELETE
  USING (auth.uid() = user_id);

-- 3.4 reading_progress RLS
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reading progress"
  ON reading_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reading progress"
  ON reading_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading progress"
  ON reading_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading progress"
  ON reading_progress FOR DELETE
  USING (auth.uid() = user_id);

-- 3.5 user_settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Triggers (自动更新 updated_at)
-- ============================================================================

-- 4.1 video_chapters
CREATE OR REPLACE TRIGGER update_video_chapters_updated_at
  BEFORE UPDATE ON video_chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4.2 transcripts
CREATE OR REPLACE TRIGGER update_transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4.3 reading_progress
CREATE OR REPLACE TRIGGER update_reading_progress_updated_at
  BEFORE UPDATE ON reading_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4.4 user_settings
CREATE OR REPLACE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. 辅助函数
-- ============================================================================

-- 5.1 获取或创建用户设置（自动初始化）
CREATE OR REPLACE FUNCTION get_or_create_user_settings(p_user_id UUID)
RETURNS user_settings AS $$
DECLARE
  v_settings user_settings;
BEGIN
  SELECT * INTO v_settings FROM user_settings WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_settings;
  END IF;
  
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 更新阅读进度（upsert）
CREATE OR REPLACE FUNCTION upsert_reading_progress(
  p_user_id UUID,
  p_note_id UUID,
  p_scroll_position INTEGER DEFAULT NULL,
  p_scroll_percentage REAL DEFAULT NULL,
  p_video_position INTEGER DEFAULT NULL,
  p_read_time INTEGER DEFAULT 0
)
RETURNS reading_progress AS $$
DECLARE
  v_progress reading_progress;
BEGIN
  INSERT INTO reading_progress (
    user_id, note_id, scroll_position, scroll_percentage, 
    video_position, last_read_at, total_read_time
  )
  VALUES (
    p_user_id, p_note_id, 
    COALESCE(p_scroll_position, 0), 
    COALESCE(p_scroll_percentage, 0),
    p_video_position,
    NOW(),
    p_read_time
  )
  ON CONFLICT (user_id, note_id) DO UPDATE SET
    scroll_position = COALESCE(p_scroll_position, reading_progress.scroll_position),
    scroll_percentage = COALESCE(p_scroll_percentage, reading_progress.scroll_percentage),
    video_position = COALESCE(p_video_position, reading_progress.video_position),
    last_read_at = NOW(),
    read_count = reading_progress.read_count + 1,
    total_read_time = reading_progress.total_read_time + p_read_time,
    updated_at = NOW()
  RETURNING * INTO v_progress;
  
  RETURN v_progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. 索引优化
-- ============================================================================

-- 为 JSONB 字段创建 GIN 索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_transcripts_segments_gin ON transcripts USING gin(segments);
CREATE INDEX IF NOT EXISTS idx_user_settings_reader_preferences_gin ON user_settings USING gin(reader_preferences);

-- ============================================================================
-- 完成
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration 008: 沉浸式阅读页数据库架构已就绪';

