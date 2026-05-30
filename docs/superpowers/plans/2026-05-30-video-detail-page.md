# 视频详情页实施计划 (VideoDetailLayout)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `content_type === 'video'` 笔记构建独立的视频详情页（三栏 + 3 Tab + Tiptap 笔记），深度集成 Tingwu + Qwen-VL 分析结果。

**Architecture:** 在 `ReaderPageWrapper` 顶层按 `content_type` 分流，video 进入新建的 `VideoDetailLayout`。布局：左 64px 工具条 + 主区(视频+关键帧) + 右栏 480px(3 Tab：速览/原文/笔记)。视频播放/时间同步走 window CustomEvent 总线（`video:seek`/`video:timeupdate`），笔记用 Tiptap 富文本，自动保存写 `notes.user_notes` JSONB 字段。

**Tech Stack:** Next.js 15 App Router、React 19、Tiptap、Zustand、SWR、video.js（已集成）、Tailwind、Supabase、Vitest。

**Spec:** `docs/superpowers/specs/2026-05-30-video-detail-page-design.md`
**Mockup:** `docs/superpowers/specs/mockups/video-detail-page.html`

---

## 文件结构总览

```
新增：
  supabase/migrations/026_add_user_notes_field.sql
  components/video-detail/
    VideoDetailLayout.tsx                   # 顶层壳
    store.ts                                # Zustand: currentTime, activeTab, miniPlayerVisible, ...
    LeftToolbar.tsx                         # ← / ⭐ / 📥 / ⋯
    TopBar.tsx                              # 标题+保存状态+工具栏图标
    AnalysisProgress.tsx                    # 顶栏分析进度芯片+popover
    SpeakerPopover.tsx                      # 发言人筛选/重命名
    ExportDialog.tsx                        # md/srt/json 导出对话框
    MiniPlayer.tsx                          # 底部跟随播放器
    MainStage/
      index.tsx
      VideoPlayerCard.tsx                   # 包装 VideoPlayer + sticky
      KeyframesGallery.tsx
    RightPanel/
      index.tsx                             # 3 Tab 容器
      BriefPanel.tsx
      TranscriptPanel.tsx
      NotesPanel.tsx
      KeywordsRow.tsx
      SummaryBlock.tsx
      ChaptersTab.tsx
    notes/
      editor-config.ts                      # Tiptap extensions 数组
      NotesToolbar.tsx
      SaveIndicator.tsx
      extensions/
        TimeReference.ts
        KeyframeReference.ts
        AnnotationReference.tsx             # React NodeView（订阅式）
    shared/
      TimestampChip.tsx
      SelectionMenu.tsx                     # 原文选中浮窗（"摘录到笔记"）
    hooks/
      useVideoSeek.ts
      useVideoTimeUpdate.ts
      useAutoSave.ts
      useAnalysisProgress.ts
      useExcerpt.ts
      useTiptapMount.ts
  app/api/notes/[id]/export/route.ts        # md/srt/json 导出

修改：
  lib/ai-analysis/types.ts                  # AudioAnalysisResult 加 keywords?: string[]
  lib/ai-analysis/adapters/tingwu.ts        # 把 keyPoints?.KeyWords 映射到 keywords
  components/reader/ReaderPageWrapper.tsx   # 顶层按 content_type 分流到 VideoDetailLayout
  app/api/ai/video/[jobId]/retry/route.ts   # 接受 ?step= 参数（按需）

测试：
  tests/lib/ai-analysis/adapters/tingwu.test.ts    # 现有，补 keywords 映射断言
  tests/video-detail/hooks/useVideoSeek.test.ts
  tests/video-detail/hooks/useAutoSave.test.ts
  tests/video-detail/notes/extensions/TimeReference.test.ts
  tests/video-detail/notes/extensions/AnnotationReference.test.ts
```

---

## ⚠️ 重要：实施前必读

### 现有 `video:seek` emit 站点必须统一改造

当前代码里有 **5 个组件**已经 dispatch `video:seek` 事件，载荷格式为 `{ time }`，没有 autoplay 模式：

- `components/reader/LeftSidebar/VideoChapters.tsx`
- `components/reader/RightSidebar/VisualFrames.tsx`
- `components/reader/RightSidebar/AnnotationList.tsx`（如果存在 seek 用例）
- `components/reader/RightSidebar/QAPanel.tsx`
- `components/reader/RightSidebar/TranscriptView.tsx`

而当前 `components/reader/ContentStage/VideoPlayer.tsx:137-139` 监听 `video:seek` 后**无条件 `player.play()`**。

**新契约**（必须在 Phase 2 之前完成 Phase 0.5 的全局改造）：

```ts
// 事件载荷
window.dispatchEvent(new CustomEvent('video:seek', {
  detail: { time: number, autoplay?: 'preserve' | 'force' | 'none' }
}));
// 不传 autoplay 时默认 'preserve'（保持原 paused 状态）
```

**VideoPlayer 监听器改造**：

```ts
const onSeek = (e: Event) => {
  const ce = e as CustomEvent<{ time: number; autoplay?: 'preserve' | 'force' | 'none' }>;
  const player = playerRef.current;
  if (!player) return;
  const wasPaused = player.paused();
  player.currentTime(ce.detail.time);
  const mode = ce.detail.autoplay ?? 'preserve';
  if (mode === 'force' || (mode === 'preserve' && !wasPaused)) {
    player.play();
  }
};
```

5 个 emit 站点保留原有 `{ time }` 载荷即可（默认 preserve 兼容）。如果某个站点希望"force play"，改成 `{ time, autoplay: 'force' }`。

### `VideoDetailLayout` 必须在 AnimatePresence 之外渲染

`ReaderPageWrapper.tsx` 用了 `AnimatePresence keyed on note.id`，切换笔记会卸载所有子组件——包括我们要保留的 Tiptap 实例。**分流要在 AnimatePresence 之前**：

```tsx
// ✅ 正确
if (note?.content_type === 'video') return <VideoDetailLayout ... />;
return (
  <AnimatePresence>
    <motion.div key={note.id}>
      <ReaderLayout ... />
    </motion.div>
  </AnimatePresence>
);
```

`VideoDetailLayout` 内部也不要再用 key={note.id} 的 AnimatePresence 包整层。切换不同视频笔记时整页正常重渲染即可（Tiptap 实例随之销毁是预期的，跨 note 不需要保留编辑状态）。

### `audio` content_type 暂不走 VideoDetailLayout

Spec §3 提到 `audio` P0 走 VideoDetailLayout，但要求依赖 `video_jobs` 表存在对应行。**实际验证**：当前 audio 类型笔记的 capture pipeline 是否会创建 `video_jobs` 行？如果不会，audio 笔记进入 VideoDetailLayout 会因为 `videoJob === null` 在多处崩溃。

**保守策略**：本期 audio 类型继续走 ReaderLayout，等 audio pipeline 也接入 video_jobs 后再开 VideoDetailLayout。分流条件改为 `content_type === 'video'`（严格匹配，不含 audio）。

---

## Phase 0: Foundation（类型 + 迁移 + Tingwu keywords 映射）

### Task 0.1: 扩展 AudioAnalysisResult 类型

**Files:**
- Modify: `lib/ai-analysis/types.ts`

- [ ] **Step 1: 修改 `AudioAnalysisResult` 接口，新增 keywords 字段**

```ts
// lib/ai-analysis/types.ts
export interface AudioAnalysisResult {
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  summary: string;
  keyPoints: string[];
  qaPairs: QAPair[];
  speakers?: Array<{ id: string; label: string }>;
  keywords?: string[];   // 新增：用于速览 Tab 展示
  speakerSummaries?: Array<{ speakerId: string; points: string[] }>; // P1 用，P0 不读取但类型预留
}
```

- [ ] **Step 2: 跑类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误（已有读取 `audio_result` 的地方对新字段是可选访问，应该兼容）

- [ ] **Step 3: 提交**

```bash
git add lib/ai-analysis/types.ts
git commit -m "feat(types): AudioAnalysisResult 新增 keywords / speakerSummaries 字段"
```

### Task 0.2: 测试 Tingwu adapter 正确映射 keywords

> **已确认**：`lib/ai-analysis/adapters/tingwu.ts` 当前代码确实从 `keyPoints?.KeyWords ?? keyPoints?.Keywords` 拿到关键词数组，只是没写到返回对象的 `keywords` 字段。本 task 只是把它写出来。不需要额外 OpenAI fallback。

**Files:**
- Modify: `tests/lib/ai-analysis/adapters/tingwu.test.ts`（如果不存在则 Create）
- Modify: `lib/ai-analysis/adapters/tingwu.ts`

- [ ] **Step 1: 写失败测试 — keywords 字段从 KeyWords 映射**

```ts
// tests/lib/ai-analysis/adapters/tingwu.test.ts
import { describe, it, expect } from 'vitest';
import { mapTingwuToResult } from '@/lib/ai-analysis/adapters/tingwu';

describe('Tingwu adapter mapping', () => {
  it('maps keyPoints.KeyWords to result.keywords', () => {
    const result = mapTingwuToResult({
      transcription: { Paragraphs: [] },
      autoChapters: { Chapters: [] },
      summarization: { Summary: '' },
      keyPoints: { KeyWords: ['北京电视台', '向前一步', '电视剧'] },
      meeting: null,
    });
    expect(result.keywords).toEqual(['北京电视台', '向前一步', '电视剧']);
  });
});
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `npm test -- tingwu`
Expected: FAIL（`mapTingwuToResult` 可能未导出，或 keywords 字段为 undefined）

- [ ] **Step 3: 修改 `lib/ai-analysis/adapters/tingwu.ts`**

如果该函数没有导出，提取/导出之；并把已经从 `keyPoints?.KeyWords ?? keyPoints?.Keywords` 拿到的关键词数组写到返回对象的 `keywords` 字段。

具体修改（在返回对象处）：

```ts
return {
  transcript,
  chapters,
  summary,
  keyPoints: keyPointsList,
  qaPairs,
  speakers: ...,
  keywords: keywords ?? [],   // 新增
};
```

- [ ] **Step 4: 跑测试**

Run: `npm test -- tingwu`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/ai-analysis/adapters/tingwu.ts tests/lib/ai-analysis/adapters/tingwu.test.ts
git commit -m "feat(tingwu): 把 KeyWords 映射到 AudioAnalysisResult.keywords"
```

### Task 0.5: VideoPlayer 事件契约统一改造

