-- 026_add_user_notes_field.sql
-- 用户在视频详情页右栏笔记区写的内容（Tiptap JSON 格式）
-- 与现有 notes.content 区分：content 是导入的源内容，user_notes 是用户输出

ALTER TABLE notes
  ADD COLUMN user_notes JSONB,
  ADD COLUMN user_notes_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN notes.user_notes IS 'Tiptap JSON document — 用户在视频详情页写的笔记';
COMMENT ON COLUMN notes.user_notes_updated_at IS '笔记最后更新时间，用于乐观锁';
