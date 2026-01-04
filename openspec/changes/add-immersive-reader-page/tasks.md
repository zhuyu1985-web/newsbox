# Implementation Tasks: 沉浸式新闻笔记阅读详情页

## 1. 数据库Schema与迁移 (Day 1-2)

- [x] 1.1 创建迁移文件 `008_add_reader_page_schema.sql`
  - [x] 1.1.1 创建 `web_archives` 表及索引
  - [x] 1.1.2 创建 `video_chapters` 表及索引
  - [x] 1.1.3 创建 `transcripts` 表及索引
  - [x] 1.1.4 创建 `reading_progress` 表及索引
  - [x] 1.1.5 创建 `user_settings` 表及索引
  - [x] 1.1.6 扩展 `notes` 表字段
  - [x] 1.1.7 扩展 `ai_outputs` 表字段
  - [x] 1.1.8 扩展 `highlights` 表字段
  - [x] 1.1.9 扩展 `annotations` 表字段
- [x] 1.2 配置RLS policies
  - [x] 1.2.1 `web_archives` RLS策略
  - [x] 1.2.2 `video_chapters` RLS策略
  - [x] 1.2.3 `transcripts` RLS策略
  - [x] 1.2.4 `reading_progress` RLS策略
  - [x] 1.2.5 `user_settings` RLS策略
- [x] 1.3 创建triggers
  - [x] 1.3.1 `updated_at` 自动更新triggers
- [ ] 1.4 运行迁移并验证
  - [ ] 1.4.1 本地环境测试
  - [ ] 1.4.2 检查所有索引是否创建成功
  - [ ] 1.4.3 测试RLS策略是否生效

## 2. 基础路由与布局 (Day 3-5)

- [x] 2.1 创建路由结构
  - [x] 2.1.1 创建 `app/notes/[id]/read/page.tsx`
  - [x] 2.1.2 创建 `app/notes/[id]/read/layout.tsx`（可选）
  - [x] 2.1.3 实现权限检查（auth check）
- [x] 2.2 实现三栏布局容器
  - [x] 2.2.1 创建 `components/reader/ReaderLayout.tsx`
  - [x] 2.2.2 实现响应式Grid布局（CSS或Tailwind）
  - [x] 2.2.3 实现左右侧栏可收起功能
  - [x] 2.2.4 实现右侧面板标签页切换（批注列表|AI解读|视频听记）
  - [x] 2.2.5 实现右侧面板分屏模式（可选，同时显示多个面板）
  - [x] 2.2.6 实现禅模式（全屏，隐藏侧栏）
  - [x] 2.2.7 添加键盘快捷键（Esc退出禅模式）
- [x] 2.3 全局顶部导航栏
  - [x] 2.3.1 创建 `components/reader/GlobalHeader/index.tsx`
  - [x] 2.3.2 实现返回按钮和面包屑
  - [x] 2.3.3 实现阅读进度条（滚动百分比）
  - [x] 2.3.4 实现ViewSwitcher（4个Tab）
  - [x] 2.3.5 实现AppearanceMenu（Dropdown）
  - [x] 2.3.6 实现ActionMenu（更多操作）
- [x] 2.4 创建空白状态组件
  - [x] 2.4.1 Loading skeleton
  - [x] 2.4.2 Error boundary
  - [x] 2.4.3 Empty state

## 3. 图文阅读模式 (Day 6-10)

- [x] 3.1 Jina Reader API集成
  - [x] 3.1.1 创建 `lib/services/jina.ts`
  - [x] 3.1.2 实现 `POST /api/extract/jina` 路由
  - [x] 3.1.3 添加错误处理和重试逻辑
  - [x] 3.1.4 缓存提取结果 (直接存入 notes 表)
- [x] 3.2 ArticleReader组件
  - [x] 3.2.1 创建 `components/reader/ContentStage/ArticleReader.tsx`
  - [x] 3.2.2 实现MetaHeader（标题、来源媒体Icon+名称、作者、发布时间+抓取时间、标签、预估阅读时间）
  - [x] 3.2.3 实现ContentRenderer（HTML渲染+样式）
  - [x] 3.2.4 集成react-markdown（Markdown内容）
  - [x] 3.2.5 集成shiki代码高亮
  - [x] 3.2.6 图片referrerPolicy设置（防盗链）
  - [x] 3.2.7 图片说明文字（图注）保留和渲染
