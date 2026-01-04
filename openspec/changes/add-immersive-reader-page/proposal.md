# Change: 添加沉浸式新闻笔记阅读详情页

## Why

当前系统的笔记详情页功能过于简单，仅能展示基础的标题、内容和元数据。作为产品的核心生产力界面，需要一个集沉浸阅读、视听分析、AI辅助、深度笔记于一体的"第二大脑"工作台。

**核心需求：**
- **多态路由**：根据内容类型（图文/视频）自动切换渲染器
- **全媒体生产力**："把视频当做文本来读"（ASR + 章节），"把图文当做数据来查"（AI 提炼 + 溯源）
- **记者工学**：强调引用规范、证据留存（快照）、双向联动和多任务对比（悬浮批注）
- **响应式三栏布局**：左侧导航、中间内容舞台、右侧智库面板，支持禅模式

## What Changes

### 新增功能

1. **响应式三栏布局系统**
   - 左侧：智能大纲（图文）或智能章节（视频）
   - 中间：自适应内容舞台（根据content_type切换渲染器）
   - 右侧：智库面板（批注列表、AI解读、视频听记）
   - 支持全屏禅模式（一键收起左右侧栏）

2. **全局顶部导航栏**
   - 视图切换器：沉浸阅读 | 原始网页 | AI速览 | 网页存档
   - 阅读器样式设置（自适应图文/视频模式）
   - 更多操作菜单（分享、复制、导出、整理）
   - 阅读进度条

3. **图文阅读模式（Article Mode）**
   - 使用Jina Reader API提取高质量正文
   - 纯净排版渲染（去广告、保留代码高亮）
   - 划词气泡菜单：高亮、批注、AI解释、搜索、复制
   - 智能大纲导航（提取H1-H3或AI生成锚点）
   - Lightbox图片查看器（放大、旋转、下载）
   - 元信息头（发布时间、抓取时间、标签、阅读预估）

4. **视频分析模式（Video Mode）**
   - 智能播放器：
     - 自适应画幅（16:9横屏 / 9:16竖屏+高斯模糊填充）
     - 倍速控制（0.5x - 3.0x）
     - 循环区间播放
     - 一键截帧保存
     - 画中画支持
   - ASR逐字稿系统（腾讯云ASR）：
     - 卡拉OK式高亮滚动
     - 双向交互（点击文字→视频跳转）
     - 说话人识别与重命名
     - 校对模式（手动修正）
   - 智能章节：
     - AI自动分段（基于语义/画面转场）
     - 点击章节→视频+逐字稿同步跳转

5. **增强批注系统**
   - 多色高亮标记
   - 批注卡片（引用+笔记+锚点）
   - 浮顶功能（全局悬浮窗，跨文章可见）
   - 视频批注（截帧图片+时间戳+台词）
   - 位置智能恢复

6. **AI解读面板**
   - 多视角分析：
     - 摘要（TL;DR）
     - 记者视点（消息源可靠性、利益相关方）
     - 时间线（事件脉络）
     - 视频特有：视觉摘要、Deepfake预警
   - AI追问对话（RAG问答）
   - 流式生成（OpenAI API）

7. **网页存档系统**
   - HTML快照保存（Supabase Storage）
   - 证据留存（防止原链接失效）
   - 存档查看与导出

8. **阅读器个性化设置**
   - 图文模式：字号、页边距、行高、主题色、字体
   - 视频模式：字幕大小、字幕背景透明度、播放器背景
   - 全局用户偏好存储

9. **阅读进度追踪与稍后读**
   - 自动记录滚动位置/播放进度
   - 断点续读（读到一半自动保存）
   - 阅读统计（预估时间、完成百分比）
   - 稍后读功能（标记+保存进度）

10. **全面的复制与导出功能**
   - 复制：纯文本、Markdown、HTML、引用格式、ASR逐字稿、快照HTML
   - 导出：PDF、Markdown、TXT、SRT字幕、视频关键帧打包、网页存档HTML

11. **内容保真与细节**
   - 图片说明文字（图注）保留
   - 发布时间+抓取时间双时间戳显示
   - 来源媒体Icon+名称显示

12. **右侧面板灵活切换**
   - 标签页模式：批注列表 | AI解读 | 视频听记
   - 分屏模式（可选）：同时显示多个面板

### 数据库变更

**新增表：**
- `web_archives` - 网页快照存档
- `video_chapters` - 视频智能章节
- `transcripts` - 视频/音频逐字稿
- `reading_progress` - 阅读进度记录
- `user_settings` - 用户阅读器偏好

**扩展表：**
- `notes`: 增加 `reading_position`, `read_percentage`, `estimated_read_time`
- `ai_outputs`: 增加 `journalist_view`, `timeline`, `visual_summary`, `deepfake_warning`
- `highlights`: 增加 `timecode` (视频批注时间戳)
- `annotations`: 增加 `screenshot_url`, `timecode`

### API端点

