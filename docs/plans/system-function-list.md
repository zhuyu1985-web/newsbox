# NewsBox 系统功能清单

生成日期：2026-06-04  
分析依据：当前代码仓库、Next.js routes、Supabase migrations、extension、worker、现有 docs/PRD/OpenSpec。  
状态标识：`已实现` 表示当前代码存在可运行链路；`部分实现` 表示已有表/接口/组件但生产闭环或成熟度不足；`待确认` 表示文档或代码有线索但当前主链路不清晰；`未见实现` 表示本次代码扫描未发现明确实现。

## 1. 模块总览

| 一级模块 | 二级模块 | 当前状态 | 主要入口/文件 |
| --- | --- | --- | --- |
| 用户与认证 | 登录、注册、找回密码、回调 | 已实现 | `app/auth/*` |
| 用户与认证 | Supabase session 刷新 | 已实现 | `proxy.ts`, `lib/supabase/proxy.ts` |
| 用户与认证 | 管理员用户管理 | 已实现 | `app/admin/*`, `app/api/admin/users` |
| 收藏工作台 | Dashboard 主界面 | 已实现 | `app/dashboard/page.tsx`, `components/dashboard/*` |
| 收藏工作台 | 多视图列表 | 已实现 | `components/dashboard/dashboard-content.tsx` |
| 收藏工作台 | 搜索、筛选、批量操作 | 已实现 | `components/dashboard/*` |
| 内容入库 | URL 收藏 | 已实现 | `/api/capture` |
| 内容入库 | 快速笔记 | 已实现 | Dashboard client logic |
| 内容入库 | 文件上传 | 已实现 | `/api/upload-cred`, storage adapters |
| 内容入库 | 浏览器扩展保存网页 | 已实现 | `extension/`, `/api/extension/save` |
| 内容入库 | 浏览器扩展保存视频 | 已实现 | `/api/extension/save-video`, `/api/extension/video-upload-*` |
| 内容组织 | 目录树 | 已实现 | `folders`, Dashboard |
| 内容组织 | 标签树 | 已实现 | `/api/tags`, `tags`, `note_tags` |
| 内容组织 | 星标、归档、删除、回收站 | 已实现 | `notes`, `/api/settings/trash` |
| 阅读器 | 文章阅读 | 已实现 | `/notes/[id]`, Reader components |
| 阅读器 | 高亮与批注 | 已实现 | `/api/highlights`, `annotations` |
| 阅读器 | 用户笔记 | 已实现 | `notes.user_notes` |
| 阅读器 | 导出 | 已实现 | `/api/notes/[id]/export` |
| 视频 | 视频任务管线 | 已实现 | `video_jobs`, `lib/workers/video-pipeline/*` |
| 视频 | 转写、章节、摘要 | 已实现 | 阿里听悟 adapter |
| 视频 | 关键帧、视觉分析 | 已实现 | COS CI, Qwen-VL adapter |
| AI | 单篇 AI 阅读 | 已实现 | `/api/ai/read` |
| AI | 单篇 AI 对话 | 已实现 | `/api/ai/chat` |
| AI | 视频问答/改写/翻译 | 已实现 | `/api/ai/video/*` |
| AI | AI 快照 | 已实现 | `/api/ai/snapshot*`, `ai_snapshots` |
| 知识库 | 知识搜索 | 已实现 | `/api/knowledge/search` |
| 知识库 | 知识问答 | 已实现 | `/api/knowledge/chat` |
| 知识库 | 智能主题 | 已实现但需调优 | `/api/knowledge/topics/*` |
| 知识库 | 知识图谱 | 部分实现 | `/api/knowledge/graph/rebuild`, graph components |
| 素材 | 金句/素材库 | 已实现 | `/api/quote-materials*` |
| 会员支付 | 会员状态 | 已实现 | `/api/membership/status` |
| 会员支付 | z-pay 订阅支付 | 已实现 | `/api/payment/*` |
| 增长 | 邀请码兑换 | 已实现 | `/api/settings/referral/*` |
| 设置 | 统计、回收站 | 已实现 | `/api/settings/stats`, `/api/settings/trash` |
| 分享协作 | 公开分享 | 待确认 | 有文档线索，主代码链路不清晰 |
| 团队协作 | 团队空间/多成员权限 | 未见实现 | 本次未发现完整实现 |

