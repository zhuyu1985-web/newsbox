## 1. 数据库 Schema 与 Supabase 设置

- [x] 1.1 在 Supabase SQL Editor 中创建 ENUM 类型：content_type (article/video/audio), note_status (unread/reading/archived)
- [x] 1.2 创建 `folders` 表（收藏夹/分组），包含 user_id, name, description, color, position 等字段
- [x] 1.3 创建 `notes` 表（笔记/收藏条目），包含所有必要字段（source_url, content_type, title, content_html, content_text, media_url, media_duration, status 等）
- [x] 1.4 创建 `tags` 表（标签），包含 user_id, name, color 字段
- [x] 1.5 创建 `note_tags` 表（笔记-标签多对多关系），包含 note_id, tag_id 复合主键
- [x] 1.6 创建 `highlights` 表（高亮），包含 note_id, quote, range_start, range_end, range_data (JSONB), color 等字段
- [x] 1.7 创建 `annotations` 表（批注），包含 note_id, highlight_id (可选), content 字段
- [x] 1.8 创建 `ai_outputs` 表（AI 输出），包含 note_id, summary, key_questions (JSONB), transcript, model_name, provider 等字段
- [x] 1.9 创建所有必要的外键约束和唯一约束（如 notes 的 user_id + source_url 唯一约束）
- [x] 1.10 创建数据库索引：
  - 所有表的 user_id 索引
  - notes 表的 folder_id, status, created_at DESC 索引
  - notes 表的全文检索 GIN 索引（title + content_text）
  - note_tags 表的 note_id, tag_id 索引
  - highlights, annotations, ai_outputs 表的 note_id 索引
- [x] 1.11 配置 Row Level Security (RLS) 策略：
  - 为所有表启用 RLS
  - 创建 SELECT, INSERT, UPDATE, DELETE 策略，确保用户只能访问自己的数据
  - 为 note_tags 表创建特殊的策略（通过关联的 notes 或 tags 验证用户权限）
- [x] 1.12 创建更新时间戳触发器函数 `update_updated_at_column()`
- [x] 1.13 为 folders, notes, highlights, annotations, ai_outputs 表添加 updated_at 自动更新触发器
- [ ] 1.14 设置 Supabase Storage（如需要存储封面图等静态资源）
- [ ] 1.15 测试数据库权限：验证 RLS 策略是否正确工作，用户无法访问其他用户的数据

**注意**：数据库迁移文件已创建在 `supabase/migrations/001_initial_schema.sql`，需要在 Supabase Dashboard 的 SQL Editor 中执行。

## 2. 官网门户页面（Landing Page）

- [x] 2.1 创建产品介绍页面（Next.js App Router，根路径 `/`）
- [x] 2.2 设计并实现产品介绍内容（功能亮点、价值主张、产品截图/演示）
- [x] 2.3 实现导航到登录/注册页面的 CTA 按钮（使用 shadcn/ui 组件）
- [x] 2.4 实现响应式设计（移动端/桌面端适配）
- [x] 2.5 确保未认证用户可以访问官网页面
- [x] 2.6 集成动画库（Framer Motion 或 CSS animations）
- [x] 2.7 实现页面加载时的入场动画（hero section、功能卡片、CTA 按钮的渐入/滑入效果）
- [x] 2.8 实现滚动触发的动画效果（元素进入视口时的淡入、滑入、缩放动画）
- [x] 2.9 实现交互式悬停效果（按钮、卡片、链接的悬停动画和视觉反馈）
- [x] 2.10 实现背景动态效果（渐变变化、粒子效果或几何图案动画）
- [x] 2.11 优化动画性能（确保 60fps，避免布局偏移和滚动卡顿）
- [ ] 2.12 测试动画在不同设备和浏览器上的表现（桌面端、移动端、不同浏览器）

## 3. 认证与用户管理