- [x] 3.3 划词气泡菜单
  - [x] 3.3.1 创建 `components/reader/SelectionMenu.tsx`
  - [x] 3.3.2 监听文本选择事件（Selection API）
  - [x] 3.3.3 计算气泡位置（Portal渲染）
  - [x] 3.3.4 实现[高亮]按钮（调用highlights API）
  - [x] 3.3.5 实现[批注]按钮（弹出输入框）
  - [x] 3.3.6 实现[AI解释]按钮（调用AI API）
  - [x] 3.3.7 实现[搜索]按钮（跳转搜索引擎）
  - [x] 3.3.8 实现[复制]按钮（多种格式）
- [x] 3.4 智能大纲导航
  - [x] 3.4.1 创建 `components/reader/LeftSidebar/ArticleOutline.tsx`
  - [x] 3.4.2 提取H1-H3标题
  - [ ] 3.4.3 如果无标题，调用AI生成锚点
  - [x] 3.4.4 实现点击跳转（smooth scroll）
  - [x] 3.4.5 实现滚动高亮当前章节
  - [x] 3.4.6 短文章自动隐藏
- [x] 3.5 Lightbox图片查看
  - [x] 3.5.1 创建 `components/reader/ImageLightbox.tsx`
  - [x] 3.5.2 点击图片打开全屏查看
  - [x] 3.5.3 实现放大/缩小/旋转
  - [x] 3.5.4 实现下载按钮
  - [x] 3.5.5 键盘快捷键（← → 切换，Esc关闭）

## 4. 批注系统增强 (Day 11-14)

- [x] 4.1 扩展highlights API
  - [x] 4.1.1 修改 `POST /api/highlights` 支持color参数
  - [x] 4.1.2 修改 `POST /api/highlights` 支持timecode（视频）
  - [x] 4.1.3 修改 `POST /api/highlights` 支持screenshot_url
  - [x] 4.1.4 实现位置恢复算法（quote匹配）
- [x] 4.2 批注对话框组件
  - [x] 4.2.1 创建 `components/reader/AnnotationDialog.tsx`
  - [x] 4.2.2 创建 `components/ui/dialog.tsx`（Radix UI封装）
  - [x] 4.2.3 创建 `components/ui/textarea.tsx`
  - [x] 4.2.4 集成到 ArticleReader 组件
  - [x] 4.2.5 实现保存批注功能
  - [x] 4.2.6 实现加载状态和错误处理
- [x] 4.3 批注卡片组件
  - [x] 4.3.1 创建 `components/reader/RightSidebar/AnnotationCard.tsx` (在 AnnotationList.tsx 中实现)
  - [x] 4.3.2 显示引用文字（高亮）
  - [x] 4.3.3 显示用户笔记
  - [x] 4.3.4 显示时间戳（视频批注）
  - [x] 4.3.5 显示截帧图片（视频批注）
  - [x] 4.3.6 实现点击跳转（滚动到原文/视频seek）
  - [x] 4.3.7 实现编辑功能
  - [x] 4.3.8 实现删除功能
  - [x] 4.3.9 实现改色功能
- [x] 4.4 浮顶功能
  - [x] 4.4.1 实现"图钉"按钮
  - [x] 4.4.2 卡片脱离列表，变为Portal全局悬浮窗
  - [x] 4.4.3 实现拖拽移动位置
  - [ ] 4.4.4 跨页面保持显示（全局状态）
  - [x] 4.4.5 实现取消浮顶
- [x] 4.5 批注列表
  - [x] 4.5.1 创建 `components/reader/RightSidebar/AnnotationList.tsx`
  - [x] 4.5.2 按时间/位置排序
  - [x] 4.5.3 显示批注总数badge
  - [x] 4.5.4 空状态提示

## 5. AI解读面板 (Day 15-19)

- [x] 5.1 OpenAI服务封装
  - [x] 5.1.1 创建 `lib/services/openai.ts`
  - [x] 5.1.2 实现流式生成helper
  - [x] 5.1.3 实现prompt模板
  - [x] 5.1.4 错误处理和重试
- [x] 5.2 AI分析API
  - [x] 5.2.1 创建 `app/api/ai/analyze/route.ts`
  - [x] 5.2.2 实现summary生成
  - [x] 5.2.3 实现journalist_view生成
  - [x] 5.2.4 实现timeline生成
  - [ ] 5.2.5 实现visual_summary生成（视频）
  - [ ] 5.2.6 实现deepfake_warning检测（视频）
  - [x] 5.2.7 结果写入ai_outputs表
  - [x] 5.2.8 实现缓存策略
