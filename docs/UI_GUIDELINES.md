# NewsBox UI 规范

> 适用范围：所有 `app/`、`components/` 下新建或修改的界面代码
> 立项时间：2026-05-14
> 维护：本文档从当前代码反推而成。所有规则带代码引用（`文件:行号`）。

---

## 0. 总原则

1. **跟着 token 走，不写魔法值**：颜色、阴影、圆角、字号统一走 CSS 变量或 Tailwind 设计 token；不写 `bg-[#xxxxxx]` / `shadow-[0px...]`。
2. **优先复用 `components/ui/` 原子**：禁止重新实现已有的 Button / Input / Card / Dialog 等。
3. **必须 dark 兼容**：所有非语义类颜色（`bg-white`、`text-slate-*`）必须配套 `dark:` 前缀；语义类（`bg-background` / `text-foreground` / `bg-card`）自带主题适配。
4. **中文优先文案**：界面文本一律中文，专有名词保留英文（NewsBox、AI Copilot、Zen Mode 等）。
5. **Framer Motion 用在「页面/卡片/模态」级，按钮类小交互用 Tailwind `transition-*`**。
6. **图片必备 `referrerPolicy="no-referrer"`**：所有 `<img>` 标签（外链尤其重要）。

---

## 1. 设计 Token（Foundation）

### 1.1 颜色（HSL CSS Variables）

定义在 `app/globals.css:6-40`，全部由 `tailwind.config.ts:13-54` 映射成 `hsl(var(--xxx))`。

| 语义 token | 用途 | ✅ DO | ⛔ DON'T |
|------------|------|-------|---------|
| `bg-background` / `text-foreground` | 页面级背景/文字 | `<div className="bg-background">` | `bg-white dark:bg-slate-950` 手写一遍 |
| `bg-card` / `text-card-foreground` | 卡片背景 | `<Card>` 内默认 | `bg-slate-900/40` |
| `bg-muted` / `text-muted-foreground` | 次级背景/描述文字 | `<p className="text-muted-foreground">` | `text-gray-400` |
| `bg-primary` / `text-primary` | 主操作色（蓝）| `<Button>` 默认 | `bg-blue-600` |
| `bg-destructive` | 危险操作（红） | `<Button variant="destructive">` | `bg-red-500` |
| `border-border` | 边框 | `border` 已包含 | 手写颜色 |
| `bg-popover` | 浮层背景 | `<Popover>` / `<DropdownMenu>` 内 | 透明手调 |

**装饰性硬编码色**（仅以下场景允许）：
- 渐变背景：`from-blue-500 to-cyan-400`（特性区块）、`from-violet-500 via-purple-500 to-fuchsia-500`（AI 会员）、`from-amber-400 via-orange-400 to-yellow-500`（Pro 会员）
- 模糊装饰球：`bg-blue-400/10 blur-[120px]`（详见 §4.2）
- 阅读器高亮颜色（用户语义）：`yellow / green / blue / pink / purple`（见 `AnnotationList.tsx:78-84`）

### 1.2 字体

**全局**：系统字体栈，无 `next/font`。
**正文 body**：通过 `bg-background text-foreground` 在 `globals.css:75-78` 应用。
**阅读器内文**：CSS 变量 `--reader-font-size` / `--reader-line-height` / `--reader-font-family` 可由用户设置覆盖。

### 1.3 字号梯度

| Tailwind 类 | px | 使用场景 |
|------------|----|---------|
| `text-xs` | 12 | Badge、辅助说明、时间戳 |
| `text-sm` | 14 | Label、描述、卡片副标题 |
| `text-base` | 16 | 正文默认（不必显式写） |
| `text-lg` | 18 | 卡片标题、突出文本 |
| `text-xl` | 20 | 区块标题（如 Section heading）|
| `text-2xl` | 24 | 页面级标题 |
| `text-3xl` ~ `text-6xl` | 30–60 | **仅 Landing Hero** |

### 1.4 字重