- [x] 3.1 集成 Supabase Auth（邮箱/密码或 OAuth）
- [x] 3.2 创建用户注册页面（使用 shadcn/ui 组件：Form, Input, Button）
- [x] 3.3 创建用户登录页面（使用 shadcn/ui 组件）
- [x] 3.4 实现注册表单验证（邮箱格式、密码强度要求）
- [x] 3.5 实现登录表单验证和错误提示
- [x] 3.6 实现注册/登录成功后跳转到主界面（dashboard）
- [x] 3.7 实现受保护的路由和中间件（Next.js middleware）
- [x] 3.8 实现登出功能（清除会话，跳转到官网或登录页）

## 4. 主界面/仪表板（Dashboard）

- [x] 4.1 创建主界面页面（Next.js App Router，默认路由 `/dashboard`）
- [x] 4.2 实现主界面布局（导航栏、侧边栏、内容区域）
- [x] 4.3 实现主界面显示所有收藏的笔记/条目（默认视图）
- [x] 4.4 实现笔记卡片组件，根据内容类型（article/video/audio）显示不同样式
- [x] 4.5 实现图文内容卡片（显示标题、封面图、摘要、站点名、发布时间）
- [x] 4.6 实现视频内容卡片（显示标题、视频缩略图、时长、站点名、发布时间）
- [x] 4.7 实现音频内容卡片（显示标题、音频封面图、时长、站点名、发布时间）
- [x] 4.8 实现自定义分组（folders）侧边栏导航和筛选
- [x] 4.9 实现自定义标签筛选功能
- [x] 4.10 实现"全部"视图（显示所有内容，不受分组/标签限制）
- [ ] 4.11 实现从主界面导航到笔记详情页
- [ ] 4.12 实现从主界面访问采集功能（添加新内容）

## 5. 内容采集（Capture）

- [ ] 5.1 创建 URL 保存表单组件（shadcn/ui input + button）
- [ ] 5.2 实现前端 API 调用：保存 URL 到 notes 表（包含 contentType 字段）
- [ ] 5.3 创建 Supabase Edge Function：fetch-and-extract（抓取 URL 并解析内容）
- [ ] 5.4 实现内容类型自动检测逻辑（根据 URL 模式或页面元数据识别 article/video/audio）
- [ ] 5.5 实现图文内容解析逻辑（提取 title, author, contentHtml, contentText, coverImageUrl）
- [ ] 5.6 实现视频内容解析逻辑（提取 title, videoUrl, thumbnail, duration, siteName）
- [ ] 5.7 实现音频内容解析逻辑（提取 title, audioUrl, coverImage, duration, siteName）
- [ ] 5.8 添加解析失败的错误处理和重试机制
- [ ] 5.9 实现去重逻辑（相同 URL 短时间内不重复创建）

## 6. 笔记库界面（Library）

- [ ] 6.1 创建笔记列表页面（Next.js App Router，可与 dashboard 合并或作为独立视图）
- [ ] 6.2 实现笔记卡片组件（根据内容类型显示不同样式：图文/视频/音频）
- [ ] 6.3 实现自定义分组（folders）的创建和管理 UI
- [ ] 6.4 实现笔记移动到自定义分组的功能
- [ ] 6.5 实现自定义标签创建和分配 UI（使用 shadcn/ui tags/badges）
- [ ] 6.6 实现按自定义标签筛选功能
- [ ] 6.7 实现搜索功能（Supabase 全文检索或客户端过滤）
- [ ] 6.8 实现阅读状态管理（unread/reading/archived）和筛选

## 7. 阅读视图

- [ ] 7.1 创建笔记详情/阅读页面
- [ ] 7.2 实现图文内容渲染组件（支持 HTML 渲染，降级到 URL 跳转）
- [ ] 7.3 实现视频内容播放组件（嵌入视频播放器或跳转到源链接）
- [ ] 7.4 实现音频内容播放组件（嵌入音频播放器或跳转到源链接）
- [ ] 7.5 实现响应式布局（移动端/桌面端适配）

## 8. AI 摘要与关键问题（AI Summaries）