**Files:**
- Modify: `components/reader/ContentStage/VideoPlayer.tsx`

- [ ] **Step 1: 改造 `video:seek` 监听器支持 autoplay 模式**

定位 VideoPlayer 中现有 `video:seek` 监听器（约 line 137-139），按上述「VideoPlayer 监听器改造」代码片段替换。

- [ ] **Step 2: 新增 `video:timeupdate` dispatch**

在 video.js 的 `timeupdate` 回调里追加（节流 250ms）：

```ts
let lastDispatch = 0;
playerRef.current?.on('timeupdate', () => {
  const now = Date.now();
  if (now - lastDispatch < 250) return;
  lastDispatch = now;
  const time = playerRef.current?.currentTime() ?? 0;
  window.dispatchEvent(new CustomEvent('video:timeupdate', { detail: { time } }));
});
```

- [ ] **Step 3: 新增 `video:state` dispatch（play/pause）**

```ts
playerRef.current?.on('play', () => {
  window.dispatchEvent(new CustomEvent('video:state', { detail: { paused: false } }));
});
playerRef.current?.on('pause', () => {
  window.dispatchEvent(new CustomEvent('video:state', { detail: { paused: true } }));
});
```

- [ ] **Step 4: 新增 `video:toggle-play` listener（MiniPlayer 用）**

```ts
useEffect(() => {
  const handler = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.paused()) p.play(); else p.pause();
  };
  window.addEventListener('video:toggle-play', handler);
  return () => window.removeEventListener('video:toggle-play', handler);
}, []);
```

- [ ] **Step 5: 验证文章详情页（ReaderLayout 里）的视频不受影响**

实际上 article 笔记类型不渲染 VideoPlayer，但稳妥起见在 dev 模式下检查文章详情页 console 无新报错。

- [ ] **Step 6: 提交**

```bash
git add components/reader/ContentStage/VideoPlayer.tsx
git commit -m "feat(video-player): 统一事件契约（seek autoplay 模式 + timeupdate + state + toggle-play）"
```

### Task 0.3: Migration — `notes.user_notes` JSONB 字段

**Files:**
- Create: `supabase/migrations/026_add_user_notes_field.sql`

- [ ] **Step 1: 写迁移**

```sql
-- 026_add_user_notes_field.sql
-- 用户在视频详情页右栏笔记区写的内容（Tiptap JSON 格式）
-- 与现有 notes.content 区分：content 是导入的源内容，user_notes 是用户输出

ALTER TABLE notes
  ADD COLUMN user_notes JSONB,
  ADD COLUMN user_notes_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN notes.user_notes IS 'Tiptap JSON document — 用户在视频详情页写的笔记';
COMMENT ON COLUMN notes.user_notes_updated_at IS '笔记最后更新时间，用于乐观锁';
```

- [ ] **Step 2: 本地应用迁移**

Run: `npx supabase db push`（如果用 Supabase CLI）或者在 Supabase Dashboard SQL Editor 执行
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add supabase/migrations/026_add_user_notes_field.sql
git commit -m "feat(db): notes 表新增 user_notes JSONB 字段"
```

---

## Phase 1: Layout Shell（路由分流 + 空骨架 + 基础 store）

### Task 1.1: Zustand store 骨架

**Files:**
- Create: `components/video-detail/store.ts`

- [ ] **Step 1: 创建 store**

```ts
// components/video-detail/store.ts
import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

interface VideoDetailState {
  currentTime: number;
  isPlaying: boolean;
  activeTab: 'brief' | 'transcript' | 'notes';
  activeBriefSubTab: 'chapters' | 'speakers' | 'qa';
  miniPlayerVisible: boolean;
  selectedSpeakers: Set<string>;
  notesEditor: Editor | null;

  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActiveTab: (t: 'brief' | 'transcript' | 'notes') => void;
  setActiveBriefSubTab: (t: 'chapters' | 'speakers' | 'qa') => void;
  setMiniPlayerVisible: (v: boolean) => void;
  toggleSpeaker: (id: string) => void;
  setNotesEditor: (e: Editor | null) => void;
}

export const useVideoDetailStore = create<VideoDetailState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  activeTab: (typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('video-detail.activeTab') as any) || 'brief'
    : 'brief'),
  activeBriefSubTab: 'chapters',
  miniPlayerVisible: false,
  selectedSpeakers: new Set(),
  notesEditor: null,

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setActiveTab: (t) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('video-detail.activeTab', t);
    set({ activeTab: t });
  },
  setActiveBriefSubTab: (t) => set({ activeBriefSubTab: t }),
  setMiniPlayerVisible: (v) => set({ miniPlayerVisible: v }),
  toggleSpeaker: (id) => set((s) => {
    const next = new Set(s.selectedSpeakers);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedSpeakers: next };
  }),
  setNotesEditor: (e) => set({ notesEditor: e }),
}));
```

- [ ] **Step 2: tsc 通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/store.ts
git commit -m "feat(video-detail): Zustand store 骨架"
```

### Task 1.2: VideoDetailLayout 空壳

**Files:**
- Create: `components/video-detail/VideoDetailLayout.tsx`

- [ ] **Step 1: 创建空壳布局**

```tsx
"use client";

import type { Note, VideoJobRow } from '@/components/reader/ReaderPageWrapper';

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  return (
    <div className="h-screen grid bg-slate-50 dark:bg-slate-950" style={{ gridTemplateColumns: '64px 1fr 480px' }}>
      <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* LeftToolbar — Phase 9 */}
      </aside>

      <main className="overflow-y-auto relative">
        {/* TopBar — Phase 8 */}
        <div className="p-6 space-y-6">
          {/* MainStage — Phase 3 */}
          <div className="rounded-xl bg-slate-200 dark:bg-slate-800" style={{ aspectRatio: '16/9' }}>
            视频播放器占位 · {note.title}
          </div>
        </div>
      </main>

      <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* RightPanel — Phase 4-7 */}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: tsc 通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): VideoDetailLayout 空壳"
```

### Task 1.3: ReaderPageWrapper 按 content_type 分流

> **关键**：分流必须在 AnimatePresence **外层**做（避免切换笔记时 Tiptap 实例被卸载）。条件严格匹配 `content_type === 'video'`，**不包括 audio**（audio 暂时继续走 ReaderLayout）。

**Files:**
- Modify: `components/reader/ReaderPageWrapper.tsx`

- [ ] **Step 1: 在 ReaderPageWrapper 渲染处分流**

定位到 ReaderPageWrapper 中渲染 `<ReaderLayout ...>` 的位置，添加分流逻辑：

```tsx
import { VideoDetailLayout } from "@/components/video-detail/VideoDetailLayout";

// ... 在 render 部分：
if (note && note.content_type === 'video') {
  return <VideoDetailLayout note={note} videoJob={note.video_job ?? null} />;
}
return <ReaderLayout note={note} ... />;
```

注意：保留所有现有逻辑（loading skeleton / browse history 等），只在最后渲染处分流。

- [ ] **Step 2: 启动 dev server，访问一个 video 类型笔记，确认看到空壳**

Run: `npm run dev` (后台启动)
访问：`http://localhost:3000/notes/<某个 video 笔记 id>`
Expected: 看到三栏空壳，主区显示"视频播放器占位 · 标题"

- [ ] **Step 3: 提交**

```bash
git add components/reader/ReaderPageWrapper.tsx
git commit -m "feat(reader): video 类型笔记分流到 VideoDetailLayout"
```

---

## Phase 2: 视频事件总线 + 核心 hooks

### Task 2.1: useVideoSeek hook + 测试

**Files:**
- Create: `components/video-detail/hooks/useVideoSeek.ts`
- Create: `tests/video-detail/hooks/useVideoSeek.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/video-detail/hooks/useVideoSeek.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoSeek } from '@/components/video-detail/hooks/useVideoSeek';

describe('useVideoSeek', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches video:seek with preserve autoplay by default', () => {
    const listener = vi.fn();
    window.addEventListener('video:seek', listener);

    const { result } = renderHook(() => useVideoSeek());
    act(() => result.current.seek(123));

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 123, autoplay: 'preserve' });

    window.removeEventListener('video:seek', listener);
  });

  it('seekAndPlay forces autoplay', () => {
    const listener = vi.fn();
    window.addEventListener('video:seek', listener);

    const { result } = renderHook(() => useVideoSeek());
    act(() => result.current.seekAndPlay(99));

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 99, autoplay: 'force' });

    window.removeEventListener('video:seek', listener);
  });
});
```

- [ ] **Step 2: 跑测试，预期失败**

Run: `npm test -- useVideoSeek`
Expected: FAIL（hook 未实现）

- [ ] **Step 3: 实现 hook**

```ts
// components/video-detail/hooks/useVideoSeek.ts
"use client";

type Autoplay = 'preserve' | 'force' | 'none';

export function useVideoSeek() {
  function dispatch(time: number, autoplay: Autoplay) {
    window.dispatchEvent(new CustomEvent('video:seek', { detail: { time, autoplay } }));
  }
  return {
    seek: (time: number) => dispatch(time, 'preserve'),
    seekAndPlay: (time: number) => dispatch(time, 'force'),
    seekOnly: (time: number) => dispatch(time, 'none'),
  };
}
```

- [ ] **Step 4: 跑测试**

Run: `npm test -- useVideoSeek`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add components/video-detail/hooks/useVideoSeek.ts tests/video-detail/hooks/useVideoSeek.test.ts
git commit -m "feat(video-detail): useVideoSeek hook + 测试"
```

### Task 2.2: useVideoTimeUpdate hook

**Files:**
- Create: `components/video-detail/hooks/useVideoTimeUpdate.ts`

- [ ] **Step 1: 实现 hook（订阅 video:timeupdate）**

```ts
// components/video-detail/hooks/useVideoTimeUpdate.ts
"use client";
import { useEffect } from 'react';

export function useVideoTimeUpdate(callback: (time: number) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ time: number }>;
      if (typeof ce.detail?.time === 'number') callback(ce.detail.time);
    };
    window.addEventListener('video:timeupdate', handler);
    return () => window.removeEventListener('video:timeupdate', handler);
  }, [callback]);
}
```

- [ ] **Step 2: tsc 通过 + 提交**

```bash
npx tsc --noEmit
git add components/video-detail/hooks/useVideoTimeUpdate.ts
git commit -m "feat(video-detail): useVideoTimeUpdate hook"
```

### Task 2.3: useAnalysisProgress hook + SWR 轮询

**Files:**
- Create: `components/video-detail/hooks/useAnalysisProgress.ts`

- [ ] **Step 1: 实现 hook**

```ts
// components/video-detail/hooks/useAnalysisProgress.ts
"use client";
import useSWR from 'swr';

