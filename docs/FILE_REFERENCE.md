# NewsBox 文件参考文档

> 本文档提供项目中每个文件的完整说明，包括页面归属、核心作用、包含的函数及其用途。

---

## 目录

- [1. App Router (app/)](#1-app-router-app)
- [2. API Routes (app/api/)](#2-api-routes-appapi)
- [3. Components (components/)](#3-components-components)
- [4. Library (lib/)](#4-library-lib)
- [5. Configuration (根目录)](#5-configuration-根目录)

---

## 1. App Router (app/)

### 1.1 根布局

#### `app/layout.tsx`
**页面归属**: 全局根布局
**核心作用**: 整个应用的根布局组件，配置字体、元数据和全局 Provider
**包含内容**:
- 配置 Google Fonts (Geist Sans)
- 设置全局元数据 (title, description, metadataBase)
- 包装 `<Providers>` 组件 (来自 `app/providers.tsx`)

---

#### `app/page.tsx`
**页面归属**: 首页 (落地页) `/`
**核心作用**: 市场营销落地页，展示产品功能和价值主张
**包含内容**:
- 导航栏 (带平滑滚动和活动指示器)
- Hero 区域 (动态关键词轮播动画)
- 产品功能展示 (浮动气泡 + 截图)
- 痛点分析 (解决记忆断层、素材黑洞、碎片困局)
- 核心理念 (收集、净化、唤醒)
- 场景演绎 (通勤电台、视频文本化、灵感矿工)
- Vision 区域
- Footer

**关键组件**: 使用 Framer Motion 实现复杂动画效果

---

#### `app/providers.tsx`
**页面归属**: 全局 Provider 配置
**核心作用**: 提供主题支持和全局 Context
**包含内容**:
- `ThemeProvider` (来自 next-themes)
- 子组件渲染

---

### 1.2 认证页面 (app/auth/)

#### `app/auth/login/page.tsx`
**页面归属**: 登录页面 `/auth/login`
**核心作用**: 用户登录入口
**包含组件**:
- `<LoginForm>` - 登录表单组件

---

#### `app/auth/sign-up/page.tsx`
**页面归属**: 注册页面 `/auth/sign-up`
**核心作用**: 新用户注册
**包含组件**:
- `<SignUpForm>` - 注册表单组件

---

#### `app/auth/sign-up-success/page.tsx`
**页面归属**: 注册成功页面 `/auth/sign-up-success`
**核心作用**: 注册完成后的确认页面

---

#### `app/auth/forgot-password/page.tsx`
**页面归属**: 忘记密码页面 `/auth/forgot-password`
**核心作用**: 密码重置流程入口
**包含组件**:
- `<ForgotPasswordForm>` - 忘记密码表单

---

#### `app/auth/update-password/page.tsx`
**页面归属**: 更新密码页面 `/auth/update-password`
**核心作用**: 用户设置新密码
**包含组件**:
- `<UpdatePasswordForm>` - 更新密码表单

---

#### `app/auth/error/page.tsx`
**页面归属**: 认证错误页面 `/auth/error`
**核心作用**: 显示认证相关错误信息

---

#### `app/auth/confirm/route.ts`
**页面归属**: 认证确认路由 `/auth/confirm`
**核心作用**: 处理 Supabase auth 确认回调
**包含函数**:
- `GET` - 处理 token 验证和用户会话建立

---

### 1.3 Dashboard (app/dashboard/)

#### `app/dashboard/page.tsx`
**页面归属**: 主 Dashboard 页 `/dashboard`
**核心作用**: 用户的工作区主页面，展示笔记集合
**包含组件**:
- `<DashboardContent>` - 主要内容组件
- `<DashboardAuthCheck>` - 认证检查组件
- `<Suspense>` - 加载状态处理

---

### 1.4 Notes (app/notes/)

#### `app/notes/[id]/page.tsx`
**页面归属**: 笔记详情页 `/notes/[id]`
**核心作用**: 单个笔记的阅读页面
**包含组件**:
- `<ReaderPageWrapper>` - 阅读器包装器
- `<NoteDetailAuthCheck>` - 认证检查
- `<Suspense>` - 加载状态

**参数**:
- `params.id` - 笔记 ID

---

### 1.5 其他页面

#### `app/pricing/page.tsx`
**页面归属**: 定价页面 `/pricing`
**核心作用**: 展示订阅计划和价格

---

#### `app/protected/page.tsx` & `app/protected/layout.tsx`
**页面归属**: 受保护页面 `/protected`
**核心作用**: 需要认证才能访问的示例页面

---

## 2. API Routes (app/api/)

### 2.1 AI 相关 (app/api/ai/)

#### `app/api/ai/analyze/route.ts`
**页面归属**: AI 分析 API
**核心作用**: 生成笔记的 AI 深度分析
**请求方法**: POST
**请求参数**:
- `noteId` (required) - 笔记 ID
- `type` (optional) - 分析类型，默认 "all"

**处理流程**:
1. 验证用户身份
2. 获取笔记内容
3. 调用 `generateAIAnalysis()` 生成分析
4. 保存到 `ai_outputs` 表
5. 返回分析结果

**返回格式**:
```json
{
  "success": true,
  "data": {
    "summary": "...",
    "journalist_view": "...",
    "timeline": "..."
  }
}
```

---

#### `app/api/ai/read/route.ts`
**页面归属**: AI 速读 API
**核心作用**: 生成 50 字浓缩摘要
**请求方法**: POST
**请求参数**: `noteId`

---

#### `app/api/ai/chat/route.ts`
**页面归属**: AI 对话 API
**核心作用**: 与笔记内容的 AI 对话
**请求方法**: POST
**请求参数**: `noteId`, `messages`

---

### 2.2 内容抓取 (app/api/capture/)

#### `app/api/capture/route.ts`
**页面归属**: 内容抓取 API
**核心作用**: 从 URL 抓取网页内容和元数据
**请求方法**: POST
**请求参数**:
- `noteId` (required) - 笔记 ID
- `url` (required) - 目标 URL

**处理流程**:
1. 验证笔记所有权
2. 检测视频平台 (B站/YouTube/抖音/快手)
3. 抓取 HTML 内容
4. 使用 Cheerio 解析元数据
5. 使用 `sanitizeHtmlContent()` 清洗内容
6. 更新笔记记录

**支持平台**:
- 哔哩哔哩 (B站)
- YouTube
- 抖音
- 快手
- 普通网页

---

### 2.3 Jina Reader (app/api/extract/)

#### `app/api/extract/jina/route.ts`
**页面归属**: Jina Reader 提取 API
**核心作用**: 使用 Jina Reader API 进行高质量内容提取
**请求方法**: POST
**请求参数**: `url`

---

### 2.4 ASR (app/api/asr/)

#### `app/api/asr/route.ts`
**页面归属**: 语音识别 API
**核心作用**: 提交视频/音频转写任务
**请求方法**: POST
**请求参数**: `noteId`

---

### 2.5 Tags (app/api/tags/)

#### `app/api/tags/route.ts`
**页面归属**: 标签管理 API
**核心作用**: 标签 CRUD 操作
**请求方法**: GET, POST
**功能**: 创建、查询标签

---

#### `app/api/tags/[id]/route.ts`
**页面归属**: 单个标签 API
**核心作用**: 标签更新/删除
**请求方法**: PATCH, DELETE

---

#### `app/api/tags/[id]/archive/route.ts`
**页面归属**: 标签归档 API
**核心作用**: 归档/取消归档标签
**请求方法**: POST

---

#### `app/api/tags/reorder/route.ts`
**页面归属**: 标签排序 API
**核心作用**: 批量更新标签顺序
**请求方法**: POST

---

### 2.6 Knowledge (app/api/knowledge/)

#### `app/api/knowledge/topics/route.ts`
**页面归属**: 智能主题 API
**核心作用**: 智能主题的 CRUD 操作
**请求方法**: GET, POST

---

#### `app/api/knowledge/topics/[id]/route.ts`
**页面归属**: 单个主题 API
**核心作用**: 主题更新/删除
**请求方法**: PATCH, DELETE

---

#### `app/api/knowledge/topics/[id]/report/route.ts`
**页面归属**: 主题报告 API
**核心作用**: 生成主题详细报告

---

#### `app/api/knowledge/topics/[id]/archive/route.ts`
**页面归属**: 主题归档 API
**核心作用**: 归档/取消归档主题

---

#### `app/api/knowledge/topics/[id]/pin/route.ts`
**页面归属**: 主题置顶 API
**核心作用**: 置顶/取消置顶主题

---

#### `app/api/knowledge/topics/[id]/merge/route.ts`
**页面归属**: 主题合并 API
**核心作用**: 合并相似主题

---

#### `app/api/knowledge/topics/[id]/members/route.ts`
**页面归属**: 主题成员 API
**核心作用**: 管理主题包含的笔记

---

#### `app/api/knowledge/topics/rebuild/route.ts`
**页面归属**: 重建主题 API
**核心作用**: 重新计算所有主题

---

#### `app/api/knowledge/topics/recluster/route.ts`
**页面归属**: 重新聚类 API
**核心作用**: 使用新参数重新聚类笔记

---

#### `app/api/knowledge/topics/nightly-refresh/route.ts`
**页面归属**: 每日刷新 API
**核心作用**: 定时任务入口，刷新智能主题

---

#### `app/api/knowledge/search/route.ts`
**页面归属**: 知识搜索 API
**核心作用**: 全局知识库搜索

---

#### `app/api/knowledge/chat/route.ts`
**页面归属**: 知识对话 API
**核心作用**: 基于知识库的 AI 对话

---

#### `app/api/knowledge/graph/rebuild/route.ts`
**页面归属**: 知识图谱重建 API
**核心作用**: 重新构建知识图谱

---

### 2.7 Settings (app/api/settings/)

#### `app/api/settings/stats/route.ts`
**页面归属**: 用户统计 API
**核心作用**: 获取用户使用统计数据

---

#### `app/api/settings/trash/route.ts`
**页面归属**: 回收站 API
**核心作用**: 获取已删除的笔记列表
**请求方法**: GET

---

#### `app/api/settings/trash/[id]/restore/route.ts`
**页面归属**: 恢复笔记 API
**核心作用**: 从回收站恢复笔记

---

#### `app/api/settings/trash/[id]/delete/route.ts`
**页面归属**: 永久删除 API
**核心作用**: 永久删除笔记

---

#### `app/api/settings/referral/me/route.ts`
**页面归属**: 我的推荐码 API
**核心作用**: 获取用户的推荐码和统计

---

#### `app/api/settings/referral/redeem/route.ts`
**页面归属**: 兑换推荐码 API
**核心作用**: 兑换推荐码获得奖励

---

### 2.8 Highlights (app/api/highlights/)

#### `app/api/highlights/route.ts`
**页面归属**: 批注高亮 API
**核心作用**: 批注的 CRUD 操作
**请求方法**: GET, POST, PATCH, DELETE

---

### 2.9 Snapshot (app/api/snapshot/)

#### `app/api/snapshot/route.tsx`
**页面归属**: 网页快照 API
**核心作用**: 保存网页快照到存储桶
**请求方法**: POST

---

## 3. Components (components/)

### 3.1 Dashboard Components (components/dashboard/)

#### `components/dashboard/dashboard-content.tsx`
**页面归属**: Dashboard 主页面
**核心作用**: Dashboard 的核心逻辑组件
**主要功能**:
- 无限滚动加载笔记
- 笔记筛选和搜索
- 批量操作 (收藏、移动、标签、归档、删除、导出)
- 视图模式切换
- 文件夹和标签导航
- 添加笔记模态框 (URL/手动/上传)

**状态管理**:
- `notes` - 笔记列表
- `loading` - 加载状态
- `selectedIds` - 批选中的笔记
- `viewMode` - 视图模式
- `category` - 当前分类
- `searchQuery` - 搜索关键词

**关键函数**:
- `loadNotes()` - 加载笔记列表
- `handleBatchStar()` - 批量收藏
- `handleBatchArchive()` - 批量归档
- `handleBatchDelete()` - 批量删除
- `handleBatchExport()` - 批量导出 (ZIP)
- `handleFileUpload()` - 处理文件上传

---

#### `components/dashboard/dashboard-auth-check.tsx`
**页面归属**: Dashboard 认证检查
**核心作用**: 验证用户是否登录，未登录则重定向

---

#### `components/dashboard/BrowseHistoryPopover.tsx`
**页面归属**: 浏览历史弹窗
**核心作用**: 显示最近浏览的笔记列表
**数据来源**: `localStorage` (通过 `lib/browse-history.ts`)

---

#### `components/dashboard/BrowseHistoryDialog.tsx`
**页面归属**: 浏览历史对话框
**核心作用**: 浏览历史的完整对话框视图

---

#### `components/dashboard/NotificationsPopover.tsx`
**页面归属**: 通知弹窗
**核心作用**: 显示系统通知

---

#### `components/dashboard/SettingsPopover.tsx`
**页面归属**: 设置快捷弹窗
**核心作用**: 快速访问常用设置

---

#### `components/dashboard/knowledge-view.tsx`
**页面归属**: 知识视图
**核心作用**: 知识图谱和智能主题的主视图

---

#### `components/dashboard/knowledge-graph/KnowledgeGraphView.tsx`
**页面归属**: 知识图谱视图
**核心作用**: 使用 D3.js 渲染知识图谱
**功能**: 节点拖拽、缩放、点击查看详情

---

#### `components/dashboard/knowledge-graph/EntityProfilePanel.tsx`
**页面归属**: 实体详情面板
**核心作用**: 显示知识图谱中节点的详细信息

---

#### `components/dashboard/knowledge-graph/types.ts`
**页面归属**: 知识图谱类型定义
**核心作用**: 定义图谱数据结构

---

#### `components/dashboard/knowledge-graph/mock-data.ts`
**页面归属**: 知识图谱模拟数据
**核心作用**: 开发时使用的模拟数据

---

#### `components/dashboard/smart-topics/SmartTopicsDashboard.tsx`
**页面归属**: 智能主题仪表板
**核心作用**: 智能主题的主容器组件
**包含视图**: 列表、报告、时间线

---

#### `components/dashboard/smart-topics/TopicCard.tsx`
**页面归属**: 主题卡片
**核心作用**: 显示单个智能主题的卡片

---

#### `components/dashboard/smart-topics/StatsCard.tsx`
**页面归属**: 统计卡片
**核心作用**: 显示主题相关统计数据

---

#### `components/dashboard/smart-topics/TopicManagementView.tsx`
**页面归属**: 主题管理视图
**核心作用**: 管理智能主题 (置顶、归档、合并)

---

#### `components/dashboard/smart-topics/TopicReportView.tsx`
**页面归属**: 主题报告视图
**核心作用**: 显示主题的详细分析报告

---

#### `components/dashboard/smart-topics/TopicTimelineView.tsx`
**页面归属**: 主题时间线视图
**核心作用**: 按时间线展示主题相关笔记

---

#### `components/dashboard/smart-topics/types.ts`
**页面归属**: 智能主题类型定义
**核心作用**: 定义主题数据结构

---

### 3.2 Reader Components (components/reader/)

#### `components/reader/ReaderLayout.tsx`
**页面归属**: 笔记详情页 `/notes/[id]`
**核心作用**: 阅读器的三栏布局容器
**布局结构**:
- 左侧栏: `LeftSidebar` (大纲/章节)
- 中间区: `ContentStage` (内容舞台)
- 右侧栏: `RightSidebar` (批注/AI/逐字稿)
- 顶部导航: `GlobalHeader`
- 底部导航: 快捷操作栏

**状态管理**:
- `currentView` - 当前视图模式 (reader/web/ai-brief/archive)
- `isZenMode` - 禅模式状态
- `leftSidebarCollapsed` - 左侧栏折叠状态
- `rightSidebarCollapsed` - 右侧栏折叠状态
- `isSidebarCompact` - 右侧栏紧凑模式
- `scrollProgress` - 阅读进度

**事件监听**:
- `reader:has-annotations` - 有批注时展开右侧栏
- `reader:switch-tab` - 切换右侧栏 Tab
- `Esc` 键 - 退出禅模式

---

#### `components/reader/ReaderPageWrapper.tsx`
**页面归属**: 笔记详情页数据加载
**核心作用**: 加载笔记数据并传递给 ReaderLayout
**功能**:
- 验证用户身份
- 加载笔记数据
- 检查是否已删除
- 更新 `last_accessed_at`
- 记录浏览历史 (localStorage)
- 记录访问事件 (数据库)
- 加载所属文件夹信息

---

#### `components/reader/GlobalHeader/index.tsx`
**页面归属**: 阅读器顶部导航栏
**核心作用**: 提供导航和操作功能
**包含子组件**:
- `<ViewSwitcher>` - 视图切换器
- `<AppearanceMenu>` - 外观设置菜单
- `<ActionMenu>` - 更多操作菜单

**功能**:
- 返回按钮 + 面包屑
- 视图切换 (reader/web/ai-brief/archive)
- 禅模式切换
- 右侧栏切换
- 阅读进度条

---

#### `components/reader/GlobalHeader/ViewSwitcher.tsx`
**页面归属**: 视图切换器
**核心作用**: 切换阅读视图模式
**视图选项**:
- `reader` - 沉浸阅读
- `web` - 原始网页
- `ai-brief` - AI 速览
- `archive` - 网页存档

---

#### `components/reader/GlobalHeader/AppearanceMenu.tsx`
**页面归属**: 外观设置菜单
**核心作用**: 调整阅读外观
**设置选项**:
- 字体大小
- 行高
- 字体家族
- 主题 (浅色/深色/羊皮纸)

---

#### `components/reader/GlobalHeader/ActionMenu.tsx`
**页面归属**: 操作菜单
**核心作用**: 更多操作
**操作选项**:
- 打开原始链接
- 网页快照
- 分享
- 删除
- 归档

---

#### `components/reader/LeftSidebar/index.tsx`
**页面归属**: 左侧栏容器
**核心作用**: 根据 content_type 渲染不同内容
**内容**:
- 图文模式: `<ArticleOutline>`
- 视频/音频模式: `<VideoChapters>`

---

#### `components/reader/LeftSidebar/ArticleOutline.tsx`
**页面归属**: 文章大纲
**核心作用**: 显示文章的标题结构 (H1-H3)
**功能**:
- 提取 HTML 中的标题
- 点击跳转到对应位置
- 高亮当前所在章节

---

#### `components/reader/LeftSidebar/VideoChapters.tsx`
**页面归属**: 视频章节
**核心作用**: 显示视频的智能章节列表
**功能**:
- 展示章节标题和时间戳
- 点击跳转到视频对应时间

---

#### `components/reader/ContentStage/index.tsx`
**页面归属**: 内容舞台容器
**核心作用**: 根据 currentView 渲染不同内容组件
**视图映射**:
- `reader` → `<ArticleReader>` 或 `<VideoPlayer>`
- `web` → `<WebView>`
- `ai-brief` → `<AIBriefView>`
- `archive` → `<ArchiveView>`

---

#### `components/reader/ContentStage/ArticleReader.tsx`
**页面归属**: 图文阅读器
**核心作用**: 渲染文章的 HTML 内容
**功能**:
- 渲染清洗后的 HTML
- 图片防盗链处理 (`referrerPolicy="no-referrer"`)
- 文本选择监听 (触发批注菜单)

---

#### `components/reader/ContentStage/VideoPlayer.tsx`
**页面归属**: 视频播放器
**核心作用**: 嵌入式视频播放
**功能**:
- iframe 嵌入视频
- 同步显示逐字稿 (如有)
- 章节导航

---

#### `components/reader/ContentStage/WebView.tsx`
**页面归属**: 原始网页视图
**核心作用**: 使用 iframe 显示原始网页

---

#### `components/reader/ContentStage/AIBriefView.tsx`
**页面归属**: AI 速览视图
**核心作用**: 显示 AI 生成的快速摘要
**内容**:
- 50 字浓缩摘要
- 关键要点
- 情感倾向

---

#### `components/reader/ContentStage/ArchiveView.tsx`
**页面归属**: 网页存档视图
**核心作用**: 显示保存的网页快照

---

#### `components/reader/ContentStage/AISnapshotView.tsx`
**页面归属**: AI 快照视图
**核心作用**: 显示 AI 分析的网页快照

---

#### `components/reader/RightSidebar/index.tsx`
**页面归属**: 右侧栏容器
**核心作用**: Tab 切换不同的功能面板
**Tabs**:
- `annotations` → `<AnnotationList>`
- `ai-analysis` → `<AIAnalysisPanel>`
- `transcript` → `<TranscriptView>`

---

#### `components/reader/RightSidebar/AnnotationList.tsx`
**页面归属**: 批注列表
**核心作用**: 显示所有高亮和批注
**功能**:
- 列表展示批注
- 点击跳转到对应位置
- 编辑/删除批注

---

#### `components/reader/RightSidebar/AIAnalysisPanel.tsx`
**页面归属**: AI 分析面板
**核心作用**: 显示 AI 深度分析
**内容**:
- 记者视角
- 时间线梳理
- 延伸阅读

---

#### `components/reader/RightSidebar/TranscriptView.tsx`
**页面归属**: 逐字稿视图
**核心作用**: 显示视频/音频的逐字稿
**功能**:
- 显示分段文本
- 时间戳点击跳转
- 卡拉OK式同步高亮

---

#### `components/reader/AnnotationDialog.tsx`
**页面归属**: 批注对话框
**核心作用**: 创建/编辑批注
**功能**:
- 高亮文本显示
- 添加笔记内容
- 保存到数据库
- 派发 `reader:has-annotations` 事件

---

#### `components/reader/SelectionMenu.tsx`
**页面归属**: 文本选择菜单
**核心作用**: 浮动工具栏，选中文本时出现
**功能**:
- 复制
- 高亮
- 添加批注
- AI 解释

---

#### `components/reader/TagManager.tsx`
**页面归属**: 标签管理器
**核心作用**: 为笔记添加/移除标签
**功能**:
- 标签搜索
- 创建新标签
- 选择/取消标签

---

#### `components/reader/ImageLightbox.tsx`
**页面归属**: 图片灯箱
**核心作用**: 点击图片查看大图
**功能**:
- 全屏显示图片
- 缩放
- 下载

---

#### `components/reader/SnapshotModal.tsx`
**页面归属**: 网页快照模态框
**核心作用**: 显示和管理网页快照

---

### 3.3 Notes Components (components/notes/)

#### `components/notes/note-detail-auth-check.tsx`
**页面归属**: 笔记详情页认证检查
**核心作用**: 验证用户身份，重定向未登录用户

---

#### `components/notes/note-detail-content.tsx`
**页面归属**: 笔记详情页内容
**核心作用**: 渲染笔记详情页面

---

### 3.4 Settings Components (components/settings/sections/)

#### `components/settings/sections/AccountSection.tsx`
**页面归属**: 账户设置
**核心作用**: 用户账户信息管理
**功能**:
- 修改昵称
- 修改邮箱
- 修改密码

---

#### `components/settings/sections/RewardsSection.tsx`
**页面归属**: 奖励设置
**核心作用**: 推荐奖励系统
**功能**:
- 查看推荐码
- 兑换推荐码
- 查看奖励历史

---

#### `components/settings/sections/StatsSection.tsx`
**页面归属**: 统计设置
**核心作用**: 使用统计数据
**内容**:
- 累计访问次数
- 来源网站 TOP
- 收藏趋势

---

#### `components/settings/sections/AppearanceSection.tsx`
**页面归属**: 外观设置
**核心作用**: 全局外观设置
**功能**:
- 主题切换
- 字体设置

---

#### `components/settings/sections/TrashSection.tsx`
**页面归属**: 回收站
**核心作用**: 管理已删除的笔记
**功能**:
- 查看已删除笔记
- 恢复笔记
- 永久删除

---

#### `components/settings/sections/AboutSection.tsx`
**页面归属**: 关于
**核心作用**: 应用信息和版本

---

### 3.5 UI Components (components/ui/)

> shadcn/ui 基础组件，提供一致的 UI 风格

| 文件 | 组件名 | 作用 |
|------|--------|------|
| `button.tsx` | Button | 按钮组件，支持多种变体和大小 |
| `input.tsx` | Input | 输入框组件 |
| `textarea.tsx` | Textarea | 多行文本输入 |
| `card.tsx` | Card | 卡片容器 |
| `badge.tsx` | Badge | 标签徽章 |
| `checkbox.tsx` | Checkbox | 复选框 |
| `label.tsx` | Label | 表单标签 |
| `dialog.tsx` | Dialog | 对话框模态框 |
| `popover.tsx` | Popover | 弹出菜单 |
| `dropdown-menu.tsx` | DropdownMenu | 下拉菜单 |
| `scroll-area.tsx` | ScrollArea | 自定义滚动区域 |
| `select.tsx` | Select | 下拉选择器 |
| `visually-hidden.tsx` | VisuallyHidden | 屐藏但可访问的元素 |

---

### 3.6 Auth Components

#### `components/login-form.tsx`
**页面归属**: 登录页面
**核心作用**: 用户登录表单
**功能**:
- 邮箱/密码登录
- 错误处理
- 登录成功重定向

---

#### `components/sign-up-form.tsx`
**页面归属**: 注册页面
**核心作用**: 用户注册表单
**功能**:
- 邮箱/密码注册
- 表单验证

---

#### `components/forgot-password-form.tsx`
**页面归属**: 忘记密码页面
**核心作用**: 发送密码重置邮件

---

#### `components/update-password-form.tsx`
**页面归属**: 更新密码页面
**核心作用**: 设置新密码

---

#### `components/auth-button.tsx`
**页面归属**: 导航栏
**核心作用**: 登录/登出按钮

---

#### `components/logout-button.tsx`
**页面归属**: 各页面
**核心作用**: 用户登出操作

---

### 3.7 其他 Components

#### `components/theme-switcher.tsx`
**页面归属**: 全局
**核心作用**: 主题切换按钮 (浅色/深色)

---

#### `components/hero.tsx`
**页面归属**: 首页
**核心作用**: Hero 区域的营销内容

---

#### `components/env-var-warning.tsx`
**页面归属**: 开发环境
**核心作用**: 环境变量配置警告

---

#### `components/deploy-button.tsx`
**页面归属**: 开发环境
**核心作用**: Vercel 快速部署按钮

---

#### `components/next-logo.tsx`
**页面归属**: 页脚
**核心作用**: Next.js Logo 显示

---

#### `components/supabase-logo.tsx`
**页面归属**: 页脚
**核心作用**: Supabase Logo 显示

---

## 4. Library (lib/)

### 4.1 Supabase (lib/supabase/)

#### `lib/supabase/client.ts`
**页面归属**: 客户端环境
**核心作用**: 创建浏览器端的 Supabase 客户端
**包含函数**:
```typescript
export function createClient(): SupabaseClient
```

**使用场景**: Client Components、事件处理器、useEffect hooks

**特点**:
- 内部使用单例模式，可安全缓存
- 自动从 document.cookie 读取 session
- 支持 Realtime 订阅

---

#### `lib/supabase/server.ts`
**页面归属**: 服务端环境
**核心作用**: 创建服务端的 Supabase 客户端
**包含函数**:
```typescript
export async function createClient(): Promise<SupabaseClient>
```

**使用场景**: Server Components、API Routes、Server Actions

**⚠️ 重要**: 每次调用都创建新实例，不要缓存到全局变量 (Fluid Compute 要求)

---

#### `lib/supabase/proxy.ts`
**页面归属**: Next.js Middleware
**核心作用**: 会话刷新和路由保护
**包含函数**:
```typescript
export async function updateSession(request: NextRequest): Promise<NextResponse>
```

**保护路径**: `/dashboard`, `/protected`, `/notes/*`

**⚠️ 注意**: 必须使用 `getClaims()` 而不是 `getUser()`，避免随机登出

---

### 4.2 Services (lib/services/)

#### `lib/services/openai.ts`
**页面归属**: AI 服务层
**核心作用**: 封装 OpenAI API 调用

**包含函数**:
| 函数 | 作用 |
|------|------|
| `callOpenAIJson()` | 调用 OpenAI API，返回 JSON 格式 |
| `generateFlashRead()` | 生成 50 字浓缩摘要 |
| `generateKeyQuestions()` | 生成关键问题 |
| `generateAIAnalysis()` | 生成 AI 深度分析 (记者视角、时间线) |
| `chatWithAI()` | 与笔记内容的 AI 对话 |

---

#### `lib/services/jina.ts`
**页面归属**: 内容提取服务
**核心作用**: 封装 Jina Reader API

**包含函数**:
```typescript
export async function extractWithJina(url: string): Promise<JinaExtractionResult>
```

**特点**:
- 15 秒超时
- 自动转换为 Markdown
- 提取元数据 (标题、作者、发布时间)

---

#### `lib/services/tencent-asr.ts`
**页面归属**: 语音识别服务
**核心作用**: 封装腾讯云 ASR API

**包含函数**:
| 函数 | 作用 |
|------|------|
| `createASRTask()` | 提交转写任务 |
| `getASRTaskResult()` | 查询任务状态和结果 |
| `parseTencentSegments()` | 解析腾讯云返回的分段结果 |
| `transcribeAudio()` | 一键转写 (长轮询) |

**⚠️ Serverless 警告**: 轮询方式不适合 Serverless 环境，建议使用 Webhook 回调

---

#### `lib/services/html-sanitizer.ts`
**页面归属**: HTML 清洗服务
**核心作用**: 清洗 HTML 内容，移除广告和无关元素

**包含函数**:
```typescript
export function sanitizeHtmlContent(html: string): string
```

**清洗规则**:
- 移除 script, style, nav, footer, aside 等标签
- 保留文章正文区域
- 保留图片和链接

---

#### `lib/services/snapshot.ts`
**页面归属**: 网页快照服务
**核心作用**: 保存和管理网页快照

**包含函数**:
| 函数 | 作用 |
|------|------|
| `saveSnapshot()` | 保存网页快照到 Supabase Storage |
| `getSnapshot()` | 获取网页快照 |

---

#### `lib/services/knowledge-graph.ts`
**页面归属**: 知识图谱服务
**核心作用**: 构建和管理知识图谱

**包含函数**:
| 函数 | 作用 |
|------|------|
| `buildKnowledgeGraph()` | 构建知识图谱 |
| `searchEntities()` | 搜索实体 |
| `getEntityConnections()` | 获取实体关联 |

---

#### `lib/services/knowledge-topics.ts`
**页面归属**: 智能主题服务
**核心作用**: 智能主题的聚类和管理

**包含函数**:
| 函数 | 作用 |
|------|------|
| `generateSmartTopics()` | 生成智能主题 |
| `refreshTopics()` | 刷新主题 |
| `mergeTopics()` | 合并相似主题 |
| `archiveTopic()` | 归档主题 |

---

### 4.3 Utilities (lib/)

#### `lib/utils.ts`
**页面归属**: 通用工具
**核心作用**: 提供通用工具函数

**包含函数**:
```typescript
export function cn(...inputs: ClassValue[]): string
```
- 合并 Tailwind 类名
- 使用 clsx 和 tailwind-merge
- 解决类名冲突

```typescript
export const hasEnvVars: boolean
```
- 检查必需的环境变量是否配置

---

#### `lib/browse-history.ts`
**页面归属**: 浏览历史管理
**核心作用**: 管理本地浏览历史记录

**包含函数**:
| 函数 | 作用 |
|------|------|
| `getBrowseHistory(userId)` | 获取浏览历史 |
| `addBrowseHistoryEntry(userId, entry)` | 添加浏览记录 |
| `clearBrowseHistory(userId)` | 清空浏览历史 |

**存储**: localStorage
**最大条数**: 500

**类型定义**:
```typescript
type BrowseHistoryEntry = {
  noteId: string;
  title: string | null;
  siteName: string | null;
  sourceUrl: string | null;
  contentType: "article" | "video" | "audio" | null;
  visitedAt: string; // ISO string
}
```

---

## 5. Configuration (根目录)

### 5.1 Next.js 配置

#### `next.config.ts`
**核心作用**: Next.js 框架配置
**配置内容**:
- 实验性功能
- 构建优化选项

---

### 5.2 TypeScript 配置

#### `tsconfig.json`
**核心作用**: TypeScript 编译配置
**配置内容**:
- 严格模式
- 路径别名 (`@/` → 项目根目录)
- 模块解析策略

---

### 5.3 Tailwind 配置

#### `tailwind.config.ts`
**核心作用**: Tailwind CSS 配置
**配置内容**:
- 主题颜色
- 自定义断点
- 插件配置 (tailwindcss-animate)

---

### 5.4 Middleware

#### `proxy.ts`
**位置**: 根目录
**核心作用**: 导出 Supabase middleware
**实现**: 重新导出 `lib/supabase/proxy.ts`

---

## 附录：数据库表结构

### 核心表

| 表名 | 作用 |
|------|------|
| `profiles` | 用户资料扩展 |
| `folders` | 文件夹/分类 |
| `notes` | 笔记 (图文/视频/音频) |
| `tags` | 标签 |
| `note_tags` | 笔记-标签关联 |
| `annotations` | 批注高亮 |
| `reading_progress` | 阅读进度 |
| `snapshots` | 网页快照 |
| `ai_outputs` | AI 生成内容 |
| `smart_topics` | 智能主题 |
| `note_visit_events` | 笔记访问事件 |

---

## 附录：环境变量

### 必需变量

```bash
NEXT_PUBLIC_SUPABASE_URL=                    # Supabase 项目 URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=        # Supabase 公开密钥
```

### 可选变量

```bash
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=user-files  # Storage 桶名
OPENAI_API_KEY=                               # OpenAI API 密钥
TENCENT_SECRET_ID=                            # 腾讯云 Secret ID
TENCENT_SECRET_KEY=                           # 腾讯云 Secret Key
JINA_API_KEY=                                 # Jina Reader API 密钥
```

---

*本文档由 AI 自动生成，最后更新于 2025-01-04*