| 类 | 用途 |
|----|------|
| `font-medium` | 按钮文本、导航 |
| `font-semibold` | 次级标题、Label |
| `font-bold` | 标题（页面/卡片/区块）→ **最常用** |
| `font-black` | 极强标题（如智能主题卡片标题） |
| 不允许 | `font-extralight` / `font-thin` |

### 1.5 圆角

CSS 变量 `--radius: 1.25rem`（20px）。Tailwind 仅覆盖了 sm/md/lg（见 `tailwind.config.ts:55-59`），其他保留 Tailwind 默认：

| 类 | 实际值 | 用途 |
|----|--------|------|
| `rounded-sm` | 16px | (`--radius - 4px`) 极小元素 |
| `rounded-md` | 18px | (`--radius - 2px`) 表单元素、按钮 |
| `rounded-lg` | **20px** | **标准卡片**（首选） |
| `rounded-xl` | 12px | Tailwind 默认，**比 lg 小**，慎用 |
| `rounded-2xl` | 16px | 中等圆角 |
| `rounded-3xl` | 24px | 大圆角（Stats 卡片、Landing） |
| `rounded-full` | ∞ | 头像、徽章、圆形按钮 |

⚠️ **注意非线性**：因为只覆盖 lg，`rounded-xl(12px) < rounded-lg(20px)`。新代码优先用 `lg / 3xl / full`，避免歧义。

⚠️ **禁用**：`rounded-[14px]` / `rounded-[20px]` 自定义像素值。新建组件优先用上表中 Tailwind 原生类。

### 1.6 阴影

CSS 变量 `--shadow-sm/md/lg/xl`（`globals.css:34-39`）已经定义 light/dark 双模式，**通过 Tailwind `shadow-sm/md/lg/xl` 直接使用**。

⛔ 禁止 `shadow-[0_xxx_0_rgba(...)]` 自定义阴影（除特殊设计需要，需明文注释理由）。

### 1.7 玻璃态（Glass）

`globals.css:65-72` 提供 3 个工具类：

| 类 | 用途 |
|----|------|
| `glass` | 中性玻璃背景（白/黑 + backdrop-blur） |
| `glass-blue` | 蓝色玻璃（活跃态、特性卡） |
| `glass-primary` | 主色玻璃（强调容器） |

✅ 用：`<div className="glass rounded-xl p-6">`
⛔ 不写：`bg-white/40 backdrop-blur-xl border-white/20 ...` 手动拼

---

## 2. 间距与布局

### 2.1 容器宽度

| 场景 | 类 |
|------|----|
| 认证页 / Modal 内容 | `max-w-sm` (384px) |
| 表单、设置项 | `max-w-md` (448px) |
| Reader 文章容器 | `max-w-3xl` (768px) |
| Landing 内容 | `max-w-3xl` ~ `max-w-[1000px]` |
| Dashboard 主区 | 全宽（flex 容器） |

### 2.2 Padding 标准

| 元素 | padding |
|------|---------|
| Card 内部 | `p-6` |
| 紧凑徽章 | `px-2 py-0.5` |
| 表单元素 | `px-3 py-1.5` |
| Section 垂直 | `py-16` ~ `py-24` |
| Section 水平 | `px-6 lg:px-8` |
| Button 默认 | `px-4 py-2`（h-9） |

### 2.3 Gap 标准

| 用途 | gap |
|------|-----|
| 按钮组 / 紧凑组合 | `gap-2` |
| 列表项 | `gap-3` |
| 卡片网格 | `gap-4` ~ `gap-6` |
| Section 内部块 | `gap-6` ~ `gap-8` |

### 2.4 响应式断点

| 前缀 | 触发宽度 | 用法 |
|------|---------|------|
| `sm:` | ≥640px | 小屏微调 |
| `md:` | ≥768px | 平板布局 |
| `lg:` | ≥1024px | **主用 desktop 切换点** |
| `xl:` | ≥1280px | 超宽特例 |

**规则**：
- Dashboard 侧栏：`lg:block hidden`（移动端汉堡菜单）
- 阅读器侧栏：`lg:block hidden`
- 任何复杂 desktop-only 布局 → `lg:` 前缀