## 2. 用户与认证

### 2.1 登录

| 项 | 内容 |
| --- | --- |
| 功能 | 用户通过 Supabase Auth 登录 |
| 状态 | 已实现 |
| 入口 | `/auth/login` |
| 依赖 | Supabase Auth、浏览器 cookies |
| 验收 | 登录成功后可进入 `/dashboard` |

### 2.2 注册

| 项 | 内容 |
| --- | --- |
| 功能 | 用户注册账号 |
| 状态 | 已实现 |
| 入口 | `/auth/sign-up` |
| 后续动作 | 创建 profile、初始化试用期 |
| 验收 | 注册后可登录，并有试用会员状态 |

### 2.3 密码找回与更新

| 项 | 内容 |
| --- | --- |
| 功能 | 忘记密码、更新密码 |
| 状态 | 已实现 |
| 入口 | `/auth/forgot-password`, `/auth/update-password` |

### 2.4 管理员用户管理

| 项 | 内容 |
| --- | --- |
| 功能 | 列出、创建、更新密码、删除用户 |
| 状态 | 已实现 |
| 入口 | `/admin/users`, `/api/admin/users` |
| 鉴权 | Basic Auth + Service Role |
| 注意 | 创建/更新用户后会初始化 profile 和试用期 |

## 3. 收藏与内容入库

### 3.1 URL 收藏

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 创建基础 note | 已实现 | Dashboard 先插入基础记录 |
| URL 标准化 | 已实现 | `/api/capture` 内处理 |
| 平台 crawler | 已实现 | 腾讯/微信/头条等平台 crawler |
| Jina Reader 回退 | 已实现 | `JINA_API_KEY` 可增强 |
| 基础 fetch + Cheerio 回退 | 已实现 | 兜底提取 |
| 视频平台识别 | 已实现 | Bilibili/YouTube/抖音/快手等 |
| 抓取失败兜底 | 已实现 | 保留基础 note，返回错误 |

### 3.2 快速笔记

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 手动输入标题/内容 | 已实现 | Dashboard 添加模式 |
| 保存为 note | 已实现 | `source_type=manual` |
| HTML 内容生成 | 已实现 | 前端将文本段落转为内容 |

### 3.3 文件上传

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 获取上传凭证 | 已实现 | `/api/upload-cred` |
| 对象存储直传 | 已实现 | Supabase Storage/COS provider |
| 普通文件 note | 已实现 | 保存文件信息 |
| 视频上传后初始化 pipeline | 已实现 | `/api/ai/video/note/[noteId]/init-pipeline` |

### 3.4 浏览器扩展

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 扩展登录态 | 已实现 | `extension/src/shared` |
| 获取目录/标签 | 已实现 | `/api/extension/meta` |
| 保存网页 | 已实现 | `/api/extension/save` |
| 保存视频 | 已实现 | `/api/extension/save-video` |
| 视频直传凭证 | 已实现 | `/api/extension/video-upload-cred` |
| 上传完成通知 | 已实现 | `/api/extension/video-upload-done` |
| 平台视频识别 | 已实现 | Bilibili、抖音、快手、微博、微信视频号等 extractor |
| Safari Xcode 构建 | 已实现脚本 | `extension/package.json` |

## 4. 内容组织

### 4.1 目录

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 目录创建/展示 | 已实现 | `folders` |
| 父子目录 | 已实现 | `parent_id` |
| 颜色/图标 | 已实现 | `color`, `icon` |
| 排序 | 已实现 | `position` |
| 归档 | 已实现 | `archived_at` |
| 最近访问 | 已实现 | `last_accessed_at` |

