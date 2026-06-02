# 视频详情页设计 (VideoDetailLayout)

- **日期**：2026-05-30
- **作者**：zhuyu
- **状态**：草案 → 待审查
- **相关代码**：`components/reader/*`、`lib/ai-analysis/*`、`lib/workers/video-pipeline/*`、`supabase/migrations/023..025_*`
- **配套 mockup**：`docs/superpowers/specs/mockups/video-detail-page.html`

---

## 1. 概述与目标

为 `content_type === 'video'` 的笔记构建一个独立的视频详情页，深度集成通义听悟（Tingwu）与 Qwen-VL 的分析结果，让用户能够：

- 看视频时同步浏览 AI 生成的关键词、概要、章节速览
- 阅读带发言人分段的逐字稿，点击时间戳跳转到对应播放位置
- 浏览自动抽取的关键帧画廊（带场景描述）
- 在右栏富文本编辑器里写自己的灵感和思考
- 把原文片段、关键帧、批注**摘录**到笔记里形成可追溯的引用块

文章/视频信息架构差异显著，文章侧继续使用既有 `ReaderLayout`，**视频走完全独立的 `VideoDetailLayout`**。

---

## 2. 范围

### P0（本期实现）

- 主播放器（复用现有 `VideoPlayer`，video.js 2.0）
- 上次播放位置恢复
- 关键词 chip（折叠 + 展开全部）
- 全文概要（带"展开全部"）
- 章节速览 Tab（时间戳 + 标题）
- 关键帧画廊（复用 `VisualFrames` 数据）
- 按发言人分段显示原文逐字稿
- 点击任意时间戳跳转视频 + 智能播放语义（保持原 paused 状态）
- 当前播放句子高亮
- 文本选中浮窗（**只做"摘录到笔记"**，标记/批注复用 `annotations` 表）
- 标记/批注系统（复用现有 annotations 表）
- Tiptap 富文本笔记编辑器
- 笔记自动保存
- 摘录注入（原文 → 笔记的 TimeReference block，点击可跳转视频）
- 左栏工具条：返回 / 收藏 / 导出 / 更多
- 顶栏：标题 + 保存状态 + 发言人筛选 + 分析进度芯片 + 重新分析
- 底部 mini player（视频滚出视口后出现）
- 导出格式：Markdown、SRT、JSON
- 桌面优先响应式（< 1024px 单栏堆叠）

### P1（下一迭代）

- 发言总结 Tab、问答回顾 Tab
- 标记类型扩展（重点/疑问/待办，目前只做摘录）
- 原文搜索 + 猜你想搜
- 标记筛选（只看标记内容、按发言人筛）
- 翻译（双语显示/纯译文）
- AI 改写
- 移动端深度优化（视频 sticky + 笔记从底部抽屉滑出）
- Slash 命令菜单（在笔记里 `/` 插入时间戳/关键帧/批注引用）
- 画中画 PiP 按钮
- TaskList 节点（清单）

### 不做

- 多端协同实时编辑（Yjs/Liveblocks，P2 及以后）
- 笔记历史版本回溯（Live editing 替代方案）
- 导出 docx / PDF / 导出到云盘
- 桌面 only 提示（移动端最低做到"基础可看"）

---

## 3. 路由 & 集成策略

继续使用 `/notes/[id]`。在 `components/reader/ReaderPageWrapper.tsx`（已存在）顶层根据 `note.content_type` 分流：

```tsx
if (note.content_type === 'video') return <VideoDetailLayout note={note} videoJob={videoJob} />;
return <ReaderLayout note={note} />;
```

理由：
- Dashboard 卡片不需要区分跳转目标
- 用户"打开笔记"心智一致
- 老分享链接不失效

`audio` 类型 P0 暂时也走 `VideoDetailLayout`（视频播放器降级为音频播放器）。

---

## 4. 架构与组件

### 4.1 顶层布局（CSS Grid，桌面优先）

| 断点 | 布局 |
|---|---|
| `≥ 1440px (2xl)` | `grid-cols-[64px, 1fr, 480px]` |
| `1024-1440px (lg-xl)` | `grid-cols-[56px, 1fr, 420px]` |
| `< 1024px (md/sm)` | 单栏堆叠 + 顶部 Tab 切换（速览/原文/笔记）|