---

## 3. 组件原子库

### 3.1 必须复用的组件（`components/ui/`）

| 组件 | 何时用 | 文件 |
|------|-------|------|
| `<Button>` | 所有可点击 CTA | `components/ui/button.tsx` |
| `<Card>` / `<CardHeader>` / `<CardContent>` / `<CardTitle>` / `<CardDescription>` | 卡片容器 | `components/ui/card.tsx` |
| `<Input>` / `<Textarea>` / `<Select>` / `<Checkbox>` | 表单输入 | `components/ui/*.tsx` |
| `<Label>` | 表单标签 | `components/ui/label.tsx` |
| `<Badge>` | 状态/标签徽章 | `components/ui/badge.tsx` |
| `<Dialog>` | 普通模态 | `components/ui/dialog.tsx` |
| `<AlertDialog>` | 不可关闭的强制确认 | `components/ui/alert-dialog.tsx` |
| `<ConfirmDialog>` | **确认/删除操作的统一组件** | `components/ui/confirm-dialog.tsx` |
| `<Popover>` | 浮动面板（菜单、过滤器） | `components/ui/popover.tsx` |
| `<DropdownMenu>` | 操作菜单（更多 …） | `components/ui/dropdown-menu.tsx` |
| `<Tabs>` | 多页签切换 | `components/ui/tabs.tsx` |
| `<ScrollArea>` | 长列表自定义滚动条 | `components/ui/scroll-area.tsx` |

⛔ **禁止**重新实现以上任意组件的"轻量版"。如需扩展样式，用 `className` 传入。

### 3.2 Button 用法

`components/ui/button.tsx` 提供的 variant：

| variant | 何时用 |
|---------|-------|
| `default`（默认） | 主操作（提交、确认、保存） |
| `outline` | 次操作（取消、返回） |
| `secondary` | 同级备选操作 |
| `ghost` | 工具栏、icon 按钮 |
| `destructive` | 删除、退出登录 |
| `link` | 文本链接形式 |
| `glass` | 浮在背景上（Landing nav 等） |

size：`default` / `sm` / `lg` / `icon`（不要造新尺寸）。

**Loading 态规范**：
```tsx
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
  {isLoading ? "处理中…" : "保存"}
</Button>
```

### 3.3 业务原子

| 组件 | 用途 |
|------|------|
| `<AIFeatureGuard>` | AI 功能门控（hide / disabled / locked / inline 4 种 fallback） |
| `<MembershipBadge>` | 会员身份徽章（sm / md / lg） |
| `<ConfirmDialog>` | 二次确认（默认 / destructive） |
| `<UpgradeDialog>` | 升级到付费的提示 |

### 3.4 图标

**唯一图标库**：`lucide-react`。

| 尺寸 | px | 场景 |
|------|----|------|
| `h-4 w-4` | 16 | Button 内、表单、紧凑徽章 |
| `h-5 w-5` | 20 | 导航、菜单项 |
| `h-6 w-6` | 24 | 卡片标题、强调 |
| `h-8 w-8` | 32 | 特殊场景（如空状态插画） |

`icon + 文字` 间距：`gap-2`（默认）/ `gap-3`（卡片标题）。

---

## 4. 页面布局模板

### 4.1 认证页（`app/auth/*/page.tsx`）

```tsx
<div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 overflow-hidden bg-slate-50 dark:bg-slate-950">
  {/* 装饰球 */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full -z-10 animate-pulse" />
  <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[100px] rounded-full -z-10" />

  <div className="w-full max-w-sm relative z-10">
    {/* Form 组件 */}
  </div>
</div>
```
✅ 新认证页**直接复制**此骨架，仅替换中间表单组件。

### 4.2 Landing 装饰

`app/page.tsx` 的核心装饰元素：
- 蓝色模糊球：`w-[1000px] h-[600px] bg-blue-400/10 blur-[120px]`
- 紫色模糊球（次要）：`w-[500px] h-[500px] bg-purple-400/5 blur-[100px]`
- 渐变径向背景：`bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)]`

