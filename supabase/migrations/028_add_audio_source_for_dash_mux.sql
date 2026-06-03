-- 028_add_audio_source_for_dash_mux.sql
-- 支持 B 站等 DASH 分轨视频：浏览器分别下载音频与视频 m4s 并各自上传到 COS，
-- 转码阶段用 COS CI <AudioMix> 把两路重新合流到一个 mp4。
--
-- 不影响存量数据：新列默认为 NULL；当 audio_cos_key 为 NULL 时，
-- step-transcode 沿用既有单轨逻辑。

ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS source_audio_url text,
  ADD COLUMN IF NOT EXISTS audio_cos_key text,
  ADD COLUMN IF NOT EXISTS audio_cos_url text;

COMMENT ON COLUMN video_jobs.source_audio_url IS
  'B 站等 DASH 分轨视频的音频原始 URL；与 source_video_url 同源不同流';
COMMENT ON COLUMN video_jobs.audio_cos_key IS
  '浏览器上传后写入 COS 的音频 key；非 NULL 表示转码需要 AudioMix 合流';
COMMENT ON COLUMN video_jobs.audio_cos_url IS
  '音频 COS 公开 URL，便于后续监控与排查';