主区可滚动；右栏 3 Tab 切换，每个 Tab 独占整个右栏高度。

### 4.2 目录结构

```
components/video-detail/
├── VideoDetailLayout.tsx        # 顶层壳
├── LeftToolbar.tsx              # ← / ⭐ / 📥 / ⋯
├── TopBar.tsx                   # 标题 + 已保存状态 + 工具栏图标
├── MainStage/
│   ├── index.tsx
│   ├── VideoPlayerCard.tsx      # 包装现有 VideoPlayer + sticky
│   └── KeyframesGallery.tsx     # 关键帧画廊
├── RightPanel/
│   ├── index.tsx                # 3 Tab 容器
│   ├── BriefPanel.tsx           # 速览：关键词 + 概要 + 章节子 Tab
│   ├── TranscriptPanel.tsx      # 原文逐字稿
│   └── NotesPanel.tsx           # Tiptap 编辑器
├── notes/
│   ├── editor-config.ts         # Tiptap extensions 配置
│   ├── extensions/
│   │   ├── TimeReference.ts
│   │   ├── KeyframeReference.ts
│   │   └── AnnotationReference.ts
│   ├── NotesToolbar.tsx
│   └── SaveIndicator.tsx
├── MiniPlayer.tsx
├── AnalysisProgress.tsx
├── SpeakerPopover.tsx
├── ExportDialog.tsx
├── shared/
│   ├── TimestampChip.tsx
│   └── SelectionMenu.tsx
└── hooks/
    ├── useVideoSeek.ts
    ├── useVideoTimeUpdate.ts
    ├── useAutoSave.ts
    ├── useAnalysisProgress.ts
    ├── useExcerpt.ts
    └── useTiptapMount.ts
```

### 4.3 组件契约（关键节点）

**`VideoDetailLayout`** — 顶层容器，挂载 `VideoSeekProvider`（事件总线）和 `TiptapProvider`（编辑器实例 ref，常驻不销毁）。

**`MainStage`** — 主区滚动容器，通过 `IntersectionObserver` 监听 `VideoPlayerCard` 出视口 → 触发 `MiniPlayer` 显示。

**`VideoPlayerCard`** — 包 `VideoPlayer` + `sticky top-[60px]` + 上次播放位置恢复 toast。
- 暴露事件：`onTimeUpdate(t)`、`onPlayPause(state)`、`exposePlayerHandle(handle)`
- 监听：`window.addEventListener('video:seek', ...)`

**`MiniPlayer`** — fixed bottom 56px 高度。通过 `playerHandle` 控制同一个 video.js 实例（不复制 player，UI 镜像）。

**`RightPanel`** — 3 Tab 容器。Tab 切换通过 CSS `display` 控制可见性（不卸载组件，保留状态）。
- Tab 选择存 `sessionStorage('video-detail.activeTab')`，默认 `brief`。

**`TranscriptPanel`** — 复用现有 `TranscriptView` 大部分逻辑（已监听 `video:timeupdate`、已有当前句高亮），扩展：
- 文本选中浮窗 → 摘录到笔记按钮
- 摘录动作 → `tiptapEditor.commands.insertContent(TimeReferenceNode)` + 自动切换到笔记 Tab + 闪烁动画

**子 Tab `ChaptersTab`/`SpeakerSummaryTab`/`QATab`** — P0 只做章节，其余 P1。统一契约：
```ts
interface Props {
  items: Array<{ start: number; end?: number; title?: string; speakerId?: string; q?: string; a?: string }>;
  onSeek: (time: number) => void;
}
```

**`AnalysisProgress`** — 订阅 `/api/ai/video/[jobId]/status` (SWR, refreshInterval 5s, refreshWhenHidden=false)，所有阶段 done 后停止轮询。Popover 展开显示各步骤细粒度状态 + 失败步骤的单步重试按钮。

---

## 5. 数据模型与存储

### 5.1 Schema 变更（migration 026）

```sql
-- 026_add_user_notes_field.sql
ALTER TABLE notes
  ADD COLUMN user_notes JSONB,
  ADD COLUMN user_notes_updated_at TIMESTAMPTZ;

-- 不加索引（笔记是私有数据，按 note_id 主键查询足够）
COMMENT ON COLUMN notes.user_notes IS 'Tiptap JSON document — 用户笔记内容（不同于 content：content 是导入的源内容）';
```