- [x] 5.3 AI追问API
  - [x] 5.3.1 创建 `app/api/ai/chat/route.ts`
  - [x] 5.3.2 实现RAG（基于文章内容）
  - [x] 5.3.3 实现流式响应（SSE）
  - [x] 5.3.4 实现对话历史管理
- [x] 5.4 AIAnalysisPanel组件
  - [x] 5.4.1 创建 `components/reader/RightSidebar/AIAnalysisPanel.tsx`
  - [x] 5.4.2 实现SummarySection
  - [x] 5.4.3 实现JournalistView（可折叠）
  - [x] 5.4.4 实现TimelineView（时间轴）
  - [ ] 5.4.5 实现VisualSummary（视频）
  - [ ] 5.4.6 实现DeepfakeWarning（视频）
  - [x] 5.4.7 实现ChatInput（追问）
  - [x] 5.4.8 实现流式渲染（逐字显示）
  - [x] 5.4.9 实现loading状态
  - [x] 5.4.10 实现生成按钮（手动触发）

## 6. 视频播放器与控制 (Day 20-22)

- [ ] 6.1 集成video.js
  - [ ] 6.1.1 安装video.js及类型
  - [ ] 6.1.2 创建 `components/reader/ContentStage/VideoPlayer.tsx`
  - [ ] 6.1.3 配置video.js plugins
- [ ] 6.2 智能播放器容器
  - [ ] 6.2.1 实现自适应画幅检测（16:9 vs 9:16）
  - [ ] 6.2.2 实现横屏黑色背景
  - [ ] 6.2.3 实现竖屏高斯模糊背景
  - [ ] 6.2.4 实现播放器响应式大小
- [ ] 6.3 播放器控制增强
  - [ ] 6.3.1 实现倍速控制（0.5x - 3.0x）
  - [ ] 6.3.2 实现循环区间播放
  - [ ] 6.3.3 实现一键截帧（canvas截图→上传Storage）
  - [ ] 6.3.4 实现画中画（PiP）
  - [ ] 6.3.5 实现静音阅读模式
  - [ ] 6.3.6 实现进度条预览缩略图（可选）
- [ ] 6.4 Bilibili/抖音视频支持
  - [ ] 6.4.1 实现Bilibili视频URL解析
  - [ ] 6.4.2 实现抖音视频URL解析
  - [ ] 6.4.3 实现iframe嵌入（备选方案）
  - [ ] 6.4.4 实现视频下载（服务端代理）

## 7. ASR逐字稿系统 (Day 23-26)

- [ ] 7.1 腾讯云ASR集成
  - [ ] 7.1.1 创建 `lib/services/tencent-asr.ts`
  - [ ] 7.1.2 实现音频上传
  - [ ] 7.1.3 实现长音频转写（异步）
  - [ ] 7.1.4 实现说话人分离
  - [ ] 7.1.5 实现结果轮询
- [ ] 7.2 转写API
  - [ ] 7.2.1 创建 `app/api/transcribe/route.ts`
  - [ ] 7.2.2 实现任务创建（返回taskId）
  - [ ] 7.2.3 创建 `app/api/transcribe/status/[taskId]/route.ts`
  - [ ] 7.2.4 实现后台任务队列（可选：使用Vercel Cron或BullMQ）
  - [ ] 7.2.5 转写结果写入transcripts表
  - [ ] 7.2.6 实现成本监控（时长统计）
- [ ] 7.3 TranscriptView组件
  - [ ] 7.3.1 创建 `components/reader/RightSidebar/TranscriptView.tsx`
  - [ ] 7.3.2 显示完整逐字稿（分段）
  - [ ] 7.3.3 实现卡拉OK式高亮（根据播放进度）
  - [ ] 7.3.4 实现点击文字→视频跳转
  - [ ] 7.3.5 实现说话人标记和颜色
  - [ ] 7.3.6 实现说话人重命名
  - [ ] 7.3.7 实现校对模式（编辑文字）
  - [ ] 7.3.8 实现保存校对结果
  - [ ] 7.3.9 实现导出SRT字幕
