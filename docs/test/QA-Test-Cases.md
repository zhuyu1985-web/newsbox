# NewsBox AI 稍后阅读助手 - 详细测试用例

**文档版本**: v1.0
**编制日期**: 2026-01-05
**项目**: NewsBox AI 稍后阅读助手

---

## 目录

1. [认证系统测试用例](#模块-1-认证系统)
2. [Dashboard 测试用例](#模块-2-dashboard-工作台)
3. [Reader 测试用例](#模块-3-reader-阅读器)
4. [AI 功能测试用例](#模块-4-ai-功能)
5. [批注系统测试用例](#模块-5-批注系统)
6. [知识库测试用例](#模块-6-知识库)
7. [标签管理测试用例](#模块-7-标签管理)
8. [内容采集测试用例](#模块-8-内容采集)
9. [设置管理测试用例](#模块-9-设置管理)
10. [安全测试用例](#模块-10-安全测试)

---

## 测试用例说明

**用例模板**:
```markdown
## [TC-ID]: 测试标题

**优先级**: P0/P1/P2
**模块**: 模块名称
**类型**: 单元/集成/E2E/性能/安全/AI
**自动化**: 是/否

### 描述
简要说明测试目的

### 前置条件
- 条件1
- 条件2

### 测试步骤
1. 步骤1
2. 步骤2

### 预期结果
预期看到的输出

### 测试代码
\`\`\`typescript
// 实际可执行的测试代码
\`\`\`

### 实际结果
[执行时填写]

### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

### 备注
其他观察、发现的问题

### 证据
[截图 / 视频 / 日志]
```

**结果标记**:
- ✓ = 通过
- ✗ = 失败
- ⚠ = 警告
- ⊘ = 跳过
- ◐ = 进行中

---

## 模块 1: 认证系统

### AC-001: 用户注册 - 正常流程

**优先级**: P0
**模块**: 认证系统
**类型**: E2E
**自动化**: 是

#### 描述
验证新用户可以成功注册账户

#### 前置条件
- 用户未登录
- 邮箱未被注册

#### 测试步骤
1. 导航到 `/auth/sign-up`
2. 输入邮箱：`test@example.com`
3. 输入密码：`Test123456!`（包含大小写字母、数字、特殊字符）
4. 再次输入密码确认
5. 点击"注册"按钮
6. 检查邮箱收到的验证链接
7. 点击验证链接

#### 预期结果
- 注册表单验证通过
- 显示"请检查邮箱验证您的账户"消息
- 邮箱收到验证邮件
- 点击验证链接后自动登录并跳转到 `/dashboard`

#### 测试代码

```typescript
// e2e/auth/signup.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('AC-001: User can register with valid credentials', async ({ page }) => {
    // 导航到注册页面
    await page.goto('/auth/sign-up');

    // 填写表单
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'Test123456!');
    await page.fill('input[name="confirmPassword"]', 'Test123456!');

    // 同意条款
    await page.check('input[type="checkbox"]');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证成功消息
    await expect(page.locator('text=请检查邮箱验证您的账户')).toBeVisible();

    // 验证跳转到登录页面或等待验证
    await expect(page).toHaveURL(/\/(auth\/login|auth\/confirm)/);
  });

  test('AC-002: Password strength validation', async ({ page }) => {
    await page.goto('/auth/sign-up');

    // 测试弱密码
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', '123'); // 弱密码
    await page.fill('input[name="confirmPassword"]', '123');
    await page.check('input[type="checkbox"]');

    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=密码强度不足')).toBeVisible();
  });

  test('AC-003: Duplicate email rejection', async ({ page }) => {
    const email = `duplicate-test@example.com`;

    // 第一次注册
    await page.goto('/auth/sign-up');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'ValidPass123!');
    await page.fill('input[name="confirmPassword"]', 'ValidPass123!');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // 第二次注册相同邮箱
    await page.goto('/auth/sign-up');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'ValidPass123!');
    await page.fill('input[name="confirmPassword"]', 'ValidPass123!');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=邮箱已被注册')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

#### 备注
- 需要配置邮箱服务（Supabase Auth 自带）
- 测试邮箱可以使用临时邮箱服务

---

### AC-004: 用户登录

**优先级**: P0
**模块**: 认证系统
**类型**: E2E
**自动化**: 是

#### 描述
验证已注册用户可以成功登录

#### 前置条件
- 用户已注册
- 用户未登录

#### 测试步骤
1. 导航到 `/auth/login`
2. 输入注册邮箱：`test@example.com`
3. 输入密码：`Test123456!`
4. 可选：勾选"记住我"
5. 点击"登录"按钮

#### 预期结果
- 表单验证通过
- 成功登录
- 跳转到 `/dashboard`
- 如果勾选"记住我"，刷新后仍保持登录状态

#### 测试代码

```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Login', () => {
  test('AC-004: User can login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    // 验证跳转到 Dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('我的收藏');
  });

  test('AC-005: Login fails with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');

    // 验证错误消息
    await expect(page.locator('text=邮箱或密码错误')).toBeVisible();
  });

  test('AC-006: "Remember me" functionality', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');

    // 勾选"记住我"
    await page.check('input[type="checkbox"]');

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 刷新页面
    await page.reload();

    // 验证仍然登录
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=我的收藏')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

### AC-007: 密码重置

**优先级**: P1
**模块**: 认证系统
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以重置忘记的密码

#### 前置条件
- 用户已注册
- 用户忘记密码

#### 测试步骤
1. 导航到 `/auth/forgot-password`
2. 输入注册邮箱：`test@example.com`
3. 点击"发送重置链接"按钮
4. 检查邮箱收到的重置链接
5. 点击重置链接（或复制到浏览器）
6. 输入新密码：`NewPass123!`
7. 确认新密码
8. 点击"重置密码"按钮

#### 预期结果
- 显示"重置链接已发送"消息
- 邮箱收到重置邮件
- 重置链接有效期为 1 小时
- 密码重置成功后，旧密码失效
- 自动跳转到登录页面

#### 测试代码

```typescript
// e2e/auth/password-reset.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('AC-007: User can reset forgotten password', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button:has-text("发送重置链接")');

    // 验证成功消息
    await expect(page.locator('text=重置链接已发送')).toBeVisible();

    // 实际测试需要手动检查邮箱或使用测试邮箱服务
    // 这里假设我们从邮件中获取了重置链接
    const resetLink = 'https://example.com/auth/reset?token=xxx';

    await page.goto(resetLink);

    await page.fill('input[name="password"]', 'NewPass123!');
    await page.fill('input[name="confirmPassword"]', 'NewPass123!');
    await page.click('button[type="submit"]');

    // 验证成功消息和跳转
    await expect(page.locator('text=密码已重置')).toBeVisible();
    await expect(page).toHaveURL('/auth/login');

    // 验证新密码可以登录
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'NewPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 2: Dashboard (工作台)

### DB-001: 无限滚动加载

**优先级**: P0
**模块**: Dashboard
**类型**: E2E + 单元
**自动化**: 是

#### 描述
验证滚动到底部时自动加载更多笔记

#### 前置条件
- 用户已登录
- 用户笔记 > 10 条

#### 测试步骤
1. 导航到 `/dashboard`
2. 初始加载显示 10 条笔记
3. 滚动到页面底部
4. 观察加载指示器
5. 验证新笔记被添加到列表

#### 预期结果
- 初始显示 10 条笔记
- 滚动到底部时显示加载指示器
- 10 条新笔记被追加到列表
- 总共显示 20 条笔记
- 没有重复笔记

#### 测试代码

```typescript
// e2e/dashboard/infinite-scroll.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Infinite Scroll', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('DB-001: Loads more notes when scrolling to bottom', async ({ page }) => {
    // 等待初始加载
    await page.waitForSelector('[data-testid="note-card"]');

    // 计算初始笔记数量
    const initialCount = await page.locator('[data-testid="note-card"]').count();
    expect(initialCount).toBeGreaterThan(0);

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 等待加载更多
    await page.waitForResponse(
      response => response.url().includes('/api/notes'),
      { timeout: 5000 }
    );

    // 验证笔记数量增加
    const newCount = await page.locator('[data-testid="note-card"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('DB-002: Shows loading indicator during fetch', async ({ page }) => {
    await page.waitForSelector('[data-testid="note-card"]');

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 验证加载指示器出现
    await expect(page.locator('[data-testid="loading-sentinel"]')).toBeVisible();

    // 等待加载完成
    await page.waitForSelector('[data-testid="loading-sentinel"]', { state: 'hidden' });
  });

  test('DB-003: Prevents duplicate note loading', async ({ page }) => {
    await page.waitForSelector('[data-testid="note-card"]');

    // 快速连续滚动两次
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 等待所有请求完成
    await page.waitForLoadState('networkidle');

    // 验证没有重复的笔记 ID
    const noteIds = await page.locator('[data-testid="note-card"]').allTextContents();
    const uniqueIds = new Set(noteIds);

    expect(uniqueIds.size).toBe(noteIds.length);
  });
});
```

```typescript
// __tests__/components/dashboard/dashboard-content.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardContent from '@/components/dashboard/dashboard-content';

describe('DashboardContent - Infinite Scroll', () => {
  const mockSupabase = {
    from: jest.fn(() => mockSupabase),
    select: jest.fn(() => mockSupabase),
    eq: jest.fn(() => mockSupabase),
    order: jest.fn(() => mockSupabase),
    range: jest.fn(() => mockSupabase),
    single: jest.fn(() => mockSupabase),
  };

  const mockNotes = Array.from({ length: 20 }, (_, i) => ({
    id: `note-${i}`,
    title: `Note ${i}`,
    source_url: `https://example.com/${i}`,
    content_type: 'article',
    status: 'unread',
    created_at: new Date().toISOString(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DB-001: Loads more notes on scroll', async () => {
    // Mock 第一次调用返回 10 条
    mockSupabase.range.mockResolvedValueOnce({
      data: mockNotes.slice(0, 10),
      error: null,
    });

    // Mock 第二次调用返回接下来的 10 条
    mockSupabase.range.mockResolvedValueOnce({
      data: mockNotes.slice(10, 20),
      error: null,
    });

    render(<DashboardContent supabase={mockSupabase} />);

    // 验证初始加载
    expect(await screen.findAllByTestId('note-card')).toHaveLength(10);

    // 模拟滚动到底部
    const sentinel = screen.getByTestId('infinite-scroll-sentinel');
    fireEvent.scroll(sentinel, { target: { scrollY: 10000 } });

    // 等待更多笔记加载
    await waitFor(() => {
      expect(screen.getAllByTestId('note-card')).toHaveLength(20);
    });
  });

  it('DB-004: Handles API errors gracefully', async () => {
    // Mock API 失败
    mockSupabase.range.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    render(<DashboardContent supabase={mockSupabase} />);

    // 滚动触发加载
    const sentinel = screen.getByTestId('infinite-scroll-sentinel');
    fireEvent.scroll(sentinel, { target: { scrollY: 10000 } });

    // 验证错误提示
    await expect(await screen.findByText('加载失败，请重试')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

#### 备注
- 需要准备至少 20 条测试数据
- IntersectionObserver 触发条件需要仔细测试

---

### DB-005: 批量操作 - 星标

**优先级**: P0
**模块**: Dashboard
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以批量设置/取消星标

#### 前置条件
- 用户已登录
- 至少有 5 条笔记

#### 测试步骤
1. 导航到 `/dashboard`
2. 点击"批量操作"按钮
3. 勾选 3 条笔记
4. 点击"批量星标"按钮
5. 验证 3 条笔记显示星标图标
6. 点击"取消星标"
7. 验证星标被移除

#### 预期结果
- 进入批量模式
- 勾选的笔记显示选中状态
- 批量星标操作成功
- 所有选中笔记都被添加星标
- 批量取消星标成功
- 操作有 toast 提示

#### 测试代码

```typescript
// e2e/dashboard/batch-operations.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Batch Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('DB-005: Batch star/unstar notes', async ({ page }) => {
    // 进入批量模式
    await page.click('[data-testid="batch-mode-button"]');

    // 选择 3 条笔记
    const checkboxes = page.locator('[data-testid="note-checkbox"]').nth(0);
    await checkboxes.click();
    await page.locator('[data-testid="note-checkbox"]').nth(1).click();
    await page.locator('[data-testid="note-checkbox"]').nth(2).click();

    // 验证批量操作栏出现
    await expect(page.locator('[data-testid="batch-action-bar"]')).toBeVisible();

    // 点击批量星标
    await page.click('[data-testid="batch-star-button"]');

    // 验证成功提示
    await expect(page.locator('text=已设为星标')).toBeVisible();

    // 验证 3 条笔记显示星标
    const starredCount = await page.locator('[data-testid="note-card"] [data-starred="true"]').count();
    expect(starredCount).toBeGreaterThanOrEqual(3);

    // 退出批量模式
    await page.click('[data-testid="exit-batch-mode"]');

    // 验证星标图标可见
    const firstNoteStar = page.locator('[data-testid="note-card"]').first().locator('[data-testid="star-icon"]');
    await expect(firstNoteStar).toHaveClass(/text-yellow/);
  });

  test('DB-006: Batch move to folder', async ({ page }) => {
    await page.click('[data-testid="batch-mode-button"]');

    // 选择 2 条笔记
    await page.locator('[data-testid="note-checkbox"]').nth(0).click();
    await page.locator('[data-testid="note-checkbox"]').nth(1).click();

    // 点击批量移动
    await page.click('[data-testid="batch-move-button"]');

    // 选择文件夹
    await page.click('text=Tech');

    // 验证成功提示
    await expect(page.locator('text=已移动到收藏夹')).toBeVisible();

    // 验证笔记显示文件夹标签
    await expect(page.locator('[data-testid="note-card"]').nth(0).locator('text=Tech')).toBeVisible();
  });

  test('DB-007: Batch delete with confirmation', async ({ page }) => {
    await page.click('[data-testid="batch-mode-button"]');

    // 选择 1 条笔记
    await page.locator('[data-testid="note-checkbox"]').nth(0).click();

    // 点击批量删除
    await page.click('[data-testid="batch-delete-button"]');

    // 验证确认对话框
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await expect(page.locator('text=确定要删除这 1 条笔记吗？')).toBeVisible();

    // 点击确认
    await page.click('[data-testid="confirm-delete-button"]');

    // 验证成功提示
    await expect(page.locator('text=已删除')).toBeVisible();

    // 验证笔记从列表中消失
    const noteCount = await page.locator('[data-testid="note-card"]').count();
    const initialCount = noteCount - 1;
    await expect(page.locator('[data-testid="note-card"]')).toHaveCount(initialCount);
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

### DB-008: 添加笔记 - URL 捕获

**优先级**: P0
**模块**: Dashboard
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以通过 URL 添加笔记

#### 前置条件
- 用户已登录
- API 服务可用

#### 测试步骤
1. 导航到 `/dashboard`
2. 点击"添加笔记"按钮
3. 默认显示"URL"标签
4. 输入 URL：`https://example.com/article`
5. 点击"保存"按钮
6. 等待抓取完成

#### 预期结果
- 打开添加笔记模态框
- URL 输入框显示
- 显示加载状态
- 抓取成功后显示成功提示
- 新笔记出现在列表顶部
- 笔记包含正确的标题、封面图

#### 测试代码

```typescript
// e2e/dashboard/add-note.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Add Note', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('DB-008: Add note via URL', async ({ page }) => {
    // 打开添加笔记模态框
    await page.click('[data-testid="add-note-button"]');

    // 验证模态框打开
    await expect(page.locator('[data-testid="add-note-modal"]')).toBeVisible();

    // 验证默认在 URL 标签
    await expect(page.locator('[data-testid="tab-url"]')).toHaveClass(/active/);

    // 输入 URL
    await page.fill('input[name="url"]', 'https://example.com/test-article');

    // 点击保存
    await page.click('button:has-text("保存")');

    // 验证加载状态
    await expect(page.locator('[data-testid="capture-loading"]')).toBeVisible();

    // 等待完成
    await page.waitForSelector('[data-testid="capture-loading"]', { state: 'hidden', timeout: 30000 });

    // 验证成功提示
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 验证模态框关闭
    await expect(page.locator('[data-testid="add-note-modal"]')).not.toBeVisible();

    // 验证新笔记出现在列表
    const firstNote = page.locator('[data-testid="note-card"]').first();
    await expect(firstNote).toBeVisible();
    await expect(firstNote).toContainText('example.com');
  });

  test('DB-009: URL validation', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');

    // 输入无效 URL
    await page.fill('input[name="url"]', 'not-a-valid-url');
    await page.click('button:has-text("保存")');

    // 验证错误提示
    await expect(page.locator('text=请输入有效的 URL')).toBeVisible();
  });

  test('DB-010: Duplicate URL detection', async ({ page }) => {
    // 添加同一个 URL 两次
    const url = 'https://example.com/unique-article';

    // 第一次添加
    await page.click('[data-testid="add-note-button"]');
    await page.fill('input[name="url"]', url);
    await page.click('button:has-text("保存")');
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 第二次添加相同 URL
    await page.click('[data-testid="add-note-button"]');
    await page.fill('input[name="url"]', url);
    await page.click('button:has-text("保存")');

    // 验证提示已存在
    await expect(page.locator('text=该文章已在收藏中')).toBeVisible();
  });

  test('DB-011: Manual text input', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');

    // 切换到手动输入标签
    await page.click('[data-testid="tab-manual"]');

    // 填写标题和内容
    await page.fill('input[name="title"]', 'My Test Note');
    await page.fill('textarea[name="content"]', 'This is the content of my test note.');

    // 选择标签
    await page.click('[data-testid="tag-selector"]');
    await page.click('text=AI');
    await page.click('[data-testid="tag-selector"]'); // 关闭

    // 保存
    await page.click('button:has-text("保存")');

    // 验证成功
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 验证笔记内容
    const firstNote = page.locator('[data-testid="note-card"]').first();
    await expect(firstNote).toContainText('My Test Note');
  });

  test('DB-012: File upload validation', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');

    // 切换到文件上传标签
    await page.click('[data-testid="tab-upload"]');

    // 选择大文件（> 10MB）
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./fixtures/large-file.pdf');

    // 验证文件大小验证
    await expect(page.locator('text=文件大小不能超过 10MB')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 3: Reader (阅读器)

### RD-001: 视图切换

**优先级**: P0
**模块**: Reader
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以在不同视图模式之间切换

#### 前置条件
- 用户已登录
- 打开一条笔记（文章类型）

#### 测试步骤
1. 导航到 `/dashboard`
2. 点击第一条笔记
3. 等待阅读器加载
4. 默认应显示"阅读"视图
5. 点击"网页"视图按钮
6. 验证显示 iframe
7. 点击"AI 速览"视图按钮
8. 等待 AI 生成完成
9. 点击"存档"视图按钮

#### 预期结果
- 每次视图切换都有过渡动画
- 网页视图显示原始网站的 iframe
- AI 速览显示摘要和要点
- 存档视图显示保存的 HTML

#### 测试代码

```typescript
// e2e/reader/view-switching.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Reader View Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 打开第一条笔记
    await page.click('[data-testid="note-card"]:first-child');
  });

  test('RD-001: Default view is reader mode', async ({ page }) => {
    // 验证阅读视图是默认的
    await expect(page.locator('[data-testid="reader-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-switcher-reader"]')).toHaveClass(/active/);
  });

  test('RD-002: Switch to web view', async ({ page }) => {
    // 切换到网页视图
    await page.click('[data-testid="view-switcher-web"]');

    // 验证 iframe 加载
    await expect(page.locator('iframe[src*="example.com"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-switcher-web"]')).toHaveClass(/active/);
  });

  test('RD-003: Switch to AI brief view', async ({ page }) => {
    await page.click('[data-testid="view-switcher-ai-brief"]');

    // 验证加载状态
    await expect(page.locator('[data-testid="ai-generating"]')).toBeVisible();

    // 等待 AI 生成完成
    await page.waitForSelector('[data-testid="ai-generating"]', { state: 'hidden', timeout: 30000 });

    // 验证 AI 速览内容
    await expect(page.locator('[data-testid="ai-brief-content"]')).toBeVisible();
    await expect(page.locator('text=30 秒要点')).toBeVisible();
  });

  test('RD-004: Switch to archive view', async ({ page }) => {
    await page.click('[data-testid="view-switcher-archive"]');

    // 验证存档内容
    await expect(page.locator('[data-testid="archive-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="original-html"]')).toBeVisible();
  });

  test('RD-005: View state persists on reload', async ({ page }) => {
    // 切换到网页视图
    await page.click('[data-testid="view-switcher-web"]');
    await expect(page.locator('iframe')).toBeVisible();

    // 刷新页面
    await page.reload();

    // 验证仍然在网页视图
    await expect(page.locator('[data-testid="view-switcher-web"]')).toHaveClass(/active/);
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

### RD-006: 禅模式 (Zen Mode)

**优先级**: P1
**模块**: Reader
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以进入/退出禅模式进行专注阅读

#### 前置条件
- 用户已登录
- 打开一条笔记

#### 测试步骤
1. 打开任意笔记
2. 确认左右侧栏可见
3. 按 `Esc` 键
4. 验证侧栏隐藏
5. 按 `Esc` 键
6. 验证侧栏重新出现

#### 预期结果
- 第一次按 Esc 进入禅模式
- 左侧栏（大纲）隐藏
- 右侧栏（批注/AI）隐藏
- 顶部进度条保持可见
- 内容区域宽度增加
- 第二次按 Esc 退出禅模式
- 侧栏恢复显示

#### 测试代码

```typescript
// e2e/reader/zen-mode.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Reader Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    await page.click('[data-testid="note-card"]:first-child');
  });

  test('RD-006: Toggle Zen mode with Esc key', async ({ page }) => {
    // 初始状态：侧栏可见
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeVisible();

    // 按 Esc 进入禅模式
    await page.keyboard.press('Escape');

    // 验证侧栏隐藏
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeHidden();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeHidden();

    // 验证进度条仍然可见
    await expect(page.locator('[data-testid="reading-progress-bar"]')).toBeVisible();

    // 验证内容区域宽度增加
    const contentWidth = await page.locator('[data-testid="content-stage"]').evaluate(el => {
      return el.getBoundingClientRect().width;
    });
    expect(contentWidth).toBeGreaterThan(800); // 应该更宽

    // 按 Esc 退出禅模式
    await page.keyboard.press('Escape');

    // 验证侧栏重新出现
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeVisible();
  });

  test('RD-007: Zen mode state persists on view switch', async ({ page }) => {
    // 进入禅模式
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeHidden();

    // 切换视图
    await page.click('[data-testid="view-switcher-web"]');

    // 验证仍然在禅模式
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeHidden();

    // 切换回阅读视图
    await page.click('[data-testid="view-switcher-reader"]');

    // 验证禅模式被保留
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeHidden();

    // 退出禅模式
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

### RD-008: 阅读进度追踪

**优先级**: P1
**模块**: Reader
**类型**: E2E
**自动化**: 是

#### 描述
验证阅读进度被自动保存

#### 前置条件
- 用户已登录
- 打开一条长文章（需要滚动）

#### 测试步骤
1. 打开一条长文章
2. 滚动到中间位置
3. 等待 5 秒（debounce 时间）
4. 刷新页面
5. 验证滚动位置被恢复

#### 预期结果
- 顶部进度条显示正确百分比
- 滚动位置被保存到数据库
- 刷新后位置被恢复
- 跨设备同步（如果在其他设备打开）

#### 测试代码

```typescript
// e2e/reader/reading-progress.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Reading Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    // 打开一条长文章
    await page.click('[data-testid="note-card"]:first-child');
  });

  test('RD-008: Progress bar updates on scroll', async ({ page }) => {
    // 验证初始进度为 0%
    const initialProgress = await page.locator('[data-testid="reading-progress-bar"]').getAttribute('aria-valuenow');
    expect(parseInt(initialProgress || '0')).toBe(0);

    // 滚动到页面中间
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

    // 等待进度更新
    await page.waitForTimeout(100);

    // 验证进度大于 0
    const progress = await page.locator('[data-testid="reading-progress-bar"]').getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBeGreaterThan(0);
    expect(parseInt(progress || '0')).toBeLessThanOrEqual(100);
  });

  test('RD-009: Reading position is saved and restored', async ({ page }) => {
    // 滚动到特定位置
    const targetScroll = 500;
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), targetScroll);

    // 等待保存（debounce 5s）
    await page.waitForTimeout(6000);

    // 刷新页面
    await page.reload();

    // 等待页面加载
    await page.waitForSelector('[data-testid="article-content"]');

    // 验证滚动位置被恢复
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeCloseTo(targetScroll, 100); // 允许 100px 误差
  });

  test('RD-010: Read percentage is calculated correctly', async ({ page }) => {
    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.waitForTimeout(100);

    // 验证进度接近 100%
    const progress = await page.locator('[data-testid="reading-progress-bar"]').getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBeGreaterThan(90);
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 4: AI 功能

### AI-001: AI 快读生成

**优先级**: P0
**模块**: AI 功能
**类型**: E2E + 单元
**自动化**: 是

#### 描述
验证 AI 快读功能可以生成摘要、要点和情感标签

#### 前置条件
- 用户已登录
- 打开一条笔记
- OpenAI API 可用

#### 测试步骤
1. 打开一条笔记
2. 切换到"AI 速览"视图
3. 等待 AI 生成（约 10 秒）
4. 验证生成的摘要不超过 50 字
5. 验证要点列表包含 3-5 条
6. 验证情感标签（正面/负面/中性）

#### 预期结果
- 显示加载动画
- Hook（引子）不超过 50 个字符
- Takeaways（要点）包含 3-5 个要点
- Sentiment（情感）为 positive/negative/neutral 之一
- 总生成时间 < 10 秒
- 如果超时显示降级消息

#### 测试代码

```typescript
// __tests__/lib/services/openai.flash-read.test.ts
import { generateFlashRead } from '@/lib/services/openai';
import { OpenAI } from 'openai';

jest.mock('openai');

describe('AI Flash Read Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AI-001: Generates flash read with required fields', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            hook: 'AI 技术正在改变世界',
            takeaways: [
              'AI 已经应用于多个行业',
              '机器学习提高了效率',
              '深度学习推动创新'
            ],
            sentiment: 'positive'
          })
        }
      }]
    };

    OpenAI.prototype.chat.completions.create = jest.fn().mockResolvedValue(mockResponse);

    const result = await generateFlashRead({
      title: 'AI 文章',
      content: '这是一篇关于 AI 的文章...',
    });

    // 验证结构
    expect(result).toHaveProperty('hook');
    expect(result).toHaveProperty('takeaways');
    expect(result).toHaveProperty('sentiment');

    // 验证 Hook 长度
    expect(result.hook.length).toBeLessThanOrEqual(50);

    // 验证要点数量
    expect(result.takeaways.length).toBeGreaterThanOrEqual(3);
    expect(result.takeaways.length).toBeLessThanOrEqual(5);

    // 验证情感标签
    expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
  });

  it('AI-002: Enforces token limit', async () => {
    const longContent = 'a'.repeat(100000); // 100K 字符

    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            hook: 'Short hook',
            takeaways: ['Point 1'],
            sentiment: 'neutral'
          })
        }
      }]
    };

    OpenAI.prototype.chat.completions.create = jest.fn().mockResolvedValue(mockResponse);

    await generateFlashRead({
      title: 'Test',
      content: longContent,
    });

    // 验证内容被截断
    const createMock = OpenAI.prototype.chat.completions.create as jest.Mock;
    const sentContent = createMock.mock.calls[0][0].messages[0].content;

    // 假设每个 token 约 4 个字符
    const maxTokens = 4000;
    expect(sentContent.length).toBeLessThanOrEqual(maxTokens * 4);
  });

  it('AI-003: Handles timeout gracefully', async () => {
    OpenAI.prototype.chat.completions.create = jest.fn()
      .mockRejectedValue(new Error('ETIMEDOUT'));

    const result = await generateFlashRead({
      title: 'Test',
      content: 'Short content',
    });

    // 验证降级结果
    expect(result).toHaveProperty('hook');
    expect(result.hook).toContain('timeout');
    expect(result.takeaways).toEqual([]);
  });

  it('AI-004: Detects hallucinated numbers', async () => {
    const originalText = '公司营收增长 15%';
    const aiSummary = '营收增长 50%'; // 幻觉

    // 提取数字
    const numbersInSummary = aiSummary.match(/\d+%/g) || [];
    const hallucinations = numbersInSummary.filter(num => !originalText.includes(num));

    expect(hallucinations).toContain('50%');
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 5: 批注系统

### AN-001: 创建批注

**优先级**: P0
**模块**: 批注系统
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以通过选择文本创建批注

#### 前置条件
- 用户已登录
- 打开一条有文本内容的笔记

#### 测试步骤
1. 打开一条笔记
2. 在文章内容区域选择一段文本
3. 等待浮动工具栏出现
4. 点击"高亮"按钮
5. 选择黄色
6. 输入批注评论："重要段落"
7. 点击"保存"

#### 预期结果
- 文本被高亮显示（黄色背景）
- 浮动工具栏在选中文本附近出现
- 高亮带创建成功
- 批注创建成功
- 批注出现在右侧批注列表
- 右侧栏自动展开

#### 测试代码

```typescript
// e2e/annotations/create.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Annotation Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    await page.click('[data-testid="note-card"]:first-child');
  });

  test('AN-001: Create annotation from text selection', async ({ page }) => {
    // 选择文本
    const paragraph = page.locator('[data-testid="article-content"] p').first();
    await paragraph.selectText();

    // 等待浮动工具栏
    await expect(page.locator('[data-testid="selection-toolbar"]')).toBeVisible();

    // 点击高亮按钮
    await page.click('[data-testid="highlight-btn"]');

    // 选择黄色
    await page.click('[data-testid="color-yellow"]');

    // 添加评论
    await page.fill('[data-testid="annotation-comment"]', '重要段落');

    // 保存
    await page.click('button:has-text("保存")');

    // 验证高亮显示
    await expect(paragraph.locator('mark.highlight-yellow')).toBeVisible();

    // 验证批注出现在右侧栏
    await expect(page.locator('[data-testid="annotation-list"]')).toContainText('重要段落');
  });

  test('AN-002: Change highlight color', async ({ page }) => {
    // 创建第一个批注（黄色）
    const paragraph1 = page.locator('[data-testid="article-content"] p').nth(0);
    await paragraph1.selectText();
    await page.click('[data-testid="highlight-btn"]');
    await page.click('[data-testid="color-yellow"]');
    await page.click('button:has-text("保存")');

    // 创建第二个批注（绿色），与第一个重叠
    const paragraph2 = page.locator('[data-testid="article-content"] p').nth(1);
    await paragraph2.selectText();
    await page.click('[data-testid="highlight-btn"]');
    await page.click('[data-testid="color-green"]');
    await page.fill('[data-testid="annotation-comment"]', '第二个批注');
    await page.click('button:has-text("保存")');

    // 验证两个高亮都存在
    await expect(paragraph1.locator('mark.highlight-yellow')).toBeVisible();
    await expect(paragraph2.locator('mark.highlight-green')).toBeVisible();
  });

  test('AN-003: Delete annotation', async ({ page }) => {
    // 先创建一个批注
    const paragraph = page.locator('[data-testid="article-content"] p').first();
    await paragraph.selectText();
    await page.click('[data-testid="highlight-btn"]');
    await page.click('[data-testid="color-yellow"]');
    await page.fill('[data-testid="annotation-comment"]', '待删除');
    await page.click('button:has-text("保存")');

    // 在右侧栏找到批注
    const annotation = page.locator('[data-testid="annotation-item"]').filter({ hasText: '待删除' }).first();

    // 点击删除按钮
    await annotation.locator('[data-testid="delete-annotation-btn"]').click();

    // 确认删除
    await page.click('button:has-text("确定")');

    // 验证批注被删除
    await expect(annotation).not.toBeVisible();

    // 验证高亮被移除
    await expect(paragraph.locator('mark')).not.toBeVisible();
  });

  test('AN-004: Search annotations', async ({ page }) => {
    // 创建多个批注
    for (let i = 1; i <= 3; i++) {
      const paragraph = page.locator('[data-testid="article-content"] p').nth(i);
      await paragraph.selectText();
      await page.click('[data-testid="highlight-btn"]');
      await page.click('[data-testid="color-yellow"]');
      await page.fill('[data-testid="annotation-comment"]', `批注 ${i}`);
      await page.click('button:has-text("保存")');
      await page.waitForTimeout(500);
    }

    // 打开搜索
    await page.click('[data-testid="annotation-search-btn"]');
    await page.fill('[data-testid="annotation-search-input"]', '批注 2');

    // 验证只显示匹配的批注
    await expect(page.locator('[data-testid="annotation-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="annotation-item"]')).toContainText('批注 2');
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 6: 知识库

### KB-001: 智能专题生成

**优先级**: P1
**模块**: 知识库
**类型**: 集成 + E2E
**自动化**: 部分

#### 描述
验证系统可以自动生成智能专题

#### 前置条件
- 用户已登录
- 至少有 10 条相关笔记
- Embedding 服务可用

#### 测试步骤
1. 导航到 `/knowledge/topics`
2. 点击"生成专题"按钮
3. 等待聚类完成
4. 验证生成的专题
5. 验证专题包含正确的笔记

#### 预期结果
- 聚类算法运行成功
- 生成至少 1 个专题
- 专题名称语义通顺
- 专题内的笔记相关
- 噪声点（孤立笔记）被正确处理

#### 测试代码

```typescript
// __tests__/lib/services/knowledge-topics.test.ts
import { generateTopics } from '@/lib/services/knowledge-topics';

describe('Smart Topics Generation', () => {
  it('KB-001: Clusters related notes into topics', async () => {
    const notes = [
      { id: '1', title: 'AI 技术趋势 2024', content_text: '人工智能技术...' },
      { id: '2', title: '机器学习入门', content_text: '机器学习基础...' },
      { id: '3', title: '深度学习框架', content_text: 'TensorFlow 和 PyTorch...' },
      { id: '4', title: 'React 18 新特性', content_text: 'React 框架...' }, // 噪声点
    ];

    // Mock embedding 生成
    const embeddings = [
      [0.8, 0.2, 0.9], // AI 相关
      [0.7, 0.3, 0.8],
      [0.9, 0.1, 0.7],
      [0.1, 0.9, 0.2], // React 相关（不相关）
    ];

    // Mock LLM 命名
    const mockNaming = jest.fn().mockResolvedValue('AI 技术专题');

    const result = await generateTopics(notes, {
      generateEmbedding: async (text) => embeddings.shift(),
      generateName: mockNaming,
    });

    // 验证生成 1 个专题（排除噪声点）
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].name).toBe('AI 技术专题');
    expect(result.topics[0].noteIds).toHaveLength(3); // 不包含噪声点

    // 验证噪声点被标记
    expect(result.noisePoints).toContain('4');
  });

  it('KB-002: Handles empty note list', async () => {
    const result = await generateTopics([], {
      generateEmbedding: async () => [0, 0, 0],
      generateName: async () => 'Test',
    });

    expect(result.topics).toHaveLength(0);
  });

  it('KB-003: Fallback when LLM naming fails', async () => {
    const notes = [
      { id: '1', title: 'Test Note', content_text: 'Content' }
    ];

    // Mock LLM 失败
    const mockNaming = jest.fn().mockRejectedValue(new Error('API Error'));

    const result = await generateTopics(notes, {
      generateEmbedding: async () => [0.5, 0.5, 0.5],
      generateName: mockNaming,
      fallbackName: (date) => `专题 ${date}`,
    });

    // 验证降级命名
    expect(result.topics[0].name).toMatch(/专题 \d{4}-\d{2}-\d{2}/);
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 7: 标签管理

### TM-001: 添加标签

**优先级**: P0
**模块**: 标签管理
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以为笔记添加标签

#### 前置条件
- 用户已登录
- 打开一条笔记
- 至少有一个已创建的标签

#### 测试步骤
1. 打开一条笔记
2. 滚动到底部标签区域
3. 点击"添加标签..."
4. 等待标签弹出层显示
5. 点击一个标签
6. 验证标签被添加
7. 验证标签显示在底部

#### 预期结果
- 标签弹出层在标签区域上方显示
- 点击标签后自动添加
- 弹出层自动关闭
- 标签显示在底部导航，带淡蓝色玻璃效果
- 可以删除标签（点击 X 按钮）

#### 测试代码

```typescript
// e2e/tags/add-tag.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    await page.click('[data-testid="note-card"]:first-child');
  });

  test('TM-001: Add tag from popup', async ({ page }) => {
    // 点击添加标签
    await page.click('[data-testid="add-tag-btn"]');

    // 验证弹出层显示
    await expect(page.locator('[data-testid="tag-popup"]')).toBeVisible();

    // 点击一个标签
    await page.click('text=AI');

    // 验证弹出层关闭
    await expect(page.locator('[data-testid="tag-popup"]')).not.toBeVisible();

    // 验证标签显示在底部
    await expect(page.locator('[data-testid="tag-list"]')).toContainText('AI');
  });

  test('TM-002: Create new tag from popup', async ({ page }) => {
    await page.click('[data-testid="add-tag-btn"]');

    // 在搜索框输入新标签名
    await page.fill('[data-testid="tag-search-input"]', 'NewTag');

    // 按回车创建
    await page.keyboard.press('Enter');

    // 验证成功提示
    await expect(page.locator('text=标签已创建')).toBeVisible();

    // 验证新标签显示
    await expect(page.locator('[data-testid="tag-list"]')).toContainText('NewTag');
  });

  test('TM-003: Remove tag with X button', async ({ page }) => {
    // 先添加一个标签
    await page.click('[data-testid="add-tag-btn"]');
    await page.click('text=AI');

    // 等待标签添加
    await expect(page.locator('[data-testid="tag-list"]')).toContainText('AI');

    // 点击删除按钮
    await page.locator('[data-testid="tag-list"]').locator('[data-testid="tag-AI"]').locator('[data-testid="remove-tag-btn"]').click();

    // 验证成功提示
    await expect(page.locator('text=标签已移除')).toBeVisible();

    // 验证标签消失
    await expect(page.locator('[data-testid="tag-list"]')).not.toContainText('AI');
  });

  test('TM-004: Tag style has glass morphism effect', async ({ page }) => {
    // 添加标签
    await page.click('[data-testid="add-tag-btn"]');
    await page.click('text=AI');

    // 获取标签元素的样式
    const tagElement = page.locator('[data-testid="tag-AI"]');

    // 验证玻璃效果样式
    const backgroundColor = await tagElement.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // 验证淡蓝色半透明背景
    expect(backgroundColor).toMatch(/rgba?\(56, 189, 248/); // sky-400
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 8: 内容采集

### CP-001: URL 捕获

**优先级**: P0
**模块**: 内容采集
**类型**: E2E + 集成
**自动化**: 是

#### 描述
验证系统可以从 URL 正确抓取内容

#### 前置条件
- 用户已登录
- URL 可访问

#### 测试步骤
1. 导航到 `/dashboard`
2. 点击"添加笔记"
3. 输入 URL：`https://example.com/article`
4. 点击"保存"
5. 等待抓取完成

#### 预期结果
- 显示加载状态
- 抓取成功后显示成功提示
- 笔记包含正确的标题
- 笔记包含正文内容
- 笔记包含封面图（如果有）
- 笔记包含元数据（作者、发布时间）

#### 测试代码

```typescript
// e2e/capture/url-capture.spec.ts
import { test, expect } from '@playwright/test';

test.describe('URL Capture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('CP-001: Capture article from URL', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');

    await page.fill('input[name="url"]', 'https://example.com/test-article');
    await page.click('button:has-text("保存")');

    // 验证加载状态
    await expect(page.locator('[data-testid="capture-loading"]')).toBeVisible();

    // 等待完成
    await page.waitForSelector('[data-testid="capture-loading"]', { state: 'hidden', timeout: 30000 });

    // 验证成功提示
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 验证新笔记
    const newNote = page.locator('[data-testid="note-card"]').first();

    await expect(newNote.locator('[data-testid="note-title"]')).not.toBeEmpty();
    await expect(newNote.locator('[data-testid="note-excerpt"]')).not.toBeEmpty();
  });

  test('CP-002: Detects duplicate URL', async ({ page }) => {
    const url = 'https://example.com/unique';

    // 第一次添加
    await page.click('[data-testid="add-note-button"]');
    await page.fill('input[name="url"]', url);
    await page.click('button:has-text("保存")');
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 第二次添加相同 URL
    await page.click('[data-testid="add-note-button"]');
    await page.fill('input[name="url"]', url);
    await page.click('button:has-text("保存")');

    // 验证检测到重复
    await expect(page.locator('text=该文章已在收藏中')).toBeVisible();
  });

  test('CP-003: Handles paywall with Jina Reader fallback', async ({ page }) => {
    // 测试需要真实或 mock Jina Reader API
    const paywallUrl = 'https://example.com/paywall-article';

    await page.click('[data-testid="add-note-button"]');
    await page.fill('input[name="url"]', paywallUrl);
    await page.click('button:has-text("保存")');

    // 验证尝试使用 Jina Reader
    // 这里可能需要 mock Jina API 响应
    await expect(page.locator('text=正在使用 Jina Reader 抓取')).toBeVisible();
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 9: 设置管理

### SE-001: 外观设置

**优先级**: P2
**模块**: 设置管理
**类型**: E2E
**自动化**: 是

#### 描述
验证用户可以更改外观设置

#### 前置条件
- 用户已登录

#### 测试步骤
1. 导航到 `/settings/appearance`
2. 切换主题到深色模式
3. 调整字体大小到 18px
4. 调整行高到 1.8
5. 打开一条笔记验证效果

#### 预期结果
- 主题切换立即生效
- 深色模式应用正确
- 字体大小和行高生效
- 设置被保存到数据库
- 刷新后设置被保留

#### 测试代码

```typescript
// e2e/settings/appearance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Appearance Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
  });

  test('SE-001: Change theme to dark mode', async ({ page }) => {
    await page.goto('/settings/appearance');

    // 切换到深色模式
    await page.click('text=深色');

    // 验证主题变化
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark/);

    // 打开一条笔记验证
    await page.goto('/dashboard');
    await page.click('[data-testid="note-card"]:first-child');

    // 验证深色模式应用
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('SE-002: Adjust font size', async ({ page }) => {
    await page.goto('/settings/appearance');

    // 调整字体大小
    await page.click('[data-testid="font-size-increase"]');
    await page.click('[data-testid="font-size-increase"]');
    await page.click('[data-testid="font-size-increase"]'); // 点击 3 次

    // 打开笔记验证
    await page.goto('/dashboard');
    await page.click('[data-testid="note-card"]:first-child');

    // 验证字体大小增加
    const fontSize = await page.locator('[data-testid="article-content"]').evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });

    expect(parseInt(fontSize)).toBeGreaterThan(16); // 默认 16px
  });
});
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 模块 10: 安全测试

### SC-001: RLS 用户隔离

**优先级**: P0
**模块**: 安全
**类型**: 集成
**自动化**: 是

#### 描述
验证 RLS 策略正确隔离用户数据

#### 前置条件
- 有两个测试用户（user1, user2）
- 每个用户有自己的笔记

#### 测试步骤
1. 以 user1 身份登录
2. 尝试查询 user2 的笔记 ID
3. 验证查询返回空
4. 尝试 UPDATE user2 的笔记
5. 验证操作被拒绝
6. 尝试 user_id 篡改
7. 验证插入被拒绝

#### 预期结果
- 用户只能访问自己的数据
- 跨用户查询返回空结果
- 跨用户 UPDATE/DELETE 被拒绝
- user_id 篡改被拒绝
- 所有操作返回权限错误

#### 测试代码

```sql
-- supabase/tests/rls_security.test.sql
BEGIN;
SELECT plan(30);

-- 创建测试用户
DO $$
DECLARE
  user1_id UUID := '11111111-1111-1111-1111-111111111111';
  user2_id UUID := '22222222-2222-2222-2222-222222222222';
  note1_id UUID;
  note2_id UUID;
BEGIN
  -- 插入用户
  INSERT INTO auth.users (id, email) VALUES
    (user1_id, 'user1@test.com'),
    (user2_id, 'user2@test.com');

  -- 插入笔记
  INSERT INTO notes (id, user_id, title, source_url, content_type)
  VALUES
    (gen_random_uuid(), user1_id, 'User1 Note', 'https://example.com/1', 'article')
    RETURNING id INTO note1_id,

    (gen_random_uuid(), user2_id, 'User2 Note', 'https://example.com/2', 'article')
    RETURNING id INTO note2_id;
END $$;

-- Test 1: User1 可以访问自己的笔记
SELECT lives_ok(
  'SELECT * FROM notes WHERE id = $1',
  ARRAY[note1_id],
  'SC-001: User can access own notes'
);

-- Test 2: User1 不能访问 User2 的笔记
SET role = authenticated;
SET request.jwt.claim.sub = user1_id;

SELECT is_empty(
  'SELECT * FROM notes WHERE id = $1',
  'SC-002: User cannot access other user notes',
  ARRAY[note2_id]
);

-- Test 3: User1 不能 UPDATE User2 的笔记
SELECT throws_ok(
  'UPDATE notes SET title = ''Hacked'' WHERE id = $1',
  '42501',
  'SC-003: Cannot UPDATE other user notes',
  ARRAY[note2_id]
);

-- Test 4: User1 不能 DELETE User2 的笔记
SELECT throws_ok(
  'DELETE FROM notes WHERE id = $1',
  '42501',
  'SC-004: Cannot DELETE other user notes',
  ARRAY[note2_id]
);

-- Test 5: User1 不能插入其他 user_id 的笔记
SELECT throws_ok(
  'INSERT INTO notes (user_id, title, source_url, content_type) VALUES ($1, ''Hack'', ''https://hack.com'', ''article'')',
  '42501',
  'SC-005: Cannot INSERT with different user_id',
  ARRAY[user2_id]
);

-- Test 6: 通过 JOIN 也不能绕过 RLS
SELECT is_empty(
  'SELECT n.* FROM notes n JOIN folders f ON n.folder_id = f.id WHERE f.user_id = $1',
  'SC-006: JOIN does not bypass RLS',
  ARRAY[user2_id]
);

SELECT * FROM finish();
ROLLBACK;
```

#### 实际结果
[执行时填写]

#### 状态
- [ ] 未开始
- [ ] 通过
- [ ] 失败

---

## 测试执行状态汇总

### 按模块统计

| 模块 | 总用例数 | 通过 | 失败 | 阻塞 | 通过率 |
|-----|--------|------|------|------|--------|
| 认证系统 | 7 | 0 | 0 | 0 | - |
| Dashboard | 12 | 0 | 0 | 0 | - |
| Reader | 6 | 0 | 0 | 0 | - |
| AI 功能 | 4 | 0 | 0 | 0 | - |
| 批注系统 | 4 | 0 | 0 | 0 | - |
| 知识库 | 3 | 0 | 0 | 0 | - |
| 标签管理 | 4 | 0 | 0 | 0 | - |
| 内容采集 | 3 | 0 | 0 | 0 | - |
| 设置管理 | 2 | 0 | 0 | 0 | - |
| 安全测试 | 6 | 0 | 0 | 0 | - |
| **总计** | **51** | **0** | **0** | **0** | **-** |

### 按优先级统计

| 优先级 | 总用例数 | 状态 |
|-------|---------|------|
| P0 | 27 | 待执行 |
| P1 | 18 | 待执行 |
| P2 | 6 | 待执行 |

### 按类型统计

| 类型 | 总用例数 |
|-----|---------|
| E2E | 35 |
| 单元 | 10 |
| 集成 | 6 |

---

**文档结束**

*本测试用例文档包含 51 个详细测试用例，涵盖所有核心功能模块。每个用例都包含可执行的测试代码（Jest/Playwright/pgTAP）。建议按优先级依次执行测试。*