无需迁移现有数据。文章笔记 P0 不动 `user_notes` 字段，未来如需为文章也加用户笔记可复用此字段。

### 5.2 复用现有数据

| 现有字段 | 用途 |
|---|---|
| `notes.media_url`, `media_duration`, `media_cover_url` | 视频源信息 |
| `notes.content_type='video'` | 路由分流判断 |
| `video_jobs.audio_result` | Tingwu 输出（transcript/chapters/summary/keyPoints/qaPairs/keywords/speakers）|
| `video_jobs.visual_result` | Qwen-VL 输出（frame 场景描述/实体）|
| `video_jobs.frames` | 关键帧 URL + timestamp |
| `video_jobs.cos_url`（migration 023） / `transcoded_url`（migration 025） | 播放源；优先 transcoded_url，回退 cos_url |
| `video_jobs.*_status` | 流水线状态 |
| `annotations` | 用户标记（笔记里通过 `AnnotationReference` 引用 ID）|

### 5.3 `audio_result` 数据契约

依赖 `lib/ai-analysis/types.ts` 中的 `AudioAnalysisResult`。**需要扩展两个字段**（Tingwu 输出里已有，目前类型未定义）：
```ts
interface AudioAnalysisResult {
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  summary: string;
  keyPoints: string[];
  qaPairs: QAPair[];
  speakers?: Array<{ id: string; label: string }>;
  keywords?: string[];           // 新增：关键词列表（速览展示）
  speakerSummaries?: Array<{     // 新增：发言总结（P1 用，P0 不读取）
    speakerId: string;
    points: string[];
  }>;
}
```

`adapters/tingwu.ts` 需要把 Tingwu API 返回的 `Keywords` 和 `SpeakerSummaries` 映射到上面字段。

---

## 6. 数据流 & 状态管理

### 6.1 工具选型

- **Zustand**：本地 UI 状态（currentTime / isPlaying / activeTab / miniPlayerVisible / selectedSpeakers / pendingExcerpt / notesEditor ref）
- **SWR**：所有 server data（notes、video_job status、annotations 列表）
- **Tiptap useEditor**：编辑器状态自治
- **事件总线**：window CustomEvent（`video:seek` / `video:timeupdate` / `video:state`）
- 不用 Context（除 `VideoSeekProvider`、`TiptapProvider` 这种 dispatcher）

### 6.2 四条主链路

**A. 首屏渲染**：Server Component 拉 `notes + video_jobs + annotations` → 传给 `VideoDetailLayout` → 客户端 Zustand 初始化。

**B. 分析进度轮询**：`useSWR('/api/ai/video/[jobId]/status', { refreshInterval: 5000 })`，全部 done 后停止。任何 status 从 in_progress → done 时触发 `mutate('/api/notes/[id]')` 拉最新数据。

**C. 视频时间同步（最高频）**：video.js timeupdate → 节流 250ms → `video:timeupdate` 事件 → 章节高亮 / 句子高亮 / mini player 进度同步。反向：组件 dispatch `video:seek` → VideoPlayer 监听 + 按"保持原 paused 状态"语义决定是否 play。

**D. 笔记自动保存**：Tiptap onUpdate → 防抖 1500ms → `PATCH /api/notes/[id]` `{ user_notes }` → 更新 SaveIndicator。失败指数退避（1s/2s/4s）3 次后变红提示手动重试。`beforeunload` 检测未保存变更 + `sendBeacon` 兜底。

### 6.3 跨 Tab 编辑器实例常驻

3 Tab 切换通过 CSS display 控制，**Tiptap 实例只挂载一次，常驻不销毁**。这样：
- 切 Tab 不丢失编辑状态、光标、历史
- 原文 Tab 的"摘录"按钮可以通过共享的 `editor` ref 调用 `insertContent`，往任意时刻的笔记里写内容

---

## 7. Tiptap 自定义节点

### 7.1 `TimeReference`（块级 atom）

```ts
{
  type: 'timeReference',
  attrs: { videoTime: 195, speakerLabel: '发言人 1', excerpt: '这次的会议主要是...' }
}
```

渲染为左 border 紫色卡片，时间戳是按钮，点击 dispatch `video:seek`。excerpt 文本不可直接编辑（防止失真），块整体可删除。

### 7.2 `KeyframeReference`（块级 atom）