interface JobStatus {
  download_status: string;
  probe_status: string;
  cover_status: string;
  frame_status: string;
  audio_status: string;
  visual_status: string;
}

const STEPS = ['download', 'probe', 'cover', 'frame', 'audio', 'visual'] as const;
const STEP_LABELS: Record<string, string> = {
  download: '视频下载', probe: '元信息探测', cover: '智能封面',
  frame: '关键帧抽取', audio: '字幕生成', visual: '视觉分析',
};

export function useAnalysisProgress(jobId: string | null) {
  const { data, error, mutate } = useSWR<JobStatus>(
    jobId ? `/api/ai/video/${jobId}/status` : null,
    (url: string) => fetch(url).then(r => r.json()),
    {
      refreshInterval: (data) => {
        if (!data) return 5000;
        const allDone = STEPS.every((s) => {
          const v = (data as any)[`${s}_status`];
          return v === 'done' || v === 'failed' || v === 'skipped';
        });
        return allDone ? 0 : 5000;
      },
      refreshWhenHidden: false,
    }
  );

  const steps = STEPS.map((s) => ({
    key: s,
    label: STEP_LABELS[s],
    status: (data as any)?.[`${s}_status`] ?? 'pending',
  }));
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const overallPercent = Math.round((doneCount / STEPS.length) * 100);
  const isComplete = doneCount === STEPS.length;

  return { steps, overallPercent, isComplete, error, refetch: mutate };
}
```

- [ ] **Step 2: tsc 通过 + 提交**

```bash
npx tsc --noEmit
git add components/video-detail/hooks/useAnalysisProgress.ts
git commit -m "feat(video-detail): useAnalysisProgress hook（SWR 轮询）"
```

---

## Phase 3: 主区 — 视频 + 关键帧 + Mini Player

> Phase 2 之前确认已经完成 Task 0.5（VideoPlayer 事件契约改造）。否则下面的 VideoPlayerCard 拿不到 video:timeupdate 事件。

### Task 3.1: VideoPlayerCard（包装 + sticky + 事件监听）

**Files:**
- Create: `components/video-detail/MainStage/VideoPlayerCard.tsx`

- [ ] **Step 1: 实现 VideoPlayerCard**

```tsx
// components/video-detail/MainStage/VideoPlayerCard.tsx
"use client";
import { useEffect, useRef } from 'react';
import { VideoPlayer } from '@/components/reader/ContentStage/VideoPlayer';
import { useVideoDetailStore } from '../store';
import type { Note } from '@/components/reader/ReaderPageWrapper';

export function VideoPlayerCard({ note }: { note: Note }) {
  const setCurrentTime = useVideoDetailStore((s) => s.setCurrentTime);
  const setIsPlaying = useVideoDetailStore((s) => s.setIsPlaying);
  const setMiniPlayerVisible = useVideoDetailStore((s) => s.setMiniPlayerVisible);
  const ref = useRef<HTMLDivElement>(null);

  // IntersectionObserver — 视频滚出视口时显示 MiniPlayer
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setMiniPlayerVisible(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [setMiniPlayerVisible]);

  // 现有 VideoPlayer 已经在内部监听 video:seek 事件，且会 dispatch video:timeupdate
  // 此处只需把 timeupdate 同步到 store
  useEffect(() => {
    const onTimeUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ time: number }>;
      if (typeof ce.detail?.time === 'number') setCurrentTime(ce.detail.time);
    };
    const onState = (e: Event) => {
      const ce = e as CustomEvent<{ paused: boolean }>;
      setIsPlaying(!ce.detail.paused);
    };
    window.addEventListener('video:timeupdate', onTimeUpdate);
    window.addEventListener('video:state', onState);
    return () => {
      window.removeEventListener('video:timeupdate', onTimeUpdate);
      window.removeEventListener('video:state', onState);
    };
  }, [setCurrentTime, setIsPlaying]);

  return (
    <div ref={ref} className="sticky top-[60px] z-20">
      <VideoPlayer note={note as any} />
    </div>
  );
}
```

注：上面所有事件（`video:timeupdate`, `video:state`, `video:seek` 的 autoplay 模式）已经在 **Task 0.5** 改造 VideoPlayer 时实现。本 Task 只是接入 store。

- [ ] **Step 2: 验证视频播放 + IntersectionObserver 行为**

Run: `npm run dev`，访问视频笔记，确认视频能播 + 滚动到视频外时 store 的 `miniPlayerVisible` 变 true（暂时无 UI，看 React DevTools 即可）

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/MainStage/VideoPlayerCard.tsx components/reader/ContentStage/VideoPlayer.tsx
git commit -m "feat(video-detail): VideoPlayerCard 包装 + 事件总线接入"
```

### Task 3.2: KeyframesGallery

**Files:**
- Create: `components/video-detail/MainStage/KeyframesGallery.tsx`

- [ ] **Step 1: 实现关键帧画廊**

```tsx
// components/video-detail/MainStage/KeyframesGallery.tsx
"use client";
import { useState } from 'react';
import { ImageLightbox } from '@/components/reader/ImageLightbox';
import { useVideoSeek } from '../hooks/useVideoSeek';
import type { VideoJobRow } from '@/components/reader/ReaderPageWrapper';

function formatTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export function KeyframesGallery({ videoJob }: { videoJob: VideoJobRow | null }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const { seek } = useVideoSeek();

  const frames = videoJob?.frames ?? [];
  const visual = videoJob?.visual_result ?? [];

  if (videoJob?.frame_status !== 'done') {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
        <h2 className="font-semibold mb-4">关键帧画廊</h2>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">正在抽取关键帧...</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">关键帧画廊</h2>
          <span className="text-xs text-slate-400">共 {frames.length} 帧</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {frames.map((f, i) => {
            const desc = visual[i]?.sceneDescription ?? '';
            return (
              <button
                key={i}
                onClick={() => { seek(f.timestamp); setLightboxIdx(i); }}
                className="group relative aspect-video rounded-lg overflow-hidden bg-slate-100 hover:ring-2 hover:ring-violet-400 transition"
              >
                <img src={f.url} alt={desc} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{formatTime(f.timestamp)}</div>
                {desc && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end p-2 text-white text-[11px] opacity-0 group-hover:opacity-100">
                    {desc}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {lightboxIdx !== null && (
        <ImageLightbox
          images={frames.map((f) => ({ src: f.url, alt: '' }))}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}
```

> 注：`ImageLightbox` 的 props 形状以现有组件为准，运行前先 `Read` 检查 `components/reader/ImageLightbox.tsx` 的实际签名并按需调整。

- [ ] **Step 2: 把 VideoPlayerCard + KeyframesGallery 接到 MainStage**

Create: `components/video-detail/MainStage/index.tsx`

```tsx
"use client";
import { VideoPlayerCard } from './VideoPlayerCard';
import { KeyframesGallery } from './KeyframesGallery';
import type { Note, VideoJobRow } from '@/components/reader/ReaderPageWrapper';

export function MainStage({ note, videoJob }: { note: Note; videoJob: VideoJobRow | null }) {
  return (
    <main className="overflow-y-auto relative">
      <div className="p-6 space-y-6 pb-24">
        <VideoPlayerCard note={note} />
        <KeyframesGallery videoJob={videoJob} />
      </div>
    </main>
  );
}
```

更新 `VideoDetailLayout.tsx` 引用 `MainStage`。

- [ ] **Step 3: 验证视觉**

刷新页面，看到视频 + 关键帧画廊都正常渲染。

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/MainStage/
git commit -m "feat(video-detail): MainStage + KeyframesGallery"
```

### Task 3.3: MiniPlayer 跟随播放器

**Files:**
- Create: `components/video-detail/MiniPlayer.tsx`

- [ ] **Step 1: 实现 MiniPlayer（共享同一个 video.js 实例的镜像 UI）**

```tsx
// components/video-detail/MiniPlayer.tsx
"use client";
import { useVideoDetailStore } from './store';
import { useVideoSeek } from './hooks/useVideoSeek';

function formatTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export function MiniPlayer({ title, duration }: { title: string; duration: number }) {
  const visible = useVideoDetailStore((s) => s.miniPlayerVisible);
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const isPlaying = useVideoDetailStore((s) => s.isPlaying);

  if (!visible) return null;

  const togglePlay = () => {
    window.dispatchEvent(new CustomEvent('video:toggle-play'));
  };
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-[64px] right-[480px] h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 flex items-center gap-3 z-40">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className="text-xs min-w-0 flex-shrink-0">
        <div className="font-medium truncate max-w-[200px]">{title}</div>
        <div className="text-slate-400 text-[10px]">{formatTime(currentTime)} / {formatTime(duration)}</div>
      </div>
      <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 接入 VideoDetailLayout 并验证**

> `video:toggle-play` 监听器已经在 Task 0.5 加到 VideoPlayer 内部，此处直接 dispatch 即可。

在 VideoDetailLayout 渲染 `<MiniPlayer title={note.title ?? ''} duration={note.media_duration ?? 0} />`。

滚动到视频外，看到 MiniPlayer 出现；点击播放/暂停按钮，视频对应响应。

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/MiniPlayer.tsx components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): MiniPlayer 底部跟随播放器"
```

---

## Phase 4: 右栏速览 Tab（关键词 + 概要 + 章节）

### Task 4.1: RightPanel 容器 + 3 Tab 切换

**Files:**
- Create: `components/video-detail/RightPanel/index.tsx`

- [ ] **Step 1: 实现 RightPanel 壳 + Tab 切换**

```tsx
"use client";
import { useVideoDetailStore } from '../store';
import type { Note, VideoJobRow } from '@/components/reader/ReaderPageWrapper';

const TABS = [
  { key: 'brief', label: '速览' },
  { key: 'transcript', label: '原文' },
  { key: 'notes', label: '笔记' },
] as const;

