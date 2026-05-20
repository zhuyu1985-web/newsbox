# Reader Outline Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace empty article outline states with useful reading clue or inspiration cards while preserving real heading navigation.

**Architecture:** Move extraction and fallback selection into a small pure utility under `lib/reader/`, then keep `ArticleOutline` focused on rendering and DOM scroll binding. The utility uses only current note data and deterministic local prompts; no external hot-news API is introduced.

**Tech Stack:** Next.js, React client components, TypeScript, Vitest, Tailwind, Lucide icons.

---

### Task 1: Reader Outline Data Utility

**Files:**
- Create: `lib/reader/article-outline.ts`
- Test: `tests/lib/reader/article-outline.test.ts`

- [ ] Add a pure function `buildArticleSidebarModel(input)` that returns `mode: "outline" | "clues" | "inspiration"`.
- [ ] Parse `h1/h2/h3` headings from HTML and use outline mode only when at least two headings remain after trimming and de-duplicating.
- [ ] Extract paragraph-based clue cards from current article text when headings are insufficient.
- [ ] Select built-in quote/reflection cards deterministically by current date and note id when content is sparse.
- [ ] Cover all three modes with Vitest tests.

### Task 2: Sidebar Rendering

**Files:**
- Modify: `components/reader/LeftSidebar/ArticleOutline.tsx`
- Modify: `components/reader/LeftSidebar/index.tsx`

- [ ] Pass note id, title, excerpt, source, content HTML, and content text into `ArticleOutline`.
- [ ] Keep existing clickable outline behavior for outline mode.
- [ ] Render clue/inspiration cards with concise labels, Lucide icons, hover transitions, and reduced-motion-safe animation classes.
- [ ] Remove emoji-based empty state.

### Task 3: Verification

**Commands:**
- `openspec validate enhance-reader-outline-fallback --strict`
- `npm test -- tests/lib/reader/article-outline.test.ts`
- `npx tsc --noEmit --pretty false`
- `npx eslint components/reader/LeftSidebar/ArticleOutline.tsx components/reader/LeftSidebar/index.tsx lib/reader/article-outline.ts tests/lib/reader/article-outline.test.ts`