```ts
{
  type: 'keyframeReference',
  attrs: { timestamp: 195, imageUrl: '...', sceneDescription: '主持人讲述创新理念' }
}
```

缩略图 160×90 + caption。点击 seek + 弹 `ImageLightbox`（复用 `components/reader/ImageLightbox.tsx`）。

### 7.3 `AnnotationReference`（块级 atom，订阅式）

```ts
{ type: 'annotationReference', attrs: { annotationId: 'uuid' } }
```

**只存 ID，不存快照**。NodeView 用 React，内部 `useSWR(['annotation', id])` 拉实时数据。annotation 被删 → 显示"该批注已删除"灰色占位 + 移除引用按钮。

### 7.4 完整扩展列表

```ts
useEditor({
  extensions: [
    StarterKit,
    Underline,
    Highlight.configure({ multicolor: false }),
    TextStyle, Color,
    Image,
    Table, TableRow, TableHeader, TableCell,
    Placeholder.configure({ placeholder: '记录你的灵感和思考...' }),
    CharacterCount,
    TimeReference,
    KeyframeReference,
    AnnotationReference,
  ],
});
```

---

## 8. Loading & 错误处理

### 8.1 各区块 Loading 状态

| 区块 | 就绪条件 | 未就绪显示 |
|---|---|---|
| 视频播放器 | `cos_url \|\| transcoded_url` | skeleton + "视频下载中... XXMB/XXMB" |
| 关键帧画廊 | `frame_status === 'done'` | 8 灰卡 + spinner |
| 关键词 | `audio_result.keywords?.length > 0` | 6 个 skeleton chip |
| 概要 | `audio_result.summary` | 4 行段落 skeleton |
| 章节速览 | `audio_result.chapters?.length > 0` | "AI 分析中...ETA X 分钟" + spinner |
| 原文 | `audio_result.transcript?.length > 0` | "字幕生成中" + 进度条 |
| 笔记 Tab | 始终就绪 | — |

ETA 估算公式：`视频时长 × 0.3 - 已进行时长`。

### 8.2 失败处理

| 情况 | 处理 |
|---|---|
| 下载失败 | 错误卡 + 错误原因 + 重试下载 + 打开原始链接 |
| 需要浏览器兜底 | 引导用户安装扩展 |
| 转码失败 | 用 `cos_url` 原始文件兜底 |
| Tingwu 失败 | AI 区块显示错误 + 重新分析按钮；视频和笔记不受影响 |
| Qwen-VL 失败 | 关键帧降级为无场景描述纯缩略图 |
| Annotation 引用失效 | 灰色"该批注已删除"占位 + 移除引用 |
| 笔记保存失败 | SaveIndicator 红 + 点击重试；sendBeacon 兜底 |

### 8.3 边界场景

| 场景 | 处理 |
|---|---|
| video_job 还没创建 | 后端 `ensureVideoJob(noteId)`，前端"正在初始化..." |
| 视频 > 60min（Tingwu 限制）| 提交前预检 + 警告 + "仍然分析"按钮 |
| 多标签页同时编辑 | 乐观锁：PATCH 带 `If-Match: <last_updated_at>` |
| 视频 < 10s | 跳过 Tingwu 和关键帧抽取，速览显示"视频过短" |

### 8.4 原则

- **就近显示**错误，不用全局 toast
- **总是给 next step**（重试/支持/原始链接/删除）
- **不阻塞其他区块**：AI 失败不影响播放和笔记
- **失败原因可见**：直接展示给用户

---

## 9. API 变更

P0 主要复用现有 API，新增/修改少量：

| API | 变更 |
|---|---|
| `GET /api/notes/[id]` | 返回值新增 `user_notes` 字段（已存的话） |
| `PATCH /api/notes/[id]` | 接受 `{ user_notes: TiptapJSON }` 部分更新；写入时同时更新 `user_notes_updated_at` |
| `GET /api/ai/video/[jobId]/status` | 已有，无变更 |
| `POST /api/ai/video/[jobId]/retry` | 已有，支持 `?step=audio\|visual\|frame\|download` 单步重试（P0 新增） |
| `GET /api/notes/[id]/export` | **新增**：`?format=md\|srt\|json`，返回对应格式的 stream/Blob |

注：`sendBeacon` 兜底草稿不需要独立端点。直接复用 `PATCH /api/notes/[id]`，sendBeacon 的 Content-Type 限制（`text/plain` 等）由后端容错解析处理。

