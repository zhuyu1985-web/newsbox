# Change: 增强视频抓取存储功能

## Why
当前系统支持通过 URL 抓取视频元数据（标题、缩略图、时长等），但视频文件本身仍存储在原始平台。用户希望能够从抖音、B站等平台抓取视频时，将视频文件下载并存储到 Supabase Storage，形成完整的新闻笔记，确保视频内容的持久化和离线访问能力。

## What Changes
- **新增视频文件下载能力**：当抓取视频 URL（如抖音、B站）时，系统应尝试下载视频文件
- **视频文件存储到 Supabase Storage**：下载的视频文件存储到 `user-files` bucket，路径格式为 `{user_id}/videos/{timestamp}-{sanitized_filename}.{ext}`
- **更新笔记记录**：视频文件存储后，更新笔记的 `media_url` 字段为 Supabase Storage 的公开 URL
- **支持视频新闻抓取入库**：视频类型的新闻也可以像普通新闻一样抓取入库，形成完整的新闻笔记
- **错误处理**：当视频下载失败时，系统应优雅降级，保留原始视频 URL 和元数据

## Impact
- **Affected specs**: `capture` - 需要增强视频抓取能力
- **Affected code**: 
  - `app/api/capture/route.ts` - 添加视频下载逻辑
  - Supabase Storage 配置 - 确保 `user-files` bucket 支持视频文件存储
  - 数据库无需修改（已有 `media_url` 字段）