### 4.2 标签

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 标签 CRUD | 已实现 | `/api/tags`, `/api/tags/[id]` |
| 层级标签 | 已实现 | `parent_id` |
| 颜色/图标/排序 | 已实现 | migrations 支持 |
| 标签归档 | 已实现 | `/api/tags/[id]/archive` |
| 标签绑定 note | 已实现 | `note_tags` |
| 标签排序稳定性 | 部分实现 | `/api/tags/reorder` 需补同级排序测试 |

### 4.3 星标、归档、删除

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 星标 | 已实现 | `notes.is_starred` |
| 归档 | 已实现 | `notes.archived_at` |
| 软删除 | 已实现 | `notes.deleted_at` |
| 回收站列表 | 已实现 | `/api/settings/trash` |
| 恢复 | 已实现 | `/api/settings/trash/[id]/restore` |
| 永久删除 | 已实现 | `DELETE /api/settings/trash/[id]` |

## 5. 阅读、标注与导出

### 5.1 阅读器

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| note 详情页 | 已实现 | `/notes/[id]` |
| 用户归属校验 | 已实现 | 页面/API 均有校验 |
| 阅读进度 | 已实现 | `reading_position`, `read_percentage`, `reading_progress` |
| 阅读偏好 | 已实现 | `reader_preferences`, `user_settings` |
| 服务端 initial data 复用 | 部分实现 | 服务端查询存在，但未完整传给客户端 wrapper |

### 5.2 高亮与批注

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 创建高亮 | 已实现 | `/api/highlights` |
| 查询高亮 | 已实现 | `/api/highlights` |
| 更新高亮 | 已实现 | `/api/highlights` |
| 删除高亮 | 已实现 | `/api/highlights` |
| 批注表 | 已实现 | `annotations` |
| 视频时间码/截图 | 已实现 | `highlights.timecode`, `screenshot_url` |

### 5.3 用户笔记

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 富文本笔记 | 已实现 | `notes.user_notes` |
| 更新时间 | 已实现 | `user_notes_updated_at` |
| 时间引用/关键帧引用导出 | 已实现 | export route 支持 Tiptap JSON 序列化 |

### 5.4 导出

| 格式 | 状态 | 内容 |
| --- | --- | --- |
| Markdown | 已实现 | 标题、原链接、关键词、摘要、章节、转写、我的笔记 |
| JSON | 已实现 | note JSON |
| SRT | 已实现 | 视频 transcript |

## 6. 视频能力

### 6.1 任务创建

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| URL 视频 note | 已实现 | `/api/capture` 识别 |
| 上传视频 note | 已实现 | Dashboard upload |
| 扩展视频任务 | 已实现 | `/api/extension/save-video` |
| 初始化 pipeline | 已实现 | `/api/ai/video/note/[noteId]/init-pipeline` |

### 6.2 Worker 阶段

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| download | 已实现 | 服务端下载或扩展直传 |
| probe | 已实现 | COS CI 获取媒体信息 |
| cover | 已实现 | COS CI 生成封面 |
| transcode | 已实现 | 需要时转 MP4/H264 |
| audio | 已实现 | 阿里听悟转写、章节、摘要、关键词、QA |
| frame | 已实现 | 抽关键帧 |
| visual | 已实现 | Qwen-VL 分析帧图，可跳过 |
| reconcile | 已实现 | 汇总为 `overall_status` |

### 6.3 用户侧视频 AI

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 处理状态查询 | 已实现 | `/api/ai/video/[jobId]/status` |
| 重试 | 已实现 | `/api/ai/video/[jobId]/retry` |
| 视频问答 | 已实现 | `/api/ai/video/ask` |
| 改写 | 已实现 | `/api/ai/video/rewrite` |
| 翻译 | 已实现 | `/api/ai/video/translate` |
| enrich | 已实现 | `/api/ai/video/[jobId]/enrich` |