- [ ] 7.4 转写UI
  - [ ] 7.4.1 实现"生成逐字稿"按钮
  - [ ] 7.4.2 实现转写进度条
  - [ ] 7.4.3 实现转写失败提示和重试
  - [ ] 7.4.4 实现转写状态实时更新（Supabase Realtime）

## 8. 智能章节生成 (Day 27-29)

- [ ] 8.1 章节生成API
  - [ ] 8.1.1 创建 `app/api/chapters/generate/route.ts`
  - [ ] 8.1.2 基于逐字稿调用AI分段
  - [ ] 8.1.3 实现语义分段算法
  - [ ] 8.1.4 章节结果写入video_chapters表
- [ ] 8.2 VideoChapters组件
  - [ ] 8.2.1 创建 `components/reader/LeftSidebar/VideoChapters.tsx`
  - [ ] 8.2.2 显示章节列表（时间+标题）
  - [ ] 8.2.3 实现点击章节→视频+逐字稿同步跳转
  - [ ] 8.2.4 实现当前播放章节高亮
  - [ ] 8.2.5 实现手动添加章节
  - [ ] 8.2.6 实现编辑章节标题
  - [ ] 8.2.7 实现删除章节
- [ ] 8.3 章节UI
  - [ ] 8.3.1 实现"生成章节"按钮
  - [ ] 8.3.2 实现章节生成loading
  - [ ] 8.3.3 显示AI生成confidence score

## 9. 网页存档系统 (Day 30-33)

- [ ] 9.1 Puppeteer集成
  - [ ] 9.1.1 安装puppeteer（或puppeteer-core + chrome-aws-lambda）
  - [ ] 9.1.2 创建 `lib/services/archiver.ts`
  - [ ] 9.1.3 实现单文件HTML生成（内联CSS/图片）
  - [ ] 9.1.4 实现全页截图
  - [ ] 9.1.5 处理动态内容（等待加载）
- [ ] 9.2 存档API
  - [ ] 9.2.1 创建 `app/api/archive/create/route.ts`
  - [ ] 9.2.2 实现URL→HTML+截图→上传Storage
  - [ ] 9.2.3 结果写入web_archives表
  - [ ] 9.2.4 实现去重（已存档不重复）
  - [ ] 9.2.5 创建 `app/api/archive/[id]/route.ts`（获取存档）
- [ ] 9.3 Supabase Storage配置
  - [ ] 9.3.1 创建archives bucket
  - [ ] 9.3.2 配置RLS policies
  - [ ] 9.3.3 配置CORS
  - [ ] 9.3.4 实现签名URL生成（7天有效期）
- [ ] 9.4 ArchiveView组件
  - [ ] 9.4.1 创建 `components/reader/ContentStage/ArchiveView.tsx`
  - [ ] 9.4.2 显示存档HTML（iframe或直接渲染）
  - [ ] 9.4.3 显示存档时间和原URL
  - [ ] 9.4.4 实现导出存档HTML按钮
  - [ ] 9.4.5 实现查看截图按钮
- [ ] 9.5 存档UI
  - [ ] 9.5.1 在ActionMenu添加"创建存档"按钮
  - [ ] 9.5.2 实现存档进度提示
  - [ ] 9.5.3 存档成功后ViewSwitcher显示"存档"Tab
  - [ ] 9.5.4 实现存档失败提示

## 10. 原始网页视图 (Day 30)

- [ ] 10.1 WebView组件
  - [ ] 10.1.1 创建 `components/reader/ContentStage/WebView.tsx`
  - [ ] 10.1.2 实现iframe渲染
  - [ ] 10.1.3 配置iframe sandbox属性
  - [ ] 10.1.4 实现loading状态
  - [ ] 10.1.5 处理加载失败（CORS/X-Frame-Options）
  - [ ] 10.1.6 显示"在新标签页打开"按钮

## 11. AI速览视图 (Day 31)

- [ ] 11.1 AIBriefView组件
  - [ ] 11.1.1 创建 `components/reader/ContentStage/AIBriefView.tsx`
  - [ ] 11.1.2 极简排版（卡片布局）
  - [ ] 11.1.3 显示核心事实
  - [ ] 11.1.4 显示关键人物
  - [ ] 11.1.5 显示结果/结论
  - [ ] 11.1.6 实现"查看完整内容"按钮

## 12. 阅读器设置 (Day 34-35)

