# Design: 增强视频抓取存储功能

## Context
当前系统支持通过 URL 抓取视频元数据，但视频文件本身仍存储在原始平台。用户需要将视频文件下载并存储到 Supabase Storage，确保内容的持久化和离线访问。

## Goals / Non-Goals

### Goals
- 支持从主流视频平台（抖音、B站、快手、YouTube等）下载视频文件
- 将下载的视频文件存储到 Supabase Storage
- 更新笔记记录，使 `media_url` 指向 Supabase Storage 的 URL
- 确保视频新闻可以完整抓取入库

### Non-Goals
- 不支持实时视频流下载
- 不处理受版权保护的视频
- 不实现视频转码或格式转换
- 不实现批量视频下载

## Decisions

### Decision: 使用 yt-dlp 作为视频下载工具
**Rationale**: 
- yt-dlp 是 yt-dl 的活跃分支，支持大量视频平台（包括抖音、B站、YouTube 等）
- 跨平台支持，可以在 Node.js 环境中通过子进程调用
- 活跃维护，社区支持良好

**Alternatives considered**:
- puppeteer + 浏览器自动化：复杂且资源消耗大
- 各平台专用 API：需要维护多个集成，成本高
- 第三方视频下载服务：增加依赖和成本

### Decision: 视频文件存储路径结构
**Format**: `{user_id}/videos/{timestamp}-{sanitized_filename}.{ext}`

**Rationale**:
- 按用户隔离，便于权限管理
- `videos/` 子目录便于分类管理
- 时间戳前缀避免文件名冲突
- 文件名清理确保存储安全

**Example**: `550e8400-e29b-41d4-a716-446655440000/videos/1704067200000-my-video.mp4`

### Decision: 异步下载 + 后台处理
**Approach**: 
- 视频下载在后台异步进行
- 先创建笔记记录（包含原始 URL 和元数据）
- 下载完成后更新 `media_url` 字段

**Rationale**:
- 避免长时间阻塞 API 请求
- 提升用户体验（快速响应）
- 允许重试机制

**Alternatives considered**:
- 同步下载：会阻塞请求，超时风险高
- 队列系统：增加复杂度，当前阶段不必要

### Decision: 错误处理和降级策略
**Strategy**:
- 视频下载失败时，保留原始视频 URL 到 `source_url` 和 `media_url`
- 记录错误日志，但不影响笔记创建
- 后续可以手动重试下载

**Rationale**:
- 确保用户体验（笔记总是能创建成功）
- 允许后续修复和重试
- 避免因下载失败导致整个抓取流程失败

## Risks / Trade-offs

### Risk: 视频文件大小和存储成本
**Mitigation**: 
- 设置合理的文件大小限制（如 500MB）
- 考虑视频质量选项（优先下载较低质量以减少文件大小）
- 监控存储使用情况，必要时添加配额管理

### Risk: 视频平台反爬虫机制
**Mitigation**:
- 使用 yt-dlp 等成熟工具，它们已经处理了大部分反爬虫机制
- 实现重试机制和错误处理
- 考虑使用代理或延迟策略（如需要）

### Risk: 下载超时和性能问题
**Mitigation**:
- 设置合理的超时时间（如 5 分钟）
- 使用流式下载，避免内存溢出
- 考虑使用后台任务队列（如未来需要）

### Trade-off: 存储成本 vs 用户体验
- **选择**: 优先用户体验，允许视频存储
- **理由**: 用户明确需要视频持久化，存储成本可以通过配额管理控制

## Implementation Details

### 视频下载流程
1. 检测 URL 是否为视频平台 URL（通过域名匹配）
2. 调用 yt-dlp 下载视频文件到临时目录
3. 读取视频文件，上传到 Supabase Storage
4. 获取 Supabase Storage 的公开 URL
5. 更新笔记的 `media_url` 字段
6. 清理临时文件

### Supabase Storage 配置
- **Bucket**: `user-files`
- **路径前缀**: `{user_id}/videos/`
- **文件大小限制**: 500MB（可配置）
- **支持格式**: mp4, webm, mkv 等常见视频格式
- **RLS 策略**: 用户只能访问自己的文件

### API 修改
修改 `app/api/capture/route.ts`:
- 添加视频平台 URL 检测函数
- 添加视频下载函数（使用 yt-dlp）
- 添加视频上传到 Supabase Storage 的函数
- 在内容提取流程中，如果是视频类型，触发下载流程

## Migration Plan
- 无需数据库迁移（已有 `media_url` 字段）
- 需要安装 yt-dlp 依赖（通过 npm 或系统包管理器）
- 需要配置 Supabase Storage bucket（如未配置）

## Open Questions
- [ ] yt-dlp 在服务器环境中的安装和配置方式？
- [ ] 是否需要支持视频质量选择（高清/标清）？
- [ ] 是否需要实现视频下载进度追踪？
- [ ] 如何处理视频平台更新导致的下载失败？