## 7. AI 阅读

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| SSE 分阶段阅读 | 已实现 | `/api/ai/read` |
| 快速摘要 | 已实现 | `generateFlashRead` |
| 关键问题 | 已实现 | `generateKeyQuestions` |
| 深度分析 | 已实现 | `generateDeepAnalysis` |
| 结果缓存 | 已实现 | `ai_outputs` |
| 单篇聊天 | 已实现 | `/api/ai/chat` |
| 旧版 AI 分析 | 已实现但需统一权限 | `/api/ai/analyze` |
| AI 快照 | 已实现 | `ai_snapshots`, `ai_snapshot_renders` |

## 8. 知识库

### 8.1 搜索与问答

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 全库搜索 | 已实现 | `/api/knowledge/search` |
| 搜索 notes | 已实现 | 标题、正文、摘要 |
| 搜索 highlights | 已实现 | 高亮引文 |
| 搜索 annotations | 已实现 | 批注内容 |
| 搜索 transcripts | 已实现 | 视频转写 |
| 搜索 ai_outputs | 已实现 | AI 输出 |
| 知识问答 | 已实现 | `/api/knowledge/chat` |
| 引用 note | 已实现 | prompt 要求 `[note:<id>]` |

### 8.2 智能主题

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| note embedding | 已实现 | `knowledge_note_embeddings` |
| 聚类 | 已实现 | DBSCAN/KMeans |
| 主题命名 | 已实现 | LLM naming provider |
| 成员 upsert | 已实现 | `knowledge_topic_members` |
| 主题详情 | 已实现 | `/api/knowledge/topics/[id]` |
| 成员操作 | 已实现 | confirm/exclude/add/remove/set_time 等 |
| 置顶 | 已实现 | `/pin` |
| 归档 | 已实现 | `/archive` |
| 合并 | 已实现 | `/merge` |
| 主题报告 | 已实现 | `/report` |
| nightly refresh | 已实现 | `/nightly-refresh` |
| 主题质量 | 需调优 | 依赖模型、阈值、资料数量 |

### 8.3 知识图谱

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 实体表 | 已实现 | `knowledge_entities` |
| 关系表 | 已实现 | `knowledge_relationships` |
| note-entity 关联 | 已实现 | `knowledge_note_entities` |
| 图谱重建 API | 已实现 | `/api/knowledge/graph/rebuild` |
| 图谱 UI | 部分实现 | 存在组件和 mock/展示逻辑 |
| 产品闭环 | 部分实现 | 需要验证真实数据导航、引用回跳、增量更新 |

## 9. 素材库

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 素材列表 | 已实现 | `GET /api/quote-materials` |
| 新增素材 | 已实现 | `POST /api/quote-materials` |
| 删除素材 | 已实现 | `DELETE /api/quote-materials` |
| 自动提取 | 已实现 | `POST /api/quote-materials/extract` |
| 去重 | 已实现 | `content_hash` 和唯一约束 |
| 关联 note/highlight/annotation | 已实现 | 表字段支持 |

## 10. 设置、会员、支付与增长

### 10.1 设置统计

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| note/folder/tag/annotation 计数 | 已实现 | `/api/settings/stats` |
| 内容类型分布 | 已实现 | stats API |
| 常见域名 | 已实现 | stats API |
| AI token 估算 | 已实现 | 基于 AI 输出和快照估算 |
| 访问事件 | 已实现 | `note_visit_events` |

### 10.2 会员

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 14 天试用 | 已实现 | `initializeTrial` |
| Pro 计划 | 已实现 | `pro` |
| AI 计划 | 已实现 | `ai` |
| 会员状态查询 | 已实现 | `/api/membership/status` |
| AI 能力校验 | 已实现 | `requireAIMembership` |
| Pro 能力校验 | 已实现 | `requireProMembership` |

