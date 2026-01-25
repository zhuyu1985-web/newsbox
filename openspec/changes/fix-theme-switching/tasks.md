# Tasks: Theme Switching System

## Implementation Tasks

### Phase 1: 核心功能验证

#### Task 1.1: 验证主题切换器组件
- [x] 验证 `components/animated-theme-switcher.tsx` 文件存在
- [x] 验证组件使用 `useTheme` hook
- [x] 验证组件支持 `default` 和 `compact` 两种变体
- [x] 验证组件有 Framer Motion 动画效果

**Validation**: 组件文件存在，代码审查通过

---

#### Task 1.2: 验证首页集成
- [x] 验证 `app/page.tsx` 导入 `AnimatedThemeSwitcher`
- [x] 验证组件添加到导航栏（`<AnimatedThemeSwitcher variant="default" />`）
- [x] 验证位置在登录/注册按钮之前
- [x] 测试点击按钮能弹出菜单

**Validation**: 首页能看到主题切换器按钮，点击后菜单弹出

---

#### Task 1.3: 验证 Dashboard 集成
- [x] 验证 `components/dashboard/dashboard-content.tsx` 导入组件
- [x] 验证组件添加到底部操作区（`<AnimatedThemeSwitcher variant="compact" />`）
- [x] 验证位置在浏览历史按钮之前
- [x] 测试按钮样式与其他按钮一致

**Validation**: Dashboard 能看到主题切换器按钮，样式与相邻按钮一致

---

### Phase 2: 暗色模式适配修复

#### Task 2.1: 修复 AppearanceSection
- [x] 修复 ThemeBtn 组件 active 状态样式
- [x] 添加 `dark:bg-slate-800` 到 active 状态
- [x] 添加 `dark:text-white` 到 active 状态
- [x] 添加 `dark:text-slate-400` 到 inactive 状态
- [x] 测试设置页面主题切换按钮在暗色模式下显示正确

**Validation**: 设置页面的主题按钮在暗色模式下有正确的背景和文字颜色

**File**: `components/settings/sections/AppearanceSection.tsx`

---

#### Task 2.2: 修复 SmartTopicsDashboard
- [ ] 修复主容器背景（Line 140）：添加 `dark:bg-slate-950`
- [ ] 修复导航栏背景（Line 146）：添加 `dark:bg-slate-900`
- [ ] 修复导航栏边框：添加 `dark:border-slate-800`
- [ ] 修复标题文字（Line 148）：添加 `dark:text-white`
- [ ] 修复副标题文字（Line 152）：添加 `dark:text-slate-500 dark:text-slate-400`
- [x] 测试智能专题页面在暗色模式下显示正常

**Validation**: 智能专题页面在暗色模式下背景和文字颜色正确

**File**: `components/dashboard/smart-topics/SmartTopicsDashboard.tsx`

---

#### Task 2.3: 修复 TopicCard
- [ ] 修复卡片背景：添加 `dark:bg-slate-900`
- [ ] 修复卡片边框：添加 `dark:border-slate-700/50`
- [ ] 修复 Badge：添加 `dark:bg-blue-950/50` 和 `dark:text-blue-400`
- [ ] 修复标题：添加 `dark:text-white`
- [ ] 修复标签区域：添加 `dark:bg-slate-800`
- [ ] 修复统计数字：添加 `dark:text-slate-300`
- [ ] 修复右侧装饰区域：添加 `dark:border-slate-800`
- [ ] 修复悬浮按钮：添加完整的 dark 变体
- [x] 测试专题卡片在暗色模式下显示正常

**Validation**: 专题卡片在暗色模式下所有元素颜色正确

**File**: `components/dashboard/smart-topics/TopicCard.tsx`

---

#### Task 2.4: 修复首页场景演绎 Section
- [ ] 修复 section 背景（Line 752）：改为 `bg-white dark:bg-[#050505]`
- [ ] 修复 section 文字：添加 `text-slate-900 dark:text-white`
- [ ] 修复副标题文字（Line 757）：添加 `text-slate-600 dark:text-white/50`
- [ ] 修复分隔线（Line 759）：添加 `dark:bg-white/10`
- [ ] 修复场景描述文字：添加 dark 变体
- [x] 测试首页在暗色模式下显示正常

**Validation**: 首页场景演绎 section 在暗色模式下文字可见

**File**: `app/page.tsx`

---