新增宣传页 / 落地页时**沿用此风格**。

### 4.3 Dashboard 主结构

```
┌──────────────────────────────────────┐
│ TopBar (search, filters, view toggle)│
├─────────┬────────────────────────────┤
│ Sidebar │                            │
│ (lg:    │       Main Content         │
│  block  │   (Grid / List / Smart /   │
│  hidden)│    Knowledge)              │
│         │                            │
└─────────┴────────────────────────────┘
```
- 移动端：Sidebar 通过抽屉切换。
- 主区视图切换通过 Tab / Toggle 实现，不刷新 URL。

### 4.4 Reader 三栏（沉浸阅读）

```
┌─────────────────────────────────────────┐
│ GlobalHeader (fixed top + progress bar) │
├─────────┬───────────────┬───────────────┤
│ Left    │               │ Right         │
│ Sidebar │  ContentStage │ Sidebar       │
│ (Out-   │  (Reader/Web/ │ (Annotations/ │
│  line/  │   AIBrief/    │  AI/          │
│  Chap-  │   Archive)    │  Transcript)  │
│  ters)  │               │               │
└─────────┴───────────────┴───────────────┘
```
- **Zen Mode**：按 `Esc` 折叠两侧 sidebar，留下纯净阅读区。
- 三栏在小屏自适应隐藏，提供 icon 按钮重新展开。

### 4.5 Settings 长列表

垂直堆叠的 Section 卡片，每个 section 独立 `<Card>` 容器，使用 `<CardHeader>` + `<CardContent>` 标准结构。

---

## 5. 状态与交互

### 5.1 Loading

| 场景 | 实现 |
|------|------|
| 整页加载 | 骨架屏：`<div className="animate-pulse bg-muted h-X w-Y rounded-md" />` |
| 按钮内 | `<Loader2 className="h-4 w-4 animate-spin" />` |
| 数据 list | 多行骨架占位 |
| 长任务（视频处理等） | Toast `toast.loading()` + 进度文案 |

⛔ 不写 `Loading...` 纯文字（除非临时占位）。

### 5.2 Empty / Error

- **Empty**：图标（lucide）+ 主标题（`text-base font-semibold`）+ 描述（`text-sm text-muted-foreground`）。
- **Error**：优先 `toast.error()`；表单错误用内联 `<p className="text-sm text-destructive">`。
- ⛔ 不要 `alert()` / `confirm()`。

### 5.3 Toast（Sonner）

唯一通知库。**全局已挂载**，直接 `import { toast } from "sonner"`。

| 方法 | 语义 |
|------|------|
| `toast.success(msg)` | 操作成功 |
| `toast.error(msg)` | 操作失败 |
| `toast.info(msg)` | 中性提示 |
| `toast.loading(msg)` | 长任务进行中 |

### 5.4 模态层级

| 选择 | 用途 |
|------|------|
| **`<Dialog>`** | 通用模态（编辑、创建表单） — 点遮罩可关 |
| **`<AlertDialog>`** | 不可遮罩关闭的告警 |
| **`<ConfirmDialog>`**（推荐） | 确认/删除场景 — **删除操作必须用 `variant="destructive"`** |
| **`<Popover>`** | 浮层（用户菜单、过滤器、emoji 选择器） |
| **`<DropdownMenu>`** | 操作菜单（卡片右上 More 等） |

### 5.5 动画规则

**Framer Motion** 用于：
- Landing 入场动画
- Modal / Drawer 打开关闭
- 列表入场（stagger）
- 共享布局（`layoutId`）

**统一时长**（约定俗成，新代码遵守）：
| 节奏 | duration |
|------|----------|
| 微交互 | `0.15s` ~ `0.2s` |
| 标准过渡 | `0.3s` |
| 大幅动画 | `0.6s` ~ `0.8s` |
| Landing 营销 | `0.8s` ~ `1.2s`（ease: `[0.22, 1, 0.36, 1]`） |