**新增：**
- `POST /api/ai/analyze` - AI多视角解读
- `POST /api/ai/chat` - AI追问对话
- `POST /api/transcribe` - 视频/音频转写（腾讯云ASR）
- `POST /api/archive/create` - 创建网页快照
- `GET /api/archive/[id]` - 获取快照
- `POST /api/chapters/generate` - AI生成视频章节
- `PUT /api/reading-progress/[noteId]` - 更新阅读进度
- `POST /api/extract/jina` - Jina Reader内容提取

### 外部服务集成

- **OpenAI API**: AI解读、章节生成、追问对话
- **腾讯云ASR**: 视频/音频语音识别
- **Jina Reader API**: 高质量正文提取
- **Supabase Storage**: 快照、截图、媒体文件存储
- **Bilibili/抖音 API**: 视频元数据获取

### 技术栈补充

- **Radix UI**: Popover, Dialog, Slider, Tabs等高级组件
- **video.js / Plyr**: 视频播放器
- **react-markdown + remark-gfm**: Markdown渲染
- **shiki / prism**: 代码高亮
- **Selection API**: 划词菜单实现

## Impact

### Affected Specs

- **reader-page** (新增): 定义阅读页核心功能和交互规范
- **library**: 增加从列表跳转到沉浸式阅读页的需求
- **annotations**: 扩展批注功能（浮顶、视频批注、多色高亮）
- **ai-summaries**: 扩展AI分析功能（多视角、追问对话）
- **capture**: 增加Jina Reader集成、网页存档功能

### Affected Code

**新增：**
- `app/notes/[id]/read/` - 阅读页路由和组件
- `components/reader/` - 阅读器核心组件库
- `app/api/ai/`, `app/api/transcribe/`, `app/api/archive/` - API路由
- `lib/services/openai.ts` - OpenAI服务封装
- `lib/services/tencent-asr.ts` - 腾讯云ASR服务
- `lib/services/jina.ts` - Jina Reader服务
- `supabase/migrations/008_add_reader_page_schema.sql` - 数据库迁移

**修改：**
- `components/dashboard/dashboard-content.tsx` - 添加跳转到新阅读页的链接
- `components/notes/note-detail-content.tsx` - 可能保留作为简化版或重定向

### Breaking Changes

无破坏性变更。新阅读页作为独立路由 `/notes/[id]/read` 添加，原有 `/notes/[id]` 路由可保留或重定向。

### Migration Notes

1. 数据库迁移会创建新表，不影响现有数据
2. 现有notes数据会自动兼容新字段（使用默认值）
3. 用户首次访问新阅读页时，会自动创建默认阅读器设置
4. 现有highlights和annotations数据向后兼容

## Dependencies

- OpenAI API密钥（AI解读功能）
- 腾讯云ASR服务密钥（视频转写功能）
- Jina Reader API密钥（可选，用于内容提取增强）
- Supabase Storage配置（存档和截图存储）

## Risk Assessment

### 高风险
- **ASR成本**：腾讯云ASR按时长计费，需要控制调用频率和实现成本监控
- **存储成本**：网页快照可能占用大量空间，需要实现清理策略和存储配额

### 中风险
- **性能**：大文件（>10000字）渲染可能卡顿，需要虚拟滚动或懒加载
- **浏览器兼容**：Selection API和某些CSS特性需要polyfill
- **安全性**：iframe加载原网页需要CSP策略防止XSS

### 低风险
- **实时同步**：批注和进度更新可能有延迟，可使用Supabase Realtime优化

## Mitigation Strategies

1. **成本控制**：
   - ASR：实现转写缓存，避免重复调用
   - 存储：设置快照自动清理策略（如30天后删除）
   - 实现使用量监控和告警

2. **性能优化**：
   - 使用虚拟滚动（react-window）处理长文本
   - 图片懒加载
   - 代码分割，按需加载视频/AI功能模块

3. **安全加固**：
   - iframe使用sandbox属性
   - CSP策略限制外部资源加载
   - 用户输入内容严格sanitize

4. **兼容性**：
   - 提供Selection API polyfill
   - CSS使用autoprefixer
   - 提供降级方案（移动端简化交互）

## Timeline Estimate

- **Phase 1: 数据库 + 基础布局**（3-5天）
- **Phase 2: 图文阅读模式**（5-7天）
- **Phase 3: 批注系统增强**（3-4天）
- **Phase 4: AI解读集成**（4-5天）
- **Phase 5: 视频模式 + ASR**（7-10天）
- **Phase 6: 网页存档 + 设置**（3-4天）
- **Phase 7: 优化 + 测试**（3-5天）

**总计：约28-40天**

## Success Criteria

- [ ] 图文模式能正确渲染文章，支持划词批注，显示智能大纲
- [ ] 视频模式能播放视频，显示ASR逐字稿，支持章节跳转
- [ ] AI解读能生成多视角分析，支持追问对话
- [ ] 批注系统能创建多色高亮和批注，支持浮顶卡片
- [ ] 网页存档能保存和查看HTML快照
- [ ] 阅读器设置能调整外观，设置持久化
- [ ] 阅读进度能自动保存和恢复
- [ ] 页面在桌面和移动端都响应式适配
- [ ] 大文件（>10000字）渲染流畅（60fps）
- [ ] 通过安全审计（无XSS、CSRF漏洞）

