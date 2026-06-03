-- 027_add_transcript_markers.sql
-- 视频详情页「标记」系统：用户对 transcript / QA / 发言人摘要的每段内容
-- 可以标记为「重点 / 问题 / 待办」；支持整段标记和选段（任意选中文字）两种粒度。
-- 多个 marker 可以并存（同一段可同时是「重点 + 问题」）。
-- Dashboard 主页可以按 marker_kind 过滤笔记。

CREATE TABLE transcript_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,

  -- 标记类型
  marker_kind text NOT NULL CHECK (marker_kind IN ('important', 'question', 'todo')),

  -- 标记来源：transcript=逐字稿；qa=问答对；speaker=发言人摘要
  target_type text NOT NULL CHECK (target_type IN ('transcript', 'qa', 'speaker')),

  -- 锚点（按 target_type 含义不同）
  segment_idx int,           -- transcript: 句子 idx；qa: 问答 idx；speaker: 该发言人 points 中的 idx
  speaker_id text,           -- speaker 类型时必填
  anchor_time numeric,       -- 跳转用的时间戳（秒），denormalized 便于排序

  -- 选段标记：null = 整段标记；非 null = 该段内的字符选区
  selection_start int,
  selection_end int,
  selection_text text,       -- 用户选中的原文，用于渲染重建（容错原文变动）

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transcript_markers_note_idx ON transcript_markers(note_id);
CREATE INDEX transcript_markers_user_kind_idx ON transcript_markers(user_id, marker_kind);
CREATE INDEX transcript_markers_target_idx ON transcript_markers(note_id, target_type, segment_idx);

-- RLS
ALTER TABLE transcript_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own markers"
  ON transcript_markers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own markers"
  ON transcript_markers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own markers"
  ON transcript_markers FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE transcript_markers IS '视频详情页的 transcript/QA/speaker 标记（重点/问题/待办），用于主页筛选和笔记摘取';
COMMENT ON COLUMN transcript_markers.selection_text IS '选段标记时保留的原文片段；整段标记此字段为 NULL';
COMMENT ON COLUMN transcript_markers.anchor_time IS '跳转时间锚点（秒），导出/列表按此排序';