- [ ] 12.1 用户设置API
  - [ ] 12.1.1 创建 `app/api/settings/route.ts`（GET/PUT）
  - [ ] 12.1.2 实现设置读取（user_settings表）
  - [ ] 12.1.3 实现设置更新
  - [ ] 12.1.4 实现默认设置初始化
- [ ] 12.2 AppearanceMenu组件
  - [ ] 12.2.1 创建 `components/reader/GlobalHeader/AppearanceMenu.tsx`
  - [ ] 12.2.2 图文模式设置：
    - [ ] 字号调节（12-24px）
    - [ ] 行高调节（1.5-2.5）
    - [ ] 页边距调节（窄/适中/宽）
    - [ ] 主题色选择（亮/暗/护眼/跟随系统）
    - [ ] 字体选择（衬线/无衬线/系统/等宽）
  - [ ] 12.2.3 视频模式设置：
    - [ ] 字幕大小
    - [ ] 字幕背景透明度
    - [ ] 播放器背景（黑边/模糊）
  - [ ] 12.2.4 实现设置预览（实时生效）
  - [ ] 12.2.5 实现"恢复默认"按钮
- [ ] 12.3 设置持久化
  - [ ] 12.3.1 设置更改时自动保存到数据库
  - [ ] 12.3.2 页面加载时读取设置
  - [ ] 12.3.3 未登录时使用localStorage
- [ ] 12.4 单篇覆盖设置
  - [ ] 12.4.1 在ActionMenu添加"单篇设置"入口
  - [ ] 12.4.2 保存到notes.reader_preferences
  - [ ] 12.4.3 优先级：单篇 > 全局 > 默认

## 13. 阅读进度追踪 (Day 36-37)

- [ ] 13.1 阅读进度API
  - [ ] 13.1.1 创建 `app/api/reading-progress/[noteId]/route.ts`
  - [ ] 13.1.2 实现PUT更新进度（节流合并）
  - [ ] 13.1.3 实现GET获取进度
  - [ ] 13.1.4 计算阅读百分比
  - [ ] 13.1.5 累计阅读时长
- [ ] 13.2 前端进度追踪
  - [ ] 13.2.1 监听滚动事件（节流500ms）
  - [ ] 13.2.2 监听视频播放进度（节流5s）
  - [ ] 13.2.3 页面卸载时保存进度
  - [ ] 13.2.4 计算阅读时长（可见性检测）
- [ ] 13.3 断点续读
  - [ ] 13.3.1 页面加载时读取进度
  - [ ] 13.3.2 自动滚动到上次位置（延迟1s）
  - [ ] 13.3.3 视频自动seek到上次位置
  - [ ] 13.3.4 显示"继续阅读"提示（可选）
- [ ] 13.4 阅读统计
  - [ ] 13.4.1 计算预估阅读时间（字数/300）
  - [ ] 13.4.2 显示阅读完成百分比
  - [ ] 13.4.3 在GlobalHeader显示进度条

## 14. 更多操作功能 (Day 32-33)

- [ ] 14.1 ActionMenu组件
  - [ ] 14.1.1 创建 `components/reader/GlobalHeader/ActionMenu.tsx`
  - [ ] 14.1.2 实现分享功能（生成卡片/公开链接）
  - [ ] 14.1.3 实现访问原网页（新标签打开）
- [ ] 14.2 复制链接功能
  - [ ] 14.2.1 复制原链接
  - [ ] 14.2.2 复制Markdown链接格式
  - [ ] 14.2.3 复制为引用格式（带日期）
- [ ] 14.3 复制内容功能
  - [ ] 14.3.1 复制纯文本
  - [ ] 14.3.2 复制Markdown格式
  - [ ] 14.3.3 复制HTML格式
  - [ ] 14.3.4 复制ASR逐字稿（视频）
  - [ ] 14.3.5 复制快照为HTML（存档已创建时）
- [ ] 14.4 导出功能
  - [ ] 14.4.1 导出为PDF（打印优化）
  - [ ] 14.4.2 导出为Markdown
  - [ ] 14.4.3 导出为TXT
  - [ ] 14.4.4 导出SRT字幕（视频）
  - [ ] 14.4.5 导出视频关键帧打包（包含所有批注截帧+时间戳）
  - [ ] 14.4.6 导出网页存档HTML