**Tailwind transition** 用于：
- 按钮 hover：`transition-colors hover:bg-X`
- 缩放反馈：`active:scale-95 transition-transform`
- 通用：`transition-all duration-200`

---

## 6. 表单

**没有引入 `react-hook-form` / `zod`**。表单状态用 `useState` 管理，提交时校验。

### 6.1 基础结构

```tsx
<form onSubmit={handleSubmit}>
  <div className="flex flex-col gap-4">
    <div className="grid gap-2">
      <Label htmlFor="email">邮箱</Label>
      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={isLoading}>
      {isLoading ? "提交中…" : "提交"}
    </Button>
  </div>
</form>
```

### 6.2 校验时机

- **客户端**：onChange 时只更新 state，**onSubmit 才校验**（避免抖动）
- **服务端**：API 错误通过 `toast.error()` 反馈

### 6.3 必填标识

- 用 `required` HTML 属性触发浏览器原生提示
- 复杂场景才显式标 `*`（红色 `text-destructive`）

---

## 7. 主题与 Dark 模式

### 7.1 切换组件

`components/animated-theme-switcher.tsx` 提供 2 个 variant：

| variant | 用途 |
|---------|------|
| `default` | Landing / Auth 页（标准尺寸） |
| `compact` | Dashboard / Reader 内嵌（紧凑尺寸） |

### 7.2 编写约定

**任何颜色相关的类，必须有 dark 对位**（除非用语义 token）：

✅ `bg-slate-100 dark:bg-slate-800`
✅ `text-foreground`（自适应，无需写 dark）
⛔ `bg-slate-100`（独立类，无 dark）
⛔ `text-black`（无 dark 对位）

### 7.3 自检命令

每次提交前，在浏览器手动切到 dark mode 走一遍主要页面（dashboard / reader / settings / auth）。

---

## 8. 文案约定

### 8.1 语言

- **中文优先**：所有用户可见文本中文，**除非是品牌名 / 技术术语**
- 例外保留英文：`NewsBox`、`AI Copilot`、`Pro`、`Trial`、`Zen Mode`、`URL`

### 8.2 标点

- **中文标点**：句号 `。`、逗号 `，`、冒号 `：`
- **英文标点**：仅在英文短语内部（如 "AI Copilot"）
- **省略号**：`…`（单字符），非 `...`

### 8.3 语气

- 友好、口语化；不堆砌技术词
- 错误：「保存失败，请重试」而非「Failed to save: Network error」
- 不要威胁感词汇（"警告"、"严重错误"），用「提示」「请」

---

## 9. 图片处理

### 9.1 选型

| 来源 | 用什么 |
|------|-------|
| 项目内静态图（公司 logo、占位图） | `next/image` |
| 用户上传图（Supabase Storage） | `<img>` + `referrerPolicy="no-referrer"` |
| 文章抓取的外链图 | `<img>` + `referrerPolicy="no-referrer"` + `loading="lazy"` |

### 9.2 反盗链

外链图必备：
```tsx
<img src={url} alt="…" referrerPolicy="no-referrer" loading="lazy" />
```

### 9.3 占位与失败

- 加载中：父容器加 `bg-muted` 占位
- 失败：`onError` 显示 fallback 图标或 `bg-muted` + 文字

---

## 10. 可访问性

### 10.1 必做

- 所有 icon-only 按钮必须有 **`aria-label`** 或 `<VisuallyHidden>` 内嵌文字
- 所有 `<Dialog>` 必须有 `<DialogTitle>`（视觉隐藏也行）
- 表单 `<Input>` 必须配对 `<Label htmlFor={...}>`

### 10.2 键盘

- 模态可 `Esc` 关闭（`Dialog` 已默认支持）
- Reader Zen Mode：`Esc` 退出
- Dashboard 搜索：`Cmd/Ctrl+K` 唤起（如已实现）

---

## 11. 已知反模式（修复指引）

新代码**禁止**复用以下模式。遇到老代码时，重构优先级如下：