---

## 10. 测试策略

### 10.1 单元测试（Vitest）

- `useVideoSeek` hook：play/pause 状态保持逻辑
- `useAutoSave` hook：防抖、指数退避重试、失败状态切换
- `useAnalysisProgress` hook：百分比计算、轮询停止条件
- Tiptap 节点 schema：JSON 序列化/反序列化、未知节点降级
- 导出逻辑：MD/SRT/JSON 格式生成

### 10.2 组件测试（Vitest + Testing Library）

- `TranscriptPanel`：当前句高亮跟随 timeupdate
- `SelectionMenu`：选中文本后 "摘录到笔记" 触发 → 切 Tab + insertContent
- `ChaptersTab`：点击章节触发 seek 事件
- `MiniPlayer`：IntersectionObserver 触发显隐
- `AnalysisProgress`：失败步骤显示重试按钮
- `SaveIndicator`：4 个状态（idle/saving/saved/failed）渲染

### 10.3 集成测试（Playwright）

- 进入视频笔记 → 看到三栏布局 + sticky 视频
- 点章节时间戳 → 视频 seek + 高亮变化
- 在原文 Tab 选中文字 → 浮窗出 → 点摘录 → Tab 切换 + 新块插入
- 写笔记 → 1.5s 后看到"已保存"
- 笔记里点 TimeReference 时间戳 → 视频 seek
- 模拟保存失败 → SaveIndicator 红 + 点击重试成功
- 关闭页面再打开 → 笔记内容还在

### 10.4 手动验收（必跑）

- 进入一个新视频笔记（分析未完成）→ 视频可播 + 笔记可写 + 速览/原文显示 loading
- AI 分析完成后所有区块就绪
- < 1024px 视口检查单栏堆叠
- 导出 MD/SRT/JSON 检查内容完整
- 关键帧画廊「加到笔记」→ 缩略图块出现在笔记里
- 笔记里删除一个 annotation 引用 → 引用块变灰
- 视频 > 60min 上传 → 看到警告

---

## 11. 风险 & 开放问题

### 11.1 已知风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Tiptap bundle 体积约 +120KB | 首屏延迟 | 用 Next.js 动态导入（`dynamic(() => import(...), { ssr: false })`），仅在视频 Tab 渲染时加载 |
| 长视频 transcript 段落 >1000 条 | 原文 Tab 渲染卡顿 | 用虚拟列表（`@tanstack/react-virtual`） |
| 多标签页并发编辑 | 数据覆盖 | `If-Match` 乐观锁 + 冲突 UI |
| video.js 跨 Tab 实例同步 | mini player 不同步 | 共用同一实例 + 镜像 UI，不复制 player |
| Annotation 大量被删后笔记里全是墓碑 | 体验差 | 给"批量清理失效引用"按钮（P1） |

### 11.2 开放问题（请决策者关注）

1. **分析进度轮询是否升级 SSE/WebSocket**：P0 用 5s 轮询，简单可行；如果未来后端推送基础设施完善，可升级。MVP 不做。
2. **`audio_result.keywords` 字段是否由 Tingwu 返回**：需要确认 Tingwu API 是否直接提供关键词。如果没有，需要在 Tingwu 完成后**额外调用 OpenAI** 生成（成本和延迟权衡）。Action item: 检查 `lib/ai-analysis/adapters/tingwu.ts` 当前是否拿到关键词。
3. **导出格式是否需要附带笔记**：导出 MD 时，是「源内容（transcript + 速览）」还是「源内容 + 用户笔记」拼接？建议默认包含笔记，用户可在导出对话框勾选。
4. **`audio` 类型笔记的播放器形态**：是否需要专门的音频波形 UI，还是 video.js 隐藏画面足够？P0 后者，P1 再优化。

---

## 12. 参考资料

- 通义听悟产品页：作为 1:1 UX 参考来源（见 mockup 同目录截图）
- 现有视频流水线 spec：`docs/superpowers/specs/2026-05-12-video-and-storage-design.md`
- AI 分析层类型定义：`lib/ai-analysis/types.ts`
- 现有 ReaderLayout：`components/reader/ReaderLayout.tsx`
- Mockup：`docs/superpowers/specs/mockups/video-detail-page.html`