- [ ] 14.5 整理功能
  - [ ] 14.5.1 设为星标/取消星标
  - [ ] 14.5.2 移动到文件夹
  - [ ] 14.5.3 编辑元信息（标题/标签/摘要）
  - [ ] 14.5.4 归档（读完手动触发）
  - [ ] 14.5.5 稍后读（标记+保存当前进度）
  - [ ] 14.5.6 读到一半自动保存进度
  - [ ] 14.5.7 删除（二次确认）

## 15. 边缘情况处理 (Day 38)

- [ ] 15.1 混合内容处理
  - [ ] 15.1.1 检测图文中嵌入的视频
  - [ ] 15.1.2 提供"提取为视频笔记"按钮
  - [ ] 15.1.3 实现视频提取和单独保存
- [ ] 15.2 链接失效处理
  - [ ] 15.2.1 检测原始链接404
  - [ ] 15.2.2 自动显示"查看存档"提示
  - [ ] 15.2.3 禁用"访问原网页"按钮
- [ ] 15.3 未保存保护
  - [ ] 15.3.1 检测批注编辑中状态
  - [ ] 15.3.2 页面关闭前弹出Alert确认
  - [ ] 15.3.3 实现自动保存草稿（localStorage）
- [ ] 15.4 内容提取失败
  - [ ] 15.4.1 Jina Reader失败时降级到简单提取
  - [ ] 15.4.2 显示"内容提取失败"提示
  - [ ] 15.4.3 提供"刷新内容"按钮
  - [ ] 15.4.4 允许手动输入/粘贴内容
- [ ] 15.5 转写失败处理
  - [ ] 15.5.1 显示友好错误信息
  - [ ] 15.5.2 提供重试按钮
  - [ ] 15.5.3 建议检查视频格式/时长
  - [ ] 15.5.4 提供手动上传字幕文件选项

## 16. 性能优化 (Day 39)

- [ ] 16.1 代码分割
  - [ ] 16.1.1 VideoPlayer懒加载
  - [ ] 16.1.2 WebView懒加载
  - [ ] 16.1.3 AI组件懒加载
  - [ ] 16.1.4 重量级库动态导入（puppeteer、video.js）
- [ ] 16.2 虚拟滚动
  - [ ] 16.2.1 长文本使用react-window
  - [ ] 16.2.2 批注列表虚拟化（>100条）
  - [ ] 16.2.3 逐字稿虚拟化（>1000行）
- [ ] 16.3 图片优化
  - [ ] 16.3.1 使用Next.js Image组件
  - [ ] 16.3.2 图片懒加载（IntersectionObserver）
  - [ ] 16.3.3 WebP格式优先
  - [ ] 16.3.4 响应式图片（srcset）
- [ ] 16.4 缓存策略
  - [ ] 16.4.1 API响应缓存（stale-while-revalidate）
  - [ ] 16.4.2 转写结果缓存30天
  - [ ] 16.4.3 AI分析结果缓存7天
  - [ ] 16.4.4 存档文件CDN缓存
- [ ] 16.5 渲染优化
  - [ ] 16.5.1 使用React.memo避免不必要渲染
  - [ ] 16.5.2 useMemo优化计算密集型操作
  - [ ] 16.5.3 useCallback优化事件处理器
  - [ ] 16.5.4 虚拟滚动时使用固定高度

## 17. 安全加固 (Day 39)

- [ ] 17.1 XSS防护
  - [ ] 17.1.1 集成DOMPurify sanitize HTML
  - [ ] 17.1.2 iframe sandbox配置
  - [ ] 17.1.3 CSP策略配置（next.config.ts）
- [ ] 17.2 CSRF防护
  - [ ] 17.2.1 验证所有POST请求Origin header
  - [ ] 17.2.2 敏感操作二次确认
- [ ] 17.3 Rate Limiting
  - [ ] 17.3.1 ASR API限流（10次/小时/用户）
  - [ ] 17.3.2 AI API限流（5次/分钟/用户）
  - [ ] 17.3.3 存档创建限流（50次/天/用户）
- [ ] 17.4 数据隔离
  - [ ] 17.4.1 验证所有RLS policies生效
  - [ ] 17.4.2 存档文件使用signed URL
  - [ ] 17.4.3 API密钥环境变量管理

## 18. 响应式适配 (Day 40)

- [ ] 18.1 移动端布局
  - [ ] 18.1.1 <768px单栏布局
  - [ ] 18.1.2 侧栏改为全屏抽屉
  - [ ] 18.1.3 底部Tab切换（内容/批注/AI）