### 10.3 支付

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 创建订单 | 已实现 | `/api/payment/create` |
| z-pay 支付 URL | 已实现 | create API |
| 异步通知 | 已实现 | `/api/payment/notify` |
| 签名校验 | 已实现 | notify route |
| 金额校验 | 已实现 | notify route |
| 订单幂等 | 已实现 | 已支付订单重复通知不重复处理 |
| 会员顺延 | 已实现 | 从当前有效期或当前时间顺延一年 |

### 10.4 邀请

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 我的邀请码 | 已实现 | `/api/settings/referral/me` |
| 兑换邀请码 | 已实现 | `/api/settings/referral/redeem` |
| 被邀请人奖励 | 已实现 | 增加有效期 |
| 邀请人奖励 | 已实现 | 增加有效期 |
| 奖励上限 | 已实现 | 邀请人上限 49 天 |

## 11. 后台与运维

| 子功能 | 状态 | 说明 |
| --- | --- | --- |
| 视频 worker 开关 | 已实现 | `VIDEO_WORKER_ENABLED` |
| worker 调度间隔 | 已实现 | `VIDEO_WORKER_INTERVAL_MS` |
| worker 批量大小 | 已实现 | `VIDEO_WORKER_BATCH_SIZE` |
| worker 启动恢复 | 已实现 | `runRecovery()` |
| nightly topic refresh | 已实现 | cron secret |
| Service Role client | 已实现 | `lib/supabase/server-service.ts` |
| 管理员 Basic Auth | 已实现 | `lib/admin-auth` |

## 12. 主要差距与风险清单

| 编号 | 问题 | 当前判断 | 建议 |
| --- | --- | --- | --- |
| G-01 | Dashboard 单组件过大 | 影响长期维护 | 分阶段拆分数据 hook 与 UI 子组件 |
| G-02 | `/api/ai/analyze` 权限与新 AI 入口不一致 | 可能绕过 AI 会员策略 | 确认是否废弃或补会员校验 |
| G-03 | `/notes/[id]` 未在 proxy 层保护 | 页面/API 内部已校验，但边界分散 | 统一保护策略或补充注释说明 |
| G-04 | Note detail initial data 未复用 | 首屏重复请求 | 传递 initial note/folder/video job |
| G-05 | 标签排序同级筛选存在维护风险 | 排序可能异常 | 查询补 `parent_id`，增加测试 |
| G-06 | 视频 worker 多实例竞争 | 多实例部署可能重复处理 | 增加任务 lease/lock 或单 worker 部署 |
| G-07 | 知识图谱产品闭环不足 | 不宜作为核心承诺 | 先标为增强能力，补真实数据验收 |
| G-08 | 公开分享链路不清晰 | 文档线索多于当前代码主链路 | 需要单独做代码/需求核对 |
| G-09 | 团队协作未见实现 | 不属于当前产品能力 | 避免对外承诺团队空间 |
| G-10 | 支付环境变量未完全在 `.env.example` 中集中展示 | 上线配置易漏 | 补齐支付 env 文档和校验 |

## 13. 测试重点建议

| 测试域 | 高优先级用例 |
| --- | --- |
| 认证 | 未登录跳转、登录后访问、用户隔离、管理员 Basic Auth |
| 收藏 | URL 抓取成功/失败、重复 URL、扩展保存、上传失败恢复 |
| 组织 | 目录树、标签树、排序、归档、删除、恢复 |
| 阅读 | 高亮、批注、阅读进度、用户笔记、导出 |
| AI | 会员限制、SSE 中断、缓存复用、失败提示 |
| 视频 | 各 pipeline 阶段、重试、need_browser_fallback、SRT 导出 |
| 知识库 | 搜索召回、问答引用、主题重建、主题归档/合并 |
| 支付 | 创建订单、回调验签、金额不一致、重复通知、会员顺延 |
| 扩展 | 登录态、目录标签同步、网页保存、视频直传、浏览器权限 |