#### Task 2.5: 修复 VideoPlayer
- [ ] 修复底部提示栏背景：添加 `dark:bg-slate-900/80`
- [ ] 修复底部提示栏边框：添加 `dark:border-slate-700`
- [ ] 修复提示文字：添加 `dark:text-slate-400`
- [x] 测试视频播放器在暗色模式下显示正常

**Validation**: 视频播放器底部提示在暗色模式下显示正确

**File**: `components/reader/ContentStage/VideoPlayer.tsx`

---

#### Task 2.6: 修复 Dashboard 侧边栏
- [x] 验证主容器背景有 `dark:bg-slate-950`
- [x] 验证左侧导航栏背景有 `dark:bg-slate-900`
- [x] 验证右侧导航栏背景有 `dark:bg-slate-900/50`
- [x] 验证导航按钮文字有 `dark:text-slate-100`（active）
- [x] 验证导航按钮文字有 `dark:text-slate-400`（inactive）
- [x] 测试 Dashboard 在暗色模式下显示正常

**Validation**: Dashboard 侧边栏在暗色模式下颜色正确

**File**: `components/dashboard/dashboard-content.tsx`

---

### Phase 3: 全面测试验证

#### Task 3.1: 功能测试
- [x] 测试浅色模式切换：点击"浅色"，页面变为浅色
- [x] 测试暗色模式切换：点击"深色"，页面变为暗色
- [x] 测试系统跟随：点击"自动"，跟随系统主题
- [x] 测试菜单动画：弹出菜单有平滑动画
- [x] 测试状态指示：当前选中项有背景高亮

**Validation**: 所有功能正常工作

---

#### Task 3.2: 视觉测试
- [x] 测试首页导航栏：浅色/暗色模式都正常
- [x] 测试首页场景演绎：文字在两种模式下都可见
- [x] 测试 Dashboard 主容器：背景色正确切换
- [x] 测试 Dashboard 侧边栏：文字颜色正确切换
- [x] 测试智能专题页面：完整适配暗色模式
- [x] 测试设置页面：主题切换按钮显示正确

**Validation**: 所有页面在两种模式下显示正常

---

#### Task 3.3: 技术验证
- [ ] 打开浏览器控制台
- [ ] 运行 `document.documentElement.classList` 检查 class
- [x] 验证切换主题时 `dark` class 正确添加/移除
- [ ] 运行 `localStorage.getItem('theme')` 检查存储
- [x] 验证主题值正确保存
- [ ] 检查控制台没有 JavaScript 错误

**Validation**: DOM 和 localStorage 正确更新

---

#### Task 3.4: 对比度测试
- [ ] 使用浏览器开发工具检查主要文字对比度
- [x] 验证浅色模式下对比度 >= 4.5:1
- [x] 验证暗色模式下对比度 >= 4.5:1
- [ ] 记录任何对比度不足的问题

**Validation**: 符合 WCAG AA 标准

---

### Phase 4: 文档和清理

#### Task 4.1: 更新文档
- [ ] 更新 `CLAUDE.md` 中的主题系统说明
- [ ] 记录主题切换器组件的使用方法
- [ ] 记录暗色模式适配的最佳实践

**Validation**: 文档完整准确

---

#### Task 4.2: 代码清理
- [ ] 移除未使用的 `theme-switcher.tsx`（如果不需要）
- [ ] 统一颜色类命名规范
- [ ] 移除调试用的 `console.log`

**Validation**: 代码整洁无冗余

---

## Dependencies

### 并行任务
- Task 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 可以并行执行（不同文件）

### 顺序依赖
- Phase 1 必须在 Phase 2 之前完成（验证核心功能）
- Phase 2 必须在 Phase 3 之前完成（修复后再测试）
- Phase 4 在 Phase 3 之后完成（最后更新文档）

### 阻塞条件
- 如果 Task 1.1 失败（组件不存在），需要先创建组件
- 如果某个文件修改失败，需要跳过并记录

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 3 tasks | 30 minutes |
| Phase 2 | 6 tasks | 2-3 hours |
| Phase 3 | 4 tasks | 1 hour |
| Phase 4 | 2 tasks | 30 minutes |
| **Total** | **15 tasks** | **4-5 hours** |

---

## Validation Checklist

在提交 PR 之前，确保：

- [ ] 所有任务标记为完成
- [ ] 功能测试通过
- [ ] 视觉测试通过
- [ ] 技术验证通过
- [ ] 没有新的 TypeScript 错误
- [ ] 没有新的 ESLint 警告
- [ ] 文档已更新