| 反模式 | 出现位置 | 应改为 |
|--------|---------|--------|
| `bg-slate-900/40` 硬编码 | `components/dashboard/smart-topics/StatsCard.tsx:25` | `bg-card` 或 `bg-muted` |
| `rounded-[14px]` 自定义像素 | `dashboard-content.tsx` 多处 | `rounded-lg` / `rounded-xl` |
| `shadow-[0_8px_32px_0_rgba(...)]` | 多处玻璃卡片 | `shadow-lg` + `glass` 工具类 |
| 缺 `dark:` 前缀 | `dashboard-content.tsx` / `knowledge-view.tsx` | 全部补齐 |
| 颜色硬编码 `#XXX` | `animated-theme-switcher.tsx` 等 | 用 `text-foreground` / `text-primary` |
| `Loading...` 纯文字 | `app/dashboard/page.tsx:9` | 骨架屏 |
| 动画时长五花八门 | Landing | 按 §5.5 标准化 |

---

## 12. 给新功能的 Checklist

新建一个页面/卡片/对话框前，按此清单自检：

- [ ] 颜色全走 token / Tailwind 语义类（无 `#XXX`）
- [ ] 所有手写颜色类配套 `dark:` 前缀
- [ ] 复用 `components/ui/` 原子，没有重复造轮子
- [ ] 圆角用 Tailwind 原生类（`rounded-lg/xl/2xl/full`）
- [ ] Loading / Empty / Error 三态都处理了
- [ ] 危险操作走 `<ConfirmDialog variant="destructive">`
- [ ] 操作反馈用 `toast.success/error()`
- [ ] icon-only 按钮有 `aria-label`
- [ ] 表单 `<Input>` 配对 `<Label>` + `disabled={isLoading}`
- [ ] 文案中文 + 中文标点 + 友好语气
- [ ] 移动端：至少在 `lg` 以下能用（不必完美）
- [ ] 外链图加 `referrerPolicy="no-referrer"`
- [ ] 实测 light + dark 两套主题

---

## 13. 快速参考速查表

### 13.1 颜色一眼表

| 想做 | 怎么写 |
|------|-------|
| 主按钮 | `<Button>` |
| 危险按钮 | `<Button variant="destructive">` |
| 卡片背景 | `<Card>`（内置 `bg-card`） |
| 浅色背景区块 | `bg-muted` |
| 主色文字 | `text-primary` |
| 描述文字 | `text-muted-foreground` |
| 边框 | `border`（默认 `border-border`） |

### 13.2 圆角一眼表

| 元素 | 类 | 实际值 |
|------|-----|-------|
| 按钮、徽章圆形 | `rounded-full` | ∞ |
| 表单输入 | `rounded-md` | 18px |
| 标准卡片 | `rounded-lg` | 20px |
| 中等卡片 | `rounded-2xl` | 16px |
| 大卡片 / Stats | `rounded-3xl` | 24px |

### 13.3 字号一眼表

| 元素 | 类 |
|------|-----|
| 页面标题 | `text-2xl font-bold` |
| 卡片标题 | `text-lg font-bold` |
| 副标题/Label | `text-sm font-semibold` |
| 正文 | `text-base`（不写） |
| 描述 | `text-sm text-muted-foreground` |
| 标签/时间 | `text-xs text-muted-foreground` |

### 13.4 间距一眼表

| 容器 | padding |
|------|---------|
| Card 内部 | `p-6` |
| 模态内部 | `p-6` |
| Section 垂直 | `py-16` |
| 紧凑徽章 | `px-2 py-0.5` |
| 表单元素 | `px-3 py-1.5` |

---

## 14. 演进与维护

- 新发现的模式 → 提 PR 更新本文档
- 出现新的反模式 → 加入 §11 修复指引
- token 调整 → 同步更新 `globals.css` + `tailwind.config.ts` + 本文档 §1
- 不一致争议 → 在 PR Review 中讨论，回归本文档优先级原则

> **本文档是活的**。任何 Reviewer 看到偏差，请引用具体规则号（如「违反 §1.5 圆角约定」）。
