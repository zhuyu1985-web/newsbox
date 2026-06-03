-- 029_add_frame_transcode_errors.sql
--
-- 给 video_jobs 表补两列错误字段：
--   - frame_error: 抽帧失败原因（step-extract-frames 写入）
--   - transcode_error: 转码失败原因（step-transcode 多个分支写入）
--
-- 背景：原 schema 只有 download_error / audio_error，前端"AI 失败"徽章/
-- 详情页找不到 transcode/frame 失败的可读原因。补齐后用户可直接看到
-- "transcoded_key missing at done phase" / "CI returned done but HEAD
-- check failed" 这类断言式错误描述。

ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS frame_error text,
  ADD COLUMN IF NOT EXISTS transcode_error text;

-- 让 PostgREST 立即刷新 schema 缓存，避免 "Could not find column in schema cache"
NOTIFY pgrst, 'reload schema';