export function RightPanel({ note, videoJob }: { note: Note; videoJob: VideoJobRow | null }) {
  const activeTab = useVideoDetailStore((s) => s.activeTab);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);

  return (
    <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-800 px-3 flex items-center gap-0.5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? 'px-3 h-11 text-sm font-medium border-b-2 border-violet-600 text-violet-700'
                : 'px-3 h-11 text-sm text-slate-500 border-b-2 border-transparent hover:text-slate-700'
            }
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 pr-1">由 通义听悟 生成</div>
      </div>

      {/* 三个 Panel 都常驻挂载，用 hidden 控制可见性（Tiptap 实例不销毁） */}
      <div className={activeTab === 'brief' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
        {/* BriefPanel — Task 4.2 */}
        <div className="p-4">BriefPanel placeholder</div>
      </div>
      <div className={activeTab === 'transcript' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
        {/* TranscriptPanel — Phase 5 */}
        <div className="p-4">TranscriptPanel placeholder</div>
      </div>
      <div className={activeTab === 'notes' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
        {/* NotesPanel — Phase 6 */}
        <div className="p-4">NotesPanel placeholder</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 在 VideoDetailLayout 替换右栏占位**

```tsx
// 替换原 <aside ...></aside> 为
<RightPanel note={note} videoJob={videoJob} />
```

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/RightPanel/index.tsx components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): RightPanel 3 Tab 容器"
```

### Task 4.2: KeywordsRow + SummaryBlock

**Files:**
- Create: `components/video-detail/RightPanel/KeywordsRow.tsx`
- Create: `components/video-detail/RightPanel/SummaryBlock.tsx`

- [ ] **Step 1: KeywordsRow（折叠/展开全部）**

```tsx
"use client";
import { useState } from 'react';

const VISIBLE_LIMIT = 10;

export function KeywordsRow({ keywords }: { keywords: string[] | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!keywords?.length) {
    return (
      <section>
        <h3 className="text-xs font-medium text-slate-500 mb-2">关键词</h3>
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  const list = expanded ? keywords : keywords.slice(0, VISIBLE_LIMIT);

  return (
    <section>
      <h3 className="text-xs font-medium text-slate-500 mb-2">关键词</h3>
      <div className="flex flex-wrap gap-1.5">
        {list.map((kw, i) => (
          <span key={i} className="px-3 py-1.5 rounded text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950">
            {kw}
          </span>
        ))}
        {keywords.length > VISIBLE_LIMIT && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-violet-600 px-2">
            {expanded ? '收起' : `展开全部 (${keywords.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: SummaryBlock**

```tsx
"use client";
import { useState } from 'react';

const COLLAPSED_CHARS = 220;

export function SummaryBlock({ summary }: { summary: string | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!summary) {
    return (
      <section>
        <h3 className="text-xs font-medium text-slate-500 mb-2">全文概要</h3>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      </section>
    );
  }

  const tooLong = summary.length > COLLAPSED_CHARS;
  const visible = expanded || !tooLong ? summary : summary.slice(0, COLLAPSED_CHARS) + '...';

  return (
    <section>
      <h3 className="text-xs font-medium text-slate-500 mb-2">全文概要</h3>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {visible}
        {tooLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-violet-600 ml-1">
            {expanded ? '收起' : '展开全部'}
          </button>
        )}
      </p>
    </section>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/RightPanel/KeywordsRow.tsx components/video-detail/RightPanel/SummaryBlock.tsx
git commit -m "feat(video-detail): KeywordsRow + SummaryBlock"
```

### Task 4.3: ChaptersTab + BriefPanel 组装

**Files:**
- Create: `components/video-detail/RightPanel/ChaptersTab.tsx`
- Create: `components/video-detail/RightPanel/BriefPanel.tsx`

- [ ] **Step 1: ChaptersTab — 章节列表 + 当前播放高亮**

```tsx
"use client";
import { useVideoDetailStore } from '../store';
import { useVideoSeek } from '../hooks/useVideoSeek';
import type { Chapter } from '@/lib/ai-analysis/types';

function formatTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export function ChaptersTab({ chapters }: { chapters: Chapter[] | undefined }) {
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const { seek } = useVideoSeek();

  if (!chapters?.length) {
    return <div className="text-sm text-slate-400 text-center py-8">AI 分析中... 章节生成中</div>;
  }

  const isActive = (c: Chapter, idx: number) => {
    const next = chapters[idx + 1];
    return currentTime >= c.start && (next ? currentTime < next.start : true);
  };

  return (
    <div className="space-y-1">
      {chapters.map((c, i) => (
        <button
          key={i}
          onClick={() => seek(c.start)}
          className={
            isActive(c, i)
              ? 'w-full flex gap-3 px-2 py-2 rounded bg-violet-50 dark:bg-violet-950 text-left'
              : 'w-full flex gap-3 px-2 py-2 rounded hover:bg-violet-50 dark:hover:bg-violet-950/50 text-left'
          }
        >
          <div className="flex items-center gap-1.5 text-xs shrink-0 w-14">
            <span className={isActive(c, i) ? 'w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse' : 'w-1.5 h-1.5 rounded-full bg-slate-300'} />
            <span className={isActive(c, i) ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500'}>
              {formatTime(c.start)}
            </span>
          </div>
          <div className={isActive(c, i) ? 'flex-1 text-sm font-medium text-violet-700 dark:text-violet-300' : 'flex-1 text-sm text-slate-700 dark:text-slate-300'}>
            {c.title}
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: BriefPanel 组装**

```tsx
"use client";
import { useVideoDetailStore } from '../store';
import { KeywordsRow } from './KeywordsRow';
import { SummaryBlock } from './SummaryBlock';
import { ChaptersTab } from './ChaptersTab';
import type { VideoJobRow } from '@/components/reader/ReaderPageWrapper';

const SUBTABS = [
  { key: 'chapters', label: '章节速览' },
  { key: 'speakers', label: '发言总结' },
  { key: 'qa', label: '问答回顾' },
] as const;

export function BriefPanel({ videoJob }: { videoJob: VideoJobRow | null }) {
  const subTab = useVideoDetailStore((s) => s.activeBriefSubTab);
  const setSubTab = useVideoDetailStore((s) => s.setActiveBriefSubTab);
  const audio = videoJob?.audio_result;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <KeywordsRow keywords={audio?.keywords} />
      <SummaryBlock summary={audio?.summary} />

      <section>
        <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs mb-3">
          {SUBTABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={subTab === t.key ? 'pb-2 font-medium text-violet-700 border-b-2 border-violet-600' : 'pb-2 text-slate-500 border-b-2 border-transparent'}
            >
              {t.label}
              {t.key !== 'chapters' && <span className="ml-1 text-[9px] text-slate-400">P1</span>}
            </button>
          ))}
        </div>
        {subTab === 'chapters' && <ChaptersTab chapters={audio?.chapters} />}
        {subTab === 'speakers' && <div className="text-sm text-slate-400 py-6 text-center">发言总结 · 后续版本支持</div>}
        {subTab === 'qa' && <div className="text-sm text-slate-400 py-6 text-center">问答回顾 · 后续版本支持</div>}
      </section>

      <p className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        智能内容由 AI 模型生成，仅供参考
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 接入 RightPanel**

把 RightPanel.tsx 中 `BriefPanel placeholder` 替换为 `<BriefPanel videoJob={videoJob} />`。

- [ ] **Step 4: 验证 + 提交**

刷新页面，点章节看 currentTime / 视频是否跳转 + 高亮变化。

```bash
git add components/video-detail/RightPanel/
git commit -m "feat(video-detail): BriefPanel + KeywordsRow + SummaryBlock + ChaptersTab"
```

---

## Phase 5: 右栏原文 Tab + 摘录到笔记

### Task 5.1: TranscriptPanel（发言人分段 + 当前句高亮）

**Files:**
- Create: `components/video-detail/RightPanel/TranscriptPanel.tsx`

- [ ] **Step 1: 实现 TranscriptPanel**

```tsx
"use client";
import { useEffect, useRef } from 'react';
import { useVideoDetailStore } from '../store';
import { useVideoSeek } from '../hooks/useVideoSeek';
import type { TranscriptSegment } from '@/lib/ai-analysis/types';
import type { VideoJobRow } from '@/components/reader/ReaderPageWrapper';

function formatTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function speakerColor(id: string | undefined) {
  if (!id) return 'from-slate-400 to-slate-600';
  const palette = ['from-violet-400 to-violet-600', 'from-cyan-400 to-cyan-600', 'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600'];
  return palette[id.charCodeAt(0) % palette.length];
}

export function TranscriptPanel({ videoJob, noteId }: { videoJob: VideoJobRow | null; noteId: string }) {
  const transcript: TranscriptSegment[] = videoJob?.audio_result?.transcript ?? [];
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const { seek } = useVideoSeek();
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // 当前句索引
  const activeIdx = transcript.findIndex((s, i) => {
    const next = transcript[i + 1];
    return currentTime >= s.start && (next ? currentTime < next.start : currentTime <= s.end);
  });

  // 自动滚动到当前句（除非用户手动滚动）
  useEffect(() => {
    if (userScrolledRef.current) return;
    const node = containerRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => { userScrolledRef.current = true; };
    el.addEventListener('wheel', onScroll, { passive: true });
    el.addEventListener('touchmove', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', onScroll);
      el.removeEventListener('touchmove', onScroll);
    };
  }, []);

  if (!transcript.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        字幕生成中，请稍候...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4" id="transcript-scroll-container">
      {transcript.map((seg, i) => (
        <div
          key={i}
          data-idx={i}
          data-time={seg.start}
          className={
            i === activeIdx
              ? 'group bg-violet-50 dark:bg-violet-950/40 -mx-2 px-2 py-2 rounded-lg ring-1 ring-violet-200'
              : 'group'
          }
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${speakerColor(seg.speaker)} text-white text-[10px] flex items-center justify-center font-bold`}>
              {seg.speaker?.slice(0, 1).toUpperCase() ?? 'A'}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {seg.speaker ? `发言人 ${seg.speaker}` : '发言人'}
              {i === activeIdx && <span className="ml-1 text-violet-600 dark:text-violet-300">· 正在播放</span>}
            </span>
            <button onClick={() => seek(seg.start)} className="text-xs text-violet-600 hover:underline font-mono">
              {formatTime(seg.start)}
            </button>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-8 select-text">
            {seg.text}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 接入 RightPanel**

```tsx
{/* 把 TranscriptPanel placeholder 换成 */}
<TranscriptPanel videoJob={videoJob} noteId={note.id} />
```

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/RightPanel/TranscriptPanel.tsx components/video-detail/RightPanel/index.tsx
git commit -m "feat(video-detail): TranscriptPanel 发言人分段 + 当前句高亮 + 自动滚动"
```

### Task 5.2: SelectionMenu + 摘录到笔记

**Files:**
- Create: `components/video-detail/shared/SelectionMenu.tsx`
- Create: `components/video-detail/hooks/useExcerpt.ts`

- [ ] **Step 1: useExcerpt hook（封装摘录动作 — 切 Tab + 注入 + 闪烁）**

```ts
"use client";
import { useVideoDetailStore } from '../store';
import { generateHTML } from '@tiptap/html';
import type { Editor } from '@tiptap/react';

export interface ExcerptPayload {
  excerpt: string;
  videoTime: number;
  speakerLabel?: string;
}

export function useExcerpt() {
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const editor = useVideoDetailStore((s) => s.notesEditor);

  return (payload: ExcerptPayload) => {
    if (!editor) {
      console.warn('useExcerpt: editor not ready');
      return;
    }
    setActiveTab('notes');
    editor.commands.focus('end');
    editor.commands.insertContent({
      type: 'timeReference',
      attrs: payload,
    });
    editor.commands.enter();  // 插入后另起一行，方便用户继续输入

    // 闪烁动画：选最后一个 time-reference 节点，加临时 class
    setTimeout(() => {
      const node = document.querySelector('[data-type="time-reference"]:last-of-type') as HTMLElement | null;
      if (!node) return;
      node.classList.add('animate-pulse-once');
      setTimeout(() => node.classList.remove('animate-pulse-once'), 1500);
    }, 50);
  };
}
```

注意：`animate-pulse-once` 在 `app/globals.css` 或 Tailwind config 里定义：

```css
@keyframes pulse-once {
  0%, 100% { background-color: rgb(245 243 255); }
  50% { background-color: rgb(221 214 254); }
}
.animate-pulse-once { animation: pulse-once 1.5s ease-out; }
```

- [ ] **Step 2: SelectionMenu 浮窗**

```tsx
"use client";
import { useEffect, useState } from 'react';
import { useExcerpt } from '../hooks/useExcerpt';

export function SelectionMenu() {
  const excerpt = useExcerpt();
  const [state, setState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    time: number;
    speaker?: string;
  }>({ visible: false, x: 0, y: 0, text: '', time: 0 });

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || text.length < 4) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      // 只在 transcript 容器内响应
      const anchor = sel?.anchorNode;
      const parent = (anchor instanceof HTMLElement ? anchor : anchor?.parentElement) ?? null;
      const segEl = parent?.closest('[data-time]');
      if (!segEl) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      const time = Number(segEl.getAttribute('data-time')) || 0;
      const rect = sel!.getRangeAt(0).getBoundingClientRect();
      setState({ visible: true, x: rect.left, y: rect.top - 50, text, time });
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  if (!state.visible) return null;

  return (
    <div
      className="fixed z-50 bg-slate-900 text-white rounded-lg shadow-2xl py-1.5 flex items-center text-xs"
      style={{ top: state.y, left: state.x }}
    >
      <button
        className="px-3 py-1.5 hover:bg-slate-700 flex items-center gap-1.5"
        onClick={() => {
          excerpt({ excerpt: state.text, videoTime: state.time, speakerLabel: state.speaker });
          window.getSelection()?.removeAllRanges();
          setState((s) => ({ ...s, visible: false }));
        }}
      >
        📥 摘录到笔记
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 在 VideoDetailLayout 渲染 `<SelectionMenu />`（页面级单例）**

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/shared/SelectionMenu.tsx components/video-detail/hooks/useExcerpt.ts app/globals.css components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): SelectionMenu 浮窗 + 摘录到笔记动作"
```

---

## Phase 6: 笔记 Tab — Tiptap 基础 + 自动保存

### Task 6.1: 安装 Tiptap 依赖

- [ ] **Step 1: 安装**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-highlight @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-image @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell @tiptap/extension-placeholder @tiptap/extension-character-count
```

- [ ] **Step 2: 提交（独立提交方便回滚）**

```bash
git add package.json package-lock.json
git commit -m "deps: 安装 Tiptap 编辑器及扩展"
```

### Task 6.2: editor-config.ts + NotesPanel 基础

**Files:**
- Create: `components/video-detail/notes/editor-config.ts`
- Create: `components/video-detail/RightPanel/NotesPanel.tsx`
- Create: `components/video-detail/notes/NotesToolbar.tsx`
- Create: `components/video-detail/notes/SaveIndicator.tsx`

- [ ] **Step 1: editor-config.ts**

```ts
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';

export const baseExtensions = [
  StarterKit,
  Underline,
  Highlight.configure({ HTMLAttributes: { class: 'bg-yellow-200 dark:bg-yellow-900' } }),
  TextStyle, Color,
  Image,
  Table.configure({ resizable: true }),
  TableRow, TableHeader, TableCell,
  Placeholder.configure({ placeholder: '记录你的灵感和思考...' }),
  CharacterCount,
];
```

- [ ] **Step 2: NotesToolbar**

```tsx
"use client";
import { type Editor } from '@tiptap/react';

export function NotesToolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    active ? 'w-7 h-7 rounded bg-violet-100 text-violet-700' : 'w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-slate-800';

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-0.5 text-slate-500 text-xs">
      <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()} title="撤销">↶</button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
      <button className={btn(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()}>🖍</button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>≡</button>
      <button className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>№</button>
      <button className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H</button>
    </div>
  );
}
```

- [ ] **Step 3: SaveIndicator**

```tsx
"use client";

type State = 'idle' | 'saving' | 'saved' | 'failed';

export function SaveIndicator({ state, charCount, onRetry }: {
  state: State;
  charCount: number;
  onRetry?: () => void;
}) {
  const label = {
    idle: '未保存',
    saving: '保存中...',
    saved: '已保存 · 刚刚',
    failed: '保存失败',
  }[state];

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[11px] flex items-center justify-between bg-white dark:bg-slate-900">
      <span className={state === 'failed' ? 'text-rose-500 cursor-pointer' : 'text-slate-400'} onClick={state === 'failed' ? onRetry : undefined}>
        {state === 'failed' && '⚠ '}
        {label}
        {state === 'failed' && ' · 点击重试'}
      </span>
      <span className="text-slate-400">{charCount} 字</span>
    </div>
  );
}
```

- [ ] **Step 4: NotesPanel + 自动保存（同步整合）**

```tsx
"use client";
import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import { baseExtensions } from '../notes/editor-config';
import { NotesToolbar } from '../notes/NotesToolbar';
import { SaveIndicator } from '../notes/SaveIndicator';
import { useAutoSave } from '../hooks/useAutoSave';
import { useVideoDetailStore } from '../store';

export function NotesPanel({ noteId, initialContent }: { noteId: string; initialContent: any }) {
  const setNotesEditor = useVideoDetailStore((s) => s.setNotesEditor);

  const editor = useEditor({
    extensions: baseExtensions,
    content: initialContent ?? '',
    autofocus: false,
  });

  // 把 editor 实例放到 store，让其他组件 (useExcerpt) 可以访问
  useEffect(() => {
    if (editor) setNotesEditor(editor);
    return () => setNotesEditor(null);
  }, [editor, setNotesEditor]);

  const { state: saveState, charCount, retry } = useAutoSave(noteId, editor);

  if (!editor) return <div className="p-4 text-slate-400">编辑器加载中...</div>;

  return (
    <>
      <NotesToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto p-5">
        <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]" />
      </div>
      <SaveIndicator state={saveState} charCount={charCount} onRetry={retry} />
    </>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add components/video-detail/notes/ components/video-detail/RightPanel/NotesPanel.tsx
git commit -m "feat(video-detail): NotesPanel 基础（Tiptap + 工具栏 + 保存指示）"
```

### Task 6.3: useAutoSave hook + 测试

**Files:**
- Create: `components/video-detail/hooks/useAutoSave.ts`
- Create: `tests/video-detail/hooks/useAutoSave.test.ts`

- [ ] **Step 1: 实现 useAutoSave**

```ts
"use client";
import { useEffect, useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { createClient } from '@/lib/supabase/client';

type State = 'idle' | 'saving' | 'saved' | 'failed';
const DEBOUNCE = 1500;

export function useAutoSave(noteId: string, editor: Editor | null) {
  const [state, setState] = useState<State>('idle');
  const [charCount, setCharCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptRef = useRef(0);

  const persist = async (json: any) => {
    setState('saving');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notes')
        .update({ user_notes: json, user_notes_updated_at: new Date().toISOString() })
        .eq('id', noteId);
      if (error) throw error;
      setState('saved');
      retryAttemptRef.current = 0;
    } catch (e) {
      const attempt = retryAttemptRef.current++;
      if (attempt < 3) {
        setTimeout(() => persist(json), 1000 * Math.pow(2, attempt));
      } else {
        setState('failed');
      }
    }
  };

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      setCharCount(editor.storage.characterCount?.characters() ?? 0);
      setState('idle');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        persist(editor.getJSON());
      }, DEBOUNCE);
    };
    editor.on('update', onUpdate);
    onUpdate(); // 初始化 charCount
    return () => {
      editor.off('update', onUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, noteId]);

  // 跨页保护：localStorage 草稿（避免 crash 丢内容）
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      try {
        localStorage.setItem(`video-detail.draft.${noteId}`, JSON.stringify(editor.getJSON()));
      } catch {}
    };
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor, noteId]);

  const retry = () => {
    if (!editor) return;
    retryAttemptRef.current = 0;
    persist(editor.getJSON());
  };

  return { state, charCount, retry };
}
```

- [ ] **Step 2: 写测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '@/components/video-detail/hooks/useAutoSave';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

describe('useAutoSave', () => {
  beforeEach(() => vi.useFakeTimers());

  it('debounces save by 1500ms', async () => {
    const editor = {
      on: vi.fn(),
      off: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { characters: () => 10 } },
    } as any;

    const { result } = renderHook(() => useAutoSave('note-1', editor));
    expect(result.current.state).toBe('idle');

    // 模拟编辑器 update 回调
    const updateCallback = editor.on.mock.calls.find((c: any) => c[0] === 'update')[1];
    act(() => updateCallback());

    expect(result.current.state).toBe('idle');
    act(() => { vi.advanceTimersByTime(1500); });

    await waitFor(() => expect(result.current.state).toBe('saved'));
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `npm test -- useAutoSave`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/hooks/useAutoSave.ts tests/video-detail/hooks/useAutoSave.test.ts
git commit -m "feat(video-detail): useAutoSave hook + 测试"
```

### Task 6.4: NotesPanel 接入 RightPanel + 端到端验证

- [ ] **Step 1: 在 RightPanel/index.tsx 替换 NotesPanel placeholder**

```tsx
{/* notes tab */}
<div className={activeTab === 'notes' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
  <NotesPanel noteId={note.id} initialContent={note.user_notes} />
</div>
```

注意：`Note` 类型需要加 `user_notes?: any` 字段（已经在 migration 添加 db 列，前端类型也要同步）。

- [ ] **Step 2: 在 Note 类型加 user_notes 字段**

修改 `components/reader/ReaderPageWrapper.tsx` 的 `Note` 接口，加：

```ts
user_notes?: any;
user_notes_updated_at?: string | null;
```

- [ ] **Step 3: 验证**

打开页面 → 笔记 Tab → 输入文字 → 等 1.5s → SaveIndicator 显示「已保存」→ 刷新页面 → 文字还在。

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/RightPanel/index.tsx components/reader/ReaderPageWrapper.tsx
git commit -m "feat(video-detail): 笔记 Tab 端到端打通（含 user_notes 字段读写）"
```

---

## Phase 7: Tiptap 自定义节点（TimeReference / KeyframeReference / AnnotationReference）

### Task 7.1: TimeReference 节点 + 测试

**Files:**
- Create: `components/video-detail/notes/extensions/TimeReference.ts`
- Create: `tests/video-detail/notes/extensions/TimeReference.test.ts`

- [ ] **Step 1: 节点定义**

```ts
import { Node, mergeAttributes } from '@tiptap/core';

export const TimeReference = Node.create({
  name: 'timeReference',
  group: 'block',
  atom: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      videoTime: { default: 0 },
      speakerLabel: { default: null },
      excerpt: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="time-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'time-reference',
        'data-time': HTMLAttributes.videoTime,
        class: 'my-4 border-l-4 border-violet-400 bg-violet-50/60 dark:bg-violet-950/40 pl-3 pr-2 py-2 rounded-r',
      }),
      [
        'div',
        { class: 'flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-300 mb-1' },
        ['span', { class: 'font-mono font-medium' }, formatTime(HTMLAttributes.videoTime)],
        HTMLAttributes.speakerLabel ? ['span', { class: 'text-slate-400' }, `· ${HTMLAttributes.speakerLabel}`] : '',
      ],
      ['p', { class: 'text-xs text-slate-700 dark:text-slate-300 italic' }, `"${HTMLAttributes.excerpt}"`],
    ];
  },
});

function formatTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}
```

注：renderHTML 用 ProseMirror DOM 描述格式输出静态 HTML。点击时间戳跳转通过事件委托实现（next step）。

- [ ] **Step 2: 在 NotesPanel 容器加事件委托，处理 time-reference 点击**

修改 NotesPanel：

```tsx
import { useVideoSeek } from '../hooks/useVideoSeek';

// 在 EditorContent 外层 div 加 onClick
const { seek } = useVideoSeek();
const handleClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  const node = target.closest('[data-type="time-reference"]') as HTMLElement | null;
  if (node) {
    const t = Number(node.getAttribute('data-time')) || 0;
    seek(t);
  }
};

// JSX:
<div className="flex-1 overflow-y-auto p-5" onClick={handleClick}>
  <EditorContent editor={editor} ... />
</div>
```

- [ ] **Step 3: 注册到 editor-config.ts**

```ts
import { TimeReference } from './extensions/TimeReference';

export const baseExtensions = [
  ...,  // 已有
  TimeReference,
];
```

- [ ] **Step 4: 写测试**

```ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { TimeReference } from '@/components/video-detail/notes/extensions/TimeReference';
import StarterKit from '@tiptap/starter-kit';

describe('TimeReference node', () => {
  it('serializes and deserializes correctly', () => {
    const editor = new Editor({
      extensions: [StarterKit, TimeReference],
      content: {
        type: 'doc',
        content: [{
          type: 'timeReference',
          attrs: { videoTime: 195, speakerLabel: '发言人 1', excerpt: 'test' },
        }],
      },
    });
    const json = editor.getJSON();
    expect(json.content?.[0].type).toBe('timeReference');
    expect(json.content?.[0].attrs?.videoTime).toBe(195);
  });

  it('renders with formatted time and excerpt', () => {
    const editor = new Editor({
      extensions: [StarterKit, TimeReference],
      content: {
        type: 'doc',
        content: [{ type: 'timeReference', attrs: { videoTime: 195, speakerLabel: '发言人 1', excerpt: 'hi' } }],
      },
    });
    const html = editor.getHTML();
    expect(html).toContain('03:15');
    expect(html).toContain('hi');
    expect(html).toContain('data-time="195"');
  });
});
```

- [ ] **Step 5: 跑测试 + 提交**

```bash
npm test -- TimeReference
git add components/video-detail/notes/extensions/TimeReference.ts components/video-detail/notes/editor-config.ts components/video-detail/RightPanel/NotesPanel.tsx tests/video-detail/notes/extensions/TimeReference.test.ts
git commit -m "feat(video-detail): TimeReference 自定义节点 + 时间戳跳转"
```

### Task 7.2: 端到端摘录链路验证

- [ ] **Step 1: 手动验收**

启动 dev → 打开视频笔记 → 切到原文 Tab → 选中一段文字 → 点 "摘录到笔记" → 验证：
- 自动切到笔记 Tab
- 顶部出现紫色 TimeReference 块
- 1.5s 闪烁动画
- 点击块里的时间戳 → 视频 seek

如有问题修复后再提交。

### Task 7.3: KeyframeReference 节点

**Files:**
- Create: `components/video-detail/notes/extensions/KeyframeReference.ts`

- [ ] **Step 1: 节点定义（类似 TimeReference，atom + draggable，渲染缩略图）**

```ts
import { Node, mergeAttributes } from '@tiptap/core';

export const KeyframeReference = Node.create({
  name: 'keyframeReference',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      timestamp: { default: 0 },
      imageUrl: { default: '' },
      sceneDescription: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="keyframe-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const time = HTMLAttributes.timestamp;
    const min = Math.floor(time / 60), sec = Math.floor(time % 60);
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'keyframe-reference',
        'data-time': time,
        class: 'my-4 inline-block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden cursor-pointer max-w-xs',
      }),
      ['img', { src: HTMLAttributes.imageUrl, class: 'w-full h-auto', referrerpolicy: 'no-referrer' }],
      ['figcaption', { class: 'px-2 py-1 text-[11px] text-slate-500 flex items-center justify-between' },
        ['span', {}, HTMLAttributes.sceneDescription || '关键帧'],
        ['span', { class: 'font-mono' }, `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`],
      ],
    ];
  },
});
```

- [ ] **Step 2: KeyframesGallery 添加"加到笔记"按钮**

修改 `components/video-detail/MainStage/KeyframesGallery.tsx`，每个缩略图 hover 显示按钮：

```tsx
import { useVideoDetailStore } from '../store';
import { useExcerpt } from '../hooks/useExcerpt';  // 复用？不行，需要新一个函数 — 加到这里：

// 内联实现 addKeyframeToNotes：
const editor = useVideoDetailStore((s) => s.notesEditor);
const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);

const addToNotes = (frame: any, desc: string) => {
  if (!editor) return;
  setActiveTab('notes');
  editor.commands.focus('end');
  editor.commands.insertContent({
    type: 'keyframeReference',
    attrs: { timestamp: frame.timestamp, imageUrl: frame.url, sceneDescription: desc },
  });
  editor.commands.enter();
};
```

每个缩略图按钮 hover 显示「➕ 加到笔记」icon button，onClick 调 `addToNotes`。

- [ ] **Step 3: 注册扩展 + 提交**

```ts
// editor-config.ts
import { KeyframeReference } from './extensions/KeyframeReference';
export const baseExtensions = [..., KeyframeReference];
```

```bash
git add components/video-detail/notes/extensions/KeyframeReference.ts components/video-detail/notes/editor-config.ts components/video-detail/MainStage/KeyframesGallery.tsx
git commit -m "feat(video-detail): KeyframeReference 节点 + 关键帧加到笔记"
```

### ⚠️ AnnotationReference 节点 — 移到 P1

> 经审查，本期 P0 并没有从用户角度的「插入 annotation 引用」入口（spec §2 P0 列表里只有"摘录到笔记"用于 TimeReference）。本期不实现 AnnotationReference 节点；schema 移到 P1 一起做（含 Slash 命令入口/批注右键菜单"引用到笔记"等）。
>
> 本期不需要执行 Task 7.4。如果 schema 想提前预留，只往 editor-config.ts 里加占位扩展，不做 UI，保留 JSON 兼容性。

### Task 7.4: AnnotationReference 节点（订阅式）[P1，本期跳过]

**Files:**
- Create: `components/video-detail/notes/extensions/AnnotationReference.tsx`

- [ ] **Step 1: 用 ReactNodeViewRenderer 实现订阅式渲染**

```tsx
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

interface Annotation {
  id: string;
  text: string;
  color: string;
  start_time?: number;
}

function AnnotationReferenceComponent({ node }: any) {
  const annotationId = node.attrs.annotationId;
  const { data, error } = useSWR<Annotation>(
    annotationId ? `annotation:${annotationId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('annotations')
        .select('id, text, color, start_time')
        .eq('id', annotationId)
        .single();
      if (error) throw error;
      return data;
    }
  );

  if (error || !data) {
    return (
      <NodeViewWrapper className="my-4 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-400 italic">
        该批注已删除
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className={`my-4 px-3 py-2 rounded border-l-4 border-${data.color || 'yellow'}-400 bg-yellow-50/50 dark:bg-yellow-950/30`}>
      <p className="text-sm">{data.text}</p>
    </NodeViewWrapper>
  );
}

export const AnnotationReference = Node.create({
  name: 'annotationReference',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { annotationId: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="annotation-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'annotation-reference' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnnotationReferenceComponent);
  },
});
```

- [ ] **Step 2: 注册到 editor-config.ts**

```ts
import { AnnotationReference } from './extensions/AnnotationReference';
export const baseExtensions = [..., AnnotationReference];
```

- [ ] **Step 3: 写测试（验证 404 时显示墓碑）**

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
// ... mock supabase to return error ...
```

> 这里测试组件较复杂，可以做最小化：测试 schema 序列化反序列化，UI 渲染留 manual QA。

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/notes/extensions/AnnotationReference.tsx components/video-detail/notes/editor-config.ts
git commit -m "feat(video-detail): AnnotationReference 订阅式节点"
```

---

## Phase 8: 顶栏 + 工具栏 + 导出

### Task 8.1: AnalysisProgress 芯片 + popover

**Files:**
- Create: `components/video-detail/AnalysisProgress.tsx`

- [ ] **Step 1: 实现**

```tsx
"use client";
import { useState } from 'react';
import { useAnalysisProgress } from './hooks/useAnalysisProgress';

const STATUS_ICON: Record<string, string> = {
  done: '✓', skipped: '−', in_progress: '⏳', pending: '⏸', failed: '✗',
};

export function AnalysisProgress({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const { steps, overallPercent, isComplete, refetch } = useAnalysisProgress(jobId);

  const retry = async (step: string) => {
    await fetch(`/api/ai/video/${jobId}/retry?step=${step}`, { method: 'POST' });
    refetch();
  };

  const chipColor = isComplete
    ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950'
    : 'text-amber-700 bg-amber-50 dark:bg-amber-950';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 h-8 rounded flex items-center gap-1.5 text-xs ${chipColor}`}
      >
        <span className={isComplete ? 'w-1.5 h-1.5 rounded-full bg-emerald-500' : 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse'} />
        分析 {overallPercent}%
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-3 z-50">
          <div className="text-xs font-medium mb-2">分析进度</div>
          {steps.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1 text-xs">
              <div className="flex items-center gap-2">
                <span>{STATUS_ICON[s.status] || '?'}</span>
                <span>{s.label}</span>
              </div>
              {s.status === 'failed' && (
                <button onClick={() => retry(s.key)} className="text-violet-600 hover:underline">重试</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/video-detail/AnalysisProgress.tsx
git commit -m "feat(video-detail): AnalysisProgress 芯片 + popover"
```

### Task 8.2: 检查 retry API 支持 ?step= 参数

**Files:**
- Modify: `app/api/ai/video/[jobId]/retry/route.ts`

- [ ] **Step 1: 读现有 retry route**

Run: `Read` 工具读 `app/api/ai/video/[jobId]/retry/route.ts`

- [ ] **Step 2: 如果当前不支持 ?step= 参数，扩展之**

通常 retry 是把所有失败步骤重置回 pending；扩展为：如果指定 step，只重置那一个步骤。

```ts
// 伪代码示例（按实际实现调整）
const url = new URL(req.url);
const step = url.searchParams.get('step');  // 'download' | 'audio' | 'visual' | ...
const allowedSteps = ['download', 'probe', 'cover', 'frame', 'audio', 'visual'];
if (step && allowedSteps.includes(step)) {
  await supabase.from('video_jobs').update({ [`${step}_status`]: 'pending' }).eq('id', jobId);
} else {
  // 现有的"重置全部失败步骤"行为
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/ai/video/[jobId]/retry/route.ts
git commit -m "feat(api): retry 端点支持 ?step= 单步重试"
```

### Task 8.3: TopBar

**Files:**
- Create: `components/video-detail/TopBar.tsx`

- [ ] **Step 1: 实现**

```tsx
"use client";
import { AnalysisProgress } from './AnalysisProgress';
import { SpeakerPopover } from './SpeakerPopover';
import type { Note, VideoJobRow } from '@/components/reader/ReaderPageWrapper';

export function TopBar({ note, videoJob, saveStateLabel }: {
  note: Note;
  videoJob: VideoJobRow | null;
  saveStateLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold">{note.title || '未命名视频'}</h1>
        <div className="text-xs text-slate-400 mt-0.5">{saveStateLabel}</div>
      </div>
      <div className="flex items-center gap-1">
        {videoJob && <SpeakerPopover speakers={videoJob.audio_result?.speakers ?? []} />}
        {videoJob && <AnalysisProgress jobId={videoJob.id} />}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: SpeakerPopover 简化实现（P0 仅显示+筛选，重命名 P1）**

```tsx
"use client";
import { useState } from 'react';
import { useVideoDetailStore } from './store';

export function SpeakerPopover({ speakers }: { speakers: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const selected = useVideoDetailStore((s) => s.selectedSpeakers);
  const toggle = useVideoDetailStore((s) => s.toggleSpeaker);

  if (!speakers.length) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-2 h-8 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs">
        发言人 ({speakers.length})
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-48 bg-white dark:bg-slate-900 border rounded-lg shadow-xl p-2 z-50">
          {speakers.map((sp) => (
            <label key={sp.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={selected.size === 0 || selected.has(sp.id)}
                onChange={() => toggle(sp.id)}
              />
              <span>{sp.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

注意：`selectedSpeakers` 为空时表示"全选"。TranscriptPanel 可以用此过滤分段渲染。但 P0 可以暂不接入过滤，先做 UI。

- [ ] **Step 3: 把 TopBar 接入 VideoDetailLayout**

放在 MainStage 上方。

- [ ] **Step 4: 提交**

```bash
git add components/video-detail/TopBar.tsx components/video-detail/SpeakerPopover.tsx components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): TopBar + SpeakerPopover"
```

### Task 8.4: ExportDialog + /api/notes/[id]/export

**Files:**
- Create: `components/video-detail/ExportDialog.tsx`
- Create: `app/api/notes/[id]/export/route.ts`

**导出格式规则（必须明确，避免实现歧义）：**

- **MD**: 包含 标题/原始链接 → 关键词（点分隔） → 全文概要 → 章节速览（时间戳-标题列表） → 原文逐字稿（每段 `**[mm:ss]** 文本`） → **默认包含**用户笔记（"## 我的笔记"小节）。后端不接受"是否含笔记"参数；如用户要纯 transcript 用 SRT。
- **SRT**: 一段 transcript = 一个 cue。时间格式 `HH:MM:SS,mmm`。不做自动换行（保留原始 segment 文本）。不加发言人前缀（保留纯净字幕）。
- **JSON**: 完整原始数据快照：`{ note: {...所有 notes 字段...}, video_job: {...含 audio_result/visual_result/frames...}, annotations: [...] }`。直接 `JSON.stringify(..., null, 2)`。用于完整备份/迁移。

- [ ] **Step 1: 实现 export API（MD/SRT/JSON）**

```ts
// app/api/notes/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'md';

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from('notes')
    .select('*, video_job:video_jobs(*)')
    .eq('id', id)
    .single();

  if (error || !note) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const audio = note.video_job?.audio_result;
  if (format === 'srt') {
    const srt = buildSrt(audio?.transcript ?? []);
    return new Response(srt, {
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${note.title || 'video'}.srt"` },
    });
  }
  if (format === 'json') {
    return new Response(JSON.stringify(note, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${note.title || 'video'}.json"` },
    });
  }
  // md
  const md = buildMarkdown(note, audio);
  return new Response(md, {
    headers: { 'Content-Type': 'text/markdown', 'Content-Disposition': `attachment; filename="${note.title || 'video'}.md"` },
  });
}

function buildSrt(transcript: Array<{ start: number; end: number; text: string }>) {
  return transcript.map((s, i) => {
    return `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`;
  }).join('\n');
}

function formatSrtTime(t: number) {
  const h = Math.floor(t / 3600).toString().padStart(2, '0');
  const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  const ms = Math.floor((t % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

function buildMarkdown(note: any, audio: any) {
  const lines = [
    `# ${note.title || '未命名视频'}`,
    ``,
    `**原始链接**：${note.source_url}`,
    ``,
    `## 关键词`, '',
    (audio?.keywords ?? []).join(' · '),
    ``,
    `## 全文概要`, '',
    audio?.summary ?? '（无）',
    ``,
    `## 章节速览`, '',
    ...(audio?.chapters ?? []).map((c: any) => `- ${formatMmSs(c.start)} ${c.title}`),
    ``,
    `## 原文逐字稿`, '',
    ...(audio?.transcript ?? []).map((s: any) => `**[${formatMmSs(s.start)}]** ${s.text}`),
    ``,
  ];
  // 如果有 user_notes 用 Tiptap-to-MD 简易序列化
  if (note.user_notes) {
    lines.push('## 我的笔记', '');
    lines.push(tiptapJsonToMarkdown(note.user_notes));
  }
  return lines.join('\n');
}

function formatMmSs(t: number) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 极简 Tiptap JSON → MD（递归 paragraph/heading/text/timeReference/keyframeReference）
function tiptapJsonToMarkdown(json: any): string {
  if (!json) return '';
  // ... 实现略，按 type 分支处理；time-reference 渲染成 ">  [03:15] excerpt"
  // TODO: 完整实现
  return JSON.stringify(json);
}
```

> 注：`tiptapJsonToMarkdown` 实现可以先用 `JSON.stringify` 兜底，P1 再完善。

- [ ] **Step 2: ExportDialog 组件**

```tsx
"use client";
import { useState } from 'react';

export function ExportDialog({ noteId, open, onClose }: { noteId: string; open: boolean; onClose: () => void }) {
  const [format, setFormat] = useState<'md' | 'srt' | 'json'>('md');
  if (!open) return null;

  const handleExport = () => {
    window.location.href = `/api/notes/${noteId}/export?format=${format}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-96">
        <h3 className="font-semibold mb-4">导出笔记</h3>
        <div className="space-y-2 mb-4">
          {[
            { v: 'md', label: 'Markdown (.md)' },
            { v: 'srt', label: '字幕 (.srt)' },
            { v: 'json', label: '完整 JSON (.json)' },
          ].map((opt) => (
            <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="format" value={opt.v} checked={format === opt.v} onChange={() => setFormat(opt.v as any)} />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border">取消</button>
          <button onClick={handleExport} className="px-3 py-1.5 rounded bg-violet-600 text-white">导出</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/notes/[id]/export/route.ts components/video-detail/ExportDialog.tsx
git commit -m "feat(video-detail): ExportDialog + /api/notes/[id]/export (md/srt/json)"
```

---

## Phase 9: 左工具条 + 主题样式收尾

### Task 9.1: LeftToolbar

**Files:**
- Create: `components/video-detail/LeftToolbar.tsx`

- [ ] **Step 1: 实现**

```tsx
"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ExportDialog } from './ExportDialog';
import { toast } from 'sonner';

export function LeftToolbar({ noteId, isStarred }: { noteId: string; isStarred: boolean }) {
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  const [starred, setStarred] = useState(isStarred);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleStar = async () => {
    const next = !starred;
    setStarred(next);
    const supabase = createClient();
    await supabase.from('notes').update({ is_starred: next }).eq('id', noteId);
  };

  const deleteNote = async () => {
    if (!confirm('确认删除此视频笔记？')) return;
    const supabase = createClient();
    await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId);
    toast.success('已移到回收站');
    router.push('/dashboard');
  };

  return (
    <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-3 gap-1 text-slate-600">
      <button onClick={() => router.back()} className="w-11 h-11 rounded-lg hover:bg-slate-100 flex items-center justify-center" title="返回">←</button>
      <div className="w-8 h-px bg-slate-200 my-2" />
      <button onClick={toggleStar} className="w-11 h-11 rounded-lg hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-[10px]">
        <span className={starred ? 'text-yellow-500' : ''}>★</span>
        收藏
      </button>
      <button onClick={() => setExportOpen(true)} className="w-11 h-11 rounded-lg hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-[10px]">
        📥 导出
      </button>
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="w-11 h-11 rounded-lg hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-[10px]">
          ⋯ 更多
        </button>
        {menuOpen && (
          <div className="absolute left-12 top-0 w-32 bg-white dark:bg-slate-900 border rounded-lg shadow-xl py-1 z-50">
            <button onClick={deleteNote} className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 text-rose-600">🗑 删除</button>
          </div>
        )}
      </div>
      <ExportDialog noteId={noteId} open={exportOpen} onClose={() => setExportOpen(false)} />
    </aside>
  );
}
```

- [ ] **Step 2: 接入 VideoDetailLayout**

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/LeftToolbar.tsx components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): LeftToolbar 工具条（返回/收藏/导出/删除）"
```

### Task 9.2: 响应式 — < 1024px 单栏堆叠

- [ ] **Step 1: VideoDetailLayout 响应式**

```tsx
// 改 grid 容器
<div className="h-screen grid bg-slate-50 dark:bg-slate-950 
  grid-cols-[1fr] 
  lg:grid-cols-[56px_1fr_420px] 
  2xl:grid-cols-[64px_1fr_480px]">
```

- [ ] **Step 2: < lg 时隐藏左工具条 + 右栏改成顶部 Tab**

```tsx
<aside className="hidden lg:flex ...">  {/* LeftToolbar */}
<RightPanel className="lg:border-l hidden lg:block ..." />
{/* 移动端：把 RightPanel 改成绝对定位 + 抽屉，或者顶部 Tab 切换 */}
```

P0 简化做法：< lg 时右栏隐藏，提供一个 floating "笔记/原文/速览" 切换按钮。

> 这块涉及交互细节，建议跑通桌面端再回来处理。可以先 commit "skip mobile, P0 推进" 用 `hidden md:hidden lg:flex` 隐藏右栏一类粗暴方案，正式实现放到 Phase 11。

- [ ] **Step 3: 提交（基础响应式）**

```bash
git add components/video-detail/VideoDetailLayout.tsx
git commit -m "feat(video-detail): 基础响应式（< lg 隐藏右栏，P1 完善移动端）"
```

---

## Phase 10: Loading 状态 & 错误处理 polish

### Task 10.1: 视频下载状态卡

- [ ] **Step 1: VideoPlayerCard 检查 status，未就绪显示状态卡**

```tsx
if (videoJob?.download_status === 'pending' || videoJob?.download_status === 'in_progress') {
  return <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center text-white">
    <div>视频下载中... ({videoJob.size_bytes ? Math.round(videoJob.size_bytes / 1024 / 1024) : '?'} MB)</div>
  </div>;
}
if (videoJob?.download_status === 'failed') {
  return <div className="aspect-video bg-rose-50 dark:bg-rose-950 rounded-xl flex flex-col items-center justify-center gap-3">
    <div className="text-rose-700">视频下载失败：{videoJob.download_error}</div>
    <div className="flex gap-2">
      <button onClick={() => fetch(`/api/ai/video/${videoJob.id}/retry?step=download`, { method: 'POST' })} className="px-3 py-1.5 rounded bg-rose-600 text-white text-sm">重试</button>
      <a href={note.source_url} target="_blank" className="px-3 py-1.5 rounded border text-sm">打开原始链接</a>
    </div>
  </div>;
}
if (videoJob?.download_status === 'need_browser_fallback') {
  return <div className="aspect-video bg-amber-50 ...">该站点需浏览器扩展辅助下载</div>;
}
```

- [ ] **Step 2: 提交**

```bash
git add components/video-detail/MainStage/VideoPlayerCard.tsx
git commit -m "feat(video-detail): VideoPlayerCard 下载/失败/需扩展状态卡"
```

### Task 10.2: 各 Panel 失败处理

- [ ] **Step 1: BriefPanel — audio_status='failed' 显示错误 + 重试**

```tsx
{videoJob?.audio_status === 'failed' && (
  <div className="my-4 p-3 bg-rose-50 dark:bg-rose-950 rounded text-xs text-rose-700">
    AI 分析失败：{videoJob.audio_error || '未知错误'}
    <button onClick={() => fetch(`/api/ai/video/${videoJob.id}/retry?step=audio`, { method: 'POST' })} className="ml-2 underline">重新分析</button>
  </div>
)}
```

- [ ] **Step 2: KeyframesGallery — visual_status='failed' 时降级（保留缩略图，去掉场景描述）**

已经在 Task 3.2 实现里 `desc` 为空字符串时就不渲染描述行，自动降级 OK。

- [ ] **Step 3: 提交**

```bash
git add components/video-detail/RightPanel/BriefPanel.tsx
git commit -m "feat(video-detail): 各 panel 失败状态处理"
```

---

## Phase 11: 验收 & ship

### Task 11.1: 全链路手动验收 checklist

- [ ] 进入一个**新视频笔记**（分析未完成）→ 视频可播 + 笔记可写 + 速览/原文显示 loading
- [ ] AI 分析完成后所有区块就绪
- [ ] **章节速览**点时间戳 → 视频 seek + 高亮变化
- [ ] **原文 Tab** 选中文字 → 浮窗出 → 点摘录 → Tab 切换 + 新块插入 + 闪烁
- [ ] **关键帧画廊** hover → "加到笔记" → 笔记里出现缩略图块
- [ ] **笔记 Tab** 写字 → 1.5s 后看到 "已保存"
- [ ] 笔记里点 **TimeReference 时间戳** → 视频 seek
- [ ] 滚动视频出视口 → 看到 **MiniPlayer** 出现 + 点播放/暂停同步
- [ ] 顶栏 **AnalysisProgress** popover 展开看到 6 步状态
- [ ] 模拟保存失败（断网） → SaveIndicator 红 + 点击重试
- [ ] 关闭页面再打开 → 笔记内容还在
- [ ] **导出 MD/SRT/JSON**：每个格式下载内容完整
- [ ] **左工具条** 收藏/删除/导出 工作正常
- [ ] **dark mode** 所有组件正常
- [ ] **< 1024px** 单栏堆叠 OK（基础可看）
- [ ] 在视频笔记里**没有报错** in 浏览器 console

### Task 11.2: 最终 tsc + build

- [ ] **Step 1: 跑类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 2: 跑全部测试**

```bash
npm test
```

Expected: 所有现有 + 新增测试通过

- [ ] **Step 3: 构建**

```bash
npm run build
```

Expected: 构建成功，无 type/lint 错误

- [ ] **Step 4: 启动 production server 抽查**

```bash
npm start
# 访问视频笔记，全链路再走一遍
```

### Task 11.3: 文档收尾 + 发布

- [ ] **Step 1: 更新 CLAUDE.md，加视频详情页相关章节**

```markdown
### 视频详情页（VideoDetailLayout）

`/notes/[id]` 在 `content_type === 'video'` 时走 `components/video-detail/VideoDetailLayout.tsx`。
- 三栏布局：左工具条 + 主区(视频+关键帧) + 右栏(3 Tab: 速览/原文/笔记)
- 笔记区基于 Tiptap，存 `notes.user_notes` JSONB
- 视频事件总线：`video:seek` / `video:timeupdate` / `video:state` / `video:toggle-play`
- Tiptap 自定义节点：TimeReference / KeyframeReference / AnnotationReference
- 分析进度轮询：`useAnalysisProgress`（SWR 5s）
```

- [ ] **Step 2: archive openspec 变更**（如果用了 openspec workflow）

- [ ] **Step 3: 最终 commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 加视频详情页章节"
git push origin main
```

---

## 风险 & 注意事项

1. **VideoPlayer 改造**：复用现有 `components/reader/ContentStage/VideoPlayer.tsx`，但需要补充 `video:state` 和 `video:toggle-play` 事件 dispatch/listen，以及 `video:seek` 的 autoplay 模式。改完后**确认文章详情页的视频不受影响**（如果文章里还有 video 用例，但实际上 article 笔记不会有 video，可以忽略）。

2. **Tiptap bundle 体积**：Tiptap StarterKit + 多个扩展约 +120KB。考虑使用 `next/dynamic` 懒加载 NotesPanel：

```tsx
const NotesPanel = dynamic(() => import('./NotesPanel').then((m) => ({ default: m.NotesPanel })), { ssr: false });
```

但要确保 useExcerpt 拿 editor 的逻辑兼容懒加载（editor 可能延迟挂载）。

3. **Tiptap 测试需要 happy-dom**：vitest 默认是 node 环境，Tiptap 用到 DOM。配置 `vitest.config.ts`：

```ts
test: {
  environment: 'happy-dom',
}
```

如果尚未配置，先加。

4. **`speakerLabel` 来源**：摘录到笔记时，`speakerLabel` 来自 transcript segment 的 `speaker` 字段。如果 `audio_result.speakers` 提供了 label 映射，应该用 label 而非 id。在 SelectionMenu 里读 speaker → 查 speakers 数组 → 用 label。

5. **多标签页编辑冲突**：本期 P0 不做 If-Match 乐观锁。如果发现实际冲突频繁，再补。

---

## 执行风格

每个 Task 完成 → tsc + 相关单测 → commit → 下一个 Task。
每个 Phase 完成 → 手动跑一遍该 Phase 的 acceptance criteria → 进入下一 Phase。
Phase 7 结束（自定义节点）后做一次完整手动验收（"摘录→笔记→点跳转"全链路），暴露问题就近修。

**回滚单元**：每个 commit 都是一个完整的可回滚单元。Phase 6 安装 Tiptap 那个 commit 单独切出来方便 revert。
