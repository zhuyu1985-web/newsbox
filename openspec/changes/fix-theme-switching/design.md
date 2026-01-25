# Design: Theme Switching System

## Overview

本设计文档说明了主题切换系统的技术实现方案，包括组件设计、状态管理、样式系统和测试策略。

## Architecture

### Current State

项目已使用 `next-themes` 库实现主题系统：
- **Provider**: `ThemeProvider` 在 `app/providers.tsx` 中配置
- **Attribute**: 使用 `class` 模式（`<html class="dark">`）
- **Storage**: 默认存储在 `localStorage.theme`
- **Default Theme**: `system`（跟随系统）

```
┌─────────────────────────────────────────────────────────────┐
│                         App                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ThemeProvider (next-themes)             │   │
│  │  - attribute="class"                                │   │
│  │  - defaultTheme="system"                            │   │
│  │  - enableSystem                                     │   │
│  │  - disableTransitionOnChange                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            AnimatedThemeSwitcher                     │   │
│  │  - useTheme() hook                                  │   │
│  │  - Framer Motion animations                         │   │
│  │  - Popover menu with 3 options                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  <html class="dark">  │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Tailwind dark: prefix │
              │  dark:bg-slate-900      │
              │  dark:text-white       │
              └────────────────────────┘
```

### Component Design

#### AnimatedThemeSwitcher

**Props**:
```typescript
interface AnimatedThemeSwitcherProps {
  variant?: "default" | "compact";
}
```

**Variants**:
- `default`: 标准尺寸，用于首页（`w-10 h-10`）
- `compact`: 紧凑尺寸，用于 Dashboard（`w-[46px] h-[46px]`）

**State**:
- `mounted`: 防止 SSR 水合不匹配
- `isOpen`: 控制弹出菜单显示/隐藏
- `theme`: 当前主题值（`"light" | "dark" | "system"`）

**Features**:
1. **按钮显示**: 显示当前主题对应的图标
2. **弹出菜单**: 点击后显示 3 个选项
3. **动画效果**: 使用 Framer Motion 实现平滑过渡
4. **外部点击**: 点击菜单外部自动关闭
5. **状态指示**: 当前选中项有背景高亮

## Theme System

### Theme Values

```typescript
type Theme = "light" | "dark" | "system";
```

### Theme Resolution

```
┌──────────────┐
│ User Selection│
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ theme === "system"│
│        │         │
│   YES │  NO     │
│       │         │
┌───────┴─────────┴─┐
│                   │
▼                   ▼
System Theme    theme value
(prefers-color     (light/dark)
 -scheme)
```

### Storage

**Key**: `theme` (default) or `newsbox-theme` (recommended)

**Values**:
- `"light"` - 浅色模式
- `"dark"` - 暗色模式
- `"system"` - 跟随系统

## Styling Strategy

### Tailwind Dark Mode

**Configuration**:
```typescript
// tailwind.config.ts
darkMode: ["class"];
```

**Usage**:
```tsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  {/* 浅色模式: 白色背景，深色文字 */}
  {/* 暗色模式: 深色背景，浅色文字 */}
</div>
```

### Color Tokens

**Semantic Colors** (推荐使用):
- `background` / `foreground`
- `card` / `card-foreground`
- `primary` / `primary-foreground`
- `muted` / `muted-foreground`
- `border`
- `input`
- `ring`

**Slate Colors** (广泛使用):
- Backgrounds: `bg-slate-50` → `dark:bg-slate-900`
- Text: `text-slate-900` → `dark:text-slate-100`
- Borders: `border-slate-200` → `dark:border-slate-800`

### Fixed Colors (需避免)

**问题示例**:
```tsx
// ❌ 硬编码十六进制颜色
<div className="bg-[#f5f5f7]">
<div className="text-[#4A4A4A]">

// ✅ 使用语义化 Tailwind 颜色
<div className="bg-slate-50 dark:bg-slate-950">
<div className="text-slate-600 dark:text-slate-400">
```

## Animation Design

### Menu Open/Close

```typescript
// 弹出动画
initial={{ opacity: 0, scale: 0.9, y: -10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.9, y: -10 }}
transition={{
  type: "spring",
  stiffness: 400,
  damping: 25,
}}
```

### Menu Items Stagger

```typescript
// 菜单项依次出现
initial={{ opacity: 0, x: -10 }}
animate={{ opacity: 1, x: 0 }}
transition={{
  delay: index * 0.05,  // 每项延迟 50ms
  type: "spring",
  stiffness: 400,
  damping: 25,
}}
```

### Active Indicator

```typescript
// 使用 layoutId 实现平滑移动
<motion.div
  layoutId="active-theme-bg"
  className="absolute inset-0 bg-blue-50 dark:bg-blue-950/30"
/>
```

## Accessibility

### WCAG Compliance

**Contrast Requirements**:
- Normal text: 至少 4.5:1 (WCAG AA)
- Large text: 至少 3:1 (WCAG AA)
- Interactive elements: 至少 3:1 (WCAG AA)

**Theme Colors**:
- Light mode: `text-slate-900` on `bg-slate-50` ✅
- Dark mode: `text-slate-100` on `bg-slate-900` ✅

### Keyboard Navigation

- `Tab` - 聚焦主题切换器按钮
- `Enter`/`Space` - 打开菜单
- `Arrow Keys` - 在菜单项间导航
- `Escape` - 关闭菜单

### Screen Reader

- 按钮 `aria-label`: "切换主题，当前：浅色模式"
- 菜单 `role`: "menu"
- 菜单项 `role`: "menuitem-radio"

## Performance

### Hydration Mismatch Prevention

```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return <div className="w-[46px] h-[46px]" />; // 占位符
}
```

### Animation Performance

- 使用 `transform` 和 `opacity`（GPU 加速）
- 避免动画 `width`、`height`（触发 reflow）
- 使用 `will-change` 谨慎（仅在必要时）

## Testing Strategy

### Unit Tests

```typescript
describe("AnimatedThemeSwitcher", () => {
  it("should render current theme icon", () => {});
  it("should open menu on click", () => {});
  it("should close menu on outside click", () => {});
  it("should call setTheme when option selected", () => {});
});
```

### Integration Tests

```typescript
describe("Theme Switching", () => {
  it("should update localStorage when theme changes", () => {});
  it("should add/remove 'dark' class on html element", () => {});
  it("should respect system theme preference", () => {});
});
```

### Visual Regression Tests

使用 Playwright 或 Percy 截图对比：
- 首页浅色模式
- 首页暗色模式
- Dashboard 浅色模式
- Dashboard 暗色模式

## Migration Strategy

### Phase 1: Core Functionality
1. ✅ 创建 AnimatedThemeSwitcher 组件
2. ✅ 集成到首页和 Dashboard
3. ✅ 验证基础功能

### Phase 2: Dark Mode Fixes
1. 修复 P0 组件（核心功能）
2. 修复 P1 组件（用户体验）
3. 全面测试验证

### Phase 3: Polish
1. 优化动画效果
2. 改进视觉反馈
3. 性能优化

## Rollback Plan

如果出现问题，可以通过以下步骤回滚：
1. 移除 `AnimatedThemeSwitcher` 组件引用
2. 恢复原有的 `ThemeSwitcher` 组件（如需要）
3. 回滚样式修改

## Future Enhancements

1. **主题预设**: 添加多种颜色主题
2. **自定义主题**: 允许用户自定义主题色
3. **定时切换**: 根据时间自动切换
4. **主题预览**: 鼠标悬停时预览主题效果