- [ ] 18.2 移动端交互
  - [ ] 18.2.1 划词改为长按触发
  - [ ] 18.2.2 气泡菜单改为底部Sheet
  - [ ] 18.2.3 手势支持（滑动切换）
- [ ] 18.3 平板适配
  - [ ] 18.3.1 768px-1024px双栏布局
  - [ ] 18.3.2 侧边栏可折叠
- [ ] 18.4 触摸优化
  - [ ] 18.4.1 增大点击区域（44px）
  - [ ] 18.4.2 滑动丝滑（CSS scroll-behavior）
  - [ ] 18.4.3 禁用双击缩放（视频播放时）

## 19. 测试与验证 (Day 40)

- [ ] 19.1 单元测试
  - [ ] 19.1.1 测试Selection API helper函数
  - [ ] 19.1.2 测试位置恢复算法
  - [ ] 19.1.3 测试阅读进度计算
- [ ] 19.2 集成测试
  - [ ] 19.2.1 测试图文阅读流程
  - [ ] 19.2.2 测试视频播放流程
  - [ ] 19.2.3 测试批注创建流程
  - [ ] 19.2.4 测试AI解读流程
- [ ] 19.3 E2E测试
  - [ ] 19.3.1 使用Playwright测试完整用户流程
  - [ ] 19.3.2 测试跨浏览器兼容性
  - [ ] 19.3.3 测试移动端（模拟器）
- [ ] 19.4 性能测试
  - [ ] 19.4.1 Lighthouse评分 >90
  - [ ] 19.4.2 大文件（10000字）渲染测试
  - [ ] 19.4.3 并发请求压力测试
- [ ] 19.5 安全测试
  - [ ] 19.5.1 XSS漏洞扫描
  - [ ] 19.5.2 CSRF测试
  - [ ] 19.5.3 RLS策略渗透测试

## 20. 文档与部署 (Day 40)

- [ ] 20.1 技术文档
  - [ ] 20.1.1 更新README（新功能说明）
  - [ ] 20.1.2 API文档（Swagger或手写）
  - [ ] 20.1.3 组件Storybook（可选）
- [ ] 20.2 环境变量配置
  - [ ] 20.2.1 .env.example添加新变量
  - [ ] 20.2.2 Vercel环境变量配置
  - [ ] 20.2.3 Supabase环境变量验证
- [ ] 20.3 部署准备
  - [ ] 20.3.1 运行数据库迁移（生产环境）
  - [ ] 20.3.2 配置Supabase Storage CORS
  - [ ] 20.3.3 验证所有API密钥
- [ ] 20.4 监控配置
  - [ ] 20.4.1 Vercel Analytics配置
  - [ ] 20.4.2 Sentry错误监控
  - [ ] 20.4.3 成本监控（ASR/AI/Storage）
- [ ] 20.5 发布
  - [ ] 20.5.1 部署到staging环境
  - [ ] 20.5.2 内部测试验收
  - [ ] 20.5.3 部署到production
  - [ ] 20.5.4 发布公告

## 验收标准

### 功能验收
- [ ] 图文模式能正确渲染文章，支持划词批注，显示智能大纲
- [ ] 视频模式能播放视频，显示ASR逐字稿，支持章节跳转
- [ ] AI解读能生成多视角分析，支持追问对话
- [ ] 批注系统能创建多色高亮和批注，支持浮顶卡片
- [ ] 网页存档能保存和查看HTML快照
- [ ] 阅读器设置能调整外观，设置持久化
- [ ] 阅读进度能自动保存和恢复

### 性能验收
- [ ] 页面加载时间 <2s (p95)
- [ ] Time to Interactive <3s (p95)
- [ ] 大文件（10000字）渲染流畅（60fps）
- [ ] API响应时间 <500ms (p95)
- [ ] Lighthouse评分 >90

### 安全验收
- [ ] 通过XSS漏洞扫描
- [ ] 通过CSRF测试
- [ ] RLS策略正确隔离用户数据
- [ ] 所有敏感操作有rate limiting

### 兼容性验收
- [ ] Chrome/Edge最新版
- [ ] Safari最新版
- [ ] Firefox最新版
- [ ] iOS Safari (移动端)
- [ ] Android Chrome (移动端)

### 业务验收
- [ ] 产品经理验收通过
- [ ] 设计师验收通过
- [ ] QA测试通过
- [ ] 用户试用反馈积极