- [ ] 8.1 创建 Supabase Edge Function：generate-ai-summary
- [ ] 8.2 集成 AI API（OpenAI/Anthropic 等），实现图文内容的摘要生成
- [ ] 8.3 实现关键问题生成逻辑
- [ ] 8.4 创建 AI 输出存储逻辑（写入 ai_outputs 表，包含 transcript 字段）
- [ ] 8.5 实现前端 AI 输出展示组件（摘要 + 关键问题列表）
- [ ] 8.6 实现自动触发（内容提取成功后）和手动触发（按钮）
- [ ] 8.7 添加 AI 处理失败的错误处理和重试 UI
- [ ] 8.8 实现用户控制（禁用自动生成、删除 AI 输出）
- [ ] 8.9 集成视频字幕提取服务（YouTube Data API、Bilibili API 或通用字幕提取）
- [ ] 8.10 实现视频字幕提取逻辑（从视频 URL 获取字幕/转录文本）
- [ ] 8.11 集成语音转文字服务（OpenAI Whisper API、Google Speech-to-Text 等）
- [ ] 8.12 实现音频转文字逻辑（从音频 URL 获取转录文本）
- [ ] 8.13 实现视频内容的 AI 总结流程（字幕提取 → 文本总结 → 生成摘要和关键问题）
- [ ] 8.14 实现音频内容的 AI 总结流程（语音转文字 → 文本总结 → 生成摘要和关键问题）
- [ ] 8.15 添加视频/音频转录失败时的降级处理（使用元数据生成简要摘要）
- [ ] 8.16 实现转录文本的存储和展示（在阅读界面提供查看转录文本的功能）

## 9. 高亮与批注（Annotations）

- [ ] 9.1 实现文本选择监听和高亮创建 UI
- [ ] 9.2 创建 highlight 记录存储逻辑
- [ ] 9.3 实现高亮位置信息存储（DOM path + offsets 或 quote 匹配）
- [ ] 9.4 实现高亮在内容中的可视化渲染
- [ ] 9.5 创建批注（annotation）创建和编辑 UI
- [ ] 9.6 实现批注与高亮的关联存储
- [ ] 9.7 实现高亮/批注列表视图（侧边栏或弹窗）
- [ ] 9.8 实现高亮/批注的编辑和删除功能
- [ ] 9.9 实现高亮位置恢复逻辑（quote 匹配兜底）

## 10. 分享功能（Sharing）

- [ ] 10.1 实现分享按钮和菜单（shadcn/ui dropdown）
- [ ] 10.2 实现分享链接生成（内部链接或公开 URL）
- [ ] 10.3 实现复制链接到剪贴板功能
- [ ] 10.4 实现高亮引用分享（格式化 quote + source）
- [ ] 10.5 集成系统分享功能（Web Share API，移动端 Share Sheet）
- [ ] 10.6 实现公开/私有分享权限控制（如需要）

## 11. 测试与验证

- [ ] 11.1 编写单元测试：内容解析逻辑（图文/视频/音频）
- [ ] 11.2 编写单元测试：内容类型检测逻辑
- [ ] 11.3 编写单元测试：AI 摘要生成逻辑（图文/视频/音频）
- [ ] 11.3a 编写单元测试：视频字幕提取和转录逻辑
- [ ] 11.3b 编写单元测试：音频转文字逻辑
- [ ] 11.4 编写集成测试：端到端采集流程（从官网 → 注册 → 登录 → 采集 → 查看）
- [ ] 11.5 编写 E2E 测试：用户访问官网 → 注册 → 登录 → 保存 URL → 查看 → 标注 → 分享
- [ ] 11.6 编写 E2E 测试：多媒体内容采集（视频 URL、音频 URL）
- [ ] 11.7 验证 RLS 策略（确保用户数据隔离）
- [ ] 11.8 性能测试：大量笔记的列表渲染和搜索
- [ ] 11.9 测试自定义分组和标签的创建、分配、筛选功能

## 12. 文档与部署

- [ ] 12.1 编写用户文档：如何使用采集、标注、分享功能
- [ ] 12.2 编写用户文档：如何创建自定义分组和标签
- [ ] 12.3 编写开发者文档：Supabase Edge Functions 部署说明
- [ ] 12.4 配置环境变量（Supabase URL/Key、AI API Key 等）
- [ ] 12.5 部署 Next.js 应用到生产环境（Vercel 或其他平台）
- [ ] 12.6 部署 Supabase Edge Functions

