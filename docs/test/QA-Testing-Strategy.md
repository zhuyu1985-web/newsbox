# NewsBox AI 稍后阅读助手 - 测试策略与计划书

**文档版本**: v1.0
**编制日期**: 2026-01-05
**编制人员**: Lead QA Engineer
**项目**: NewsBox AI 稍后阅读助手

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [测试理念](#2-测试理念)
3. [测试覆盖策略](#3-测试覆盖策略)
4. [测试工具链](#4-测试工具链)
5. [测试数据策略](#5-测试数据策略)
6. [CI/CD 集成](#6-cicd-集成)
7. [风险缓解](#7-风险缓解)

---

## 1. 执行摘要

### 1.1 项目概述

NewsBox AI 稍后阅读助手是一款面向新闻记者、深度阅读者和知识工作者的全栈应用，提供从内容采集、清洗、整理到知识内化的全链路 AI 辅助功能。

**核心技术栈**:
- **前端**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **后端**: Supabase (PostgreSQL + pgvector + Edge Functions)
- **AI**: OpenAI/DeepSeek API, 腾讯云 ASR
- **部署**: Vercel + Supabase Cloud

**核心功能模块**:
1. **Dashboard (工作台)**: 笔记管理、无限滚动、批量操作
2. **Reader (阅读器)**: 多视图切换、禅模式、阅读进度
3. **AI Features (AI功能)**: 快读、深度分析、RAG对话、快照
4. **Annotations (批注系统)**: 文本高亮、评论、搜索
5. **Knowledge Base (知识库)**: 智能专题、知识图谱、全库搜索
6. **Capture (内容采集)**: URL抓取、文件上传、多媒体处理

### 1.2 测试目标

本测试策略旨在确保：

| 质量维度 | 目标 | 验证方式 |
|---------|------|---------|
| **功能性** | 所有功能按规格正常工作 | 单元测试 + E2E测试 |
| **安全性** | 用户数据完全隔离，无泄露风险 | RLS测试 + 渗透测试 |
| **性能** | P95响应时间 < 500ms | 性能测试 + 监控 |
| **可靠性** | AI功能有降级机制，不阻塞主流程 | 故障注入测试 |
| **可维护性** | 测试覆盖率 ≥ 70% | 覆盖率报告 |
| **合规性** | 符合 GDPR 和数据保护法规 | 安全审计 |

### 1.3 测试范围

**包含**:
- ✅ 所有用户可见功能
- ✅ 所有 API 路由
- ✅ 所有数据库操作
- ✅ RLS 策略
- ✅ AI 功能和质量
- ✅ 性能和可访问性

**不包含**:
- ❌ Supabase 平台本身的功能
- ❌ 第三方 API 的内部逻辑（假设其可靠）
- ❌ 浏览器兼容性 < Chrome 120, Firefox 120, Safari 17

### 1.4 测试资源

| 资源类型 | 分配 | 备注 |
|---------|------|------|
| **测试工程师** | 1 人（Lead QA） | 兼任开发和测试 |
| **开发工程师** | 2 人 | 协助编写单元测试 |
| **测试环境** | 3 套 | Dev, Staging, Local |
| **测试时间** | 10 周 | 从环境搭建到文档交付 |
| **测试工具** | 见第4节 | 开源工具为主 |

### 1.5 风险与限制

**主要风险**:
1. ⚠️ **AI 输出不确定性**: AI 功能测试需要特殊策略（见 2.2 节）
2. ⚠️ **测试环境复杂**: Supabase 本地环境配置可能遇到问题
3. ⚠️ **时间紧张**: 10 周完成所有测试有挑战，需要优先级管理
4. ⚠️ **测试数据准备**: 需要大量真实场景的测试数据

**缓解措施**:
- ✅ 采用测试金字塔策略（见 2.1 节）
- ✅ 优先测试 P0 和 P1 级别的功能
- ✅ 使用自动化工具生成测试数据
- ✅ 在 Staging 环境进行部分集成测试

---

## 2. 测试理念

### 2.1 测试金字塔

本项目采用经典的测试金字塔策略，根据成本、速度和可靠性分配测试资源：

```
                  /\
                 /E2E\         10% (少量关键路径)
                /------\
               /        \
              /Integration\   20% (API + Database)
             /------------\
            /              \
           /   Unit Tests    \ 70% (大量快速测试)
          /--------------------\
```

**比例分配**:
- **70% 单元测试**: 快速（毫秒级）、可靠、易维护
- **20% 集成测试**: 中速（秒级）、覆盖关键集成点
- **10% E2E 测试**: 慢速（分钟级）、但保证端到端流程

**实施原则**:
1. **能写单元测试就不写集成测试**
2. **能写集成测试就不写 E2E 测试**
3. **E2E 测试只覆盖关键用户旅程**

### 2.2 AI 不确定性处理

AI 功能（如 GPT 生成的内容）具有非确定性特征，传统断言方法不适用。

**三层评估体系**:

#### Layer 1: 自动化回归测试（稳定性）

```typescript
// 使用固定 seed 的 LLM 调用（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  config.seed = 42; // 确保 AI 输出可重现
}

// 基于"黄金数据集"的验证
const goldenDataset = [
  { input: 'Test article', expectedOutput: { hook: 'Must be < 50 chars' } }
];

for (const testCase of goldenDataset) {
  const result = await generateFlashRead(testCase.input);
  expect(result.hook.length).toBeLessThanOrEqual(50);
}
```

#### Layer 2: 语义等价性测试（质量）

```typescript
// 使用 GPT-4 作为"裁判模型"
async function evaluateAIQuality(original: string, summary: string) {
  const evaluation = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: `评估以下摘要的质量（1-5分）：
      - 准确性：是否准确反映原文
      - 完整性：是否遗漏关键信息
      - 简洁性：是否简洁明了

      输出格式：JSON { accuracy: number, completeness: number, conciseness: number }
      `
    }, {
      role: 'user',
      content: `原文：${original}\n\n摘要：${summary}`
    }]
  });

  const scores = JSON.parse(evaluation.choices[0].message.content);
  const avgScore = (scores.accuracy + scores.completeness + scores.conciseness) / 3;

  if (avgScore < 3.5) {
    throw new Error(`AI quality below threshold: ${avgScore}`);
  }
}
```

#### Layer 3: 幻觉检测（安全）

```typescript
// 实体验证：提取的实体必须在原文中出现
async function detectHallucinations(aiSummary: string, originalText: string) {
  const issues: string[] = [];

  // 1. 数值验证
  const numbersInSummary = aiSummary.match(/\d+%?\|\d+[万元亿]/g) || [];
  for (const num of numbersInSummary) {
    if (!originalText.includes(num)) {
      issues.push(`数值 "${num}" 在原文中未找到`);
    }
  }

  // 2. 实体验证（使用 NER）
  const entitiesInSummary = await extractEntities(aiSummary);
  const entitiesInOriginal = await extractEntities(originalText);

  for (const entity of entitiesInSummary) {
    if (!entitiesInOriginal.includes(entity)) {
      issues.push(`实体 "${entity}" 在原文中未找到`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    hallucinationRate: issues.length / (numbersInSummary.length + entitiesInSummary.length)
  };
}
```

### 2.3 Shift-left 方法

**理念**: 尽早发现缺陷，降低修复成本。

**实施策略**:
1. **开发阶段**: 开发者同步编写单元测试
2. **代码审查**: 测试代码是 PR 必查项
3. **Pre-commit**: Husky 钩子运行快速测试
4. **Pre-merge**: CI 运行完整测试套件
5. **Pre-deploy**: Staging 环境验证

```bash
# .husky/pre-commit
#!/bin/bash
npm run test:unit -- --changedSince=master --bail
```

### 2.4 测试优先级

**P0 - 关键路径** (必须测试，阻塞发布):
- 认证和授权
- RLS 策略
- 数据持久化
- AI 幻觉检测
- 支付相关（如有）

**P1 - 高风险** (应该测试，影响用户体验):
- 无限滚动
- 批量操作
- AI 分析生成
- 文件上传
- 批注系统

**P2 - 功能增强** (可以测试，时间允许):
- 设置管理
- UI 动画
- 辅助功能

**P3 - 低优先级** (暂不测试):
- 错误页面
- 加载动画

---

## 3. 测试覆盖策略

### 3.1 单元测试 (Jest + React Testing Library)

**目标**: 验证单个函数、组件、类的行为正确性。

**覆盖范围**:

#### 3.1.1 工具函数 (`lib/utils.ts`)

```typescript
// 示例：cn() 函数测试
describe('cn utility function', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('foo', null, 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });
});
```

**测试原则**:
- ✅ 覆盖所有分支逻辑
- ✅ 测试边界值（null, undefined, 空数组）
- ✅ 测试错误处理

#### 3.1.2 服务层 (`lib/services/`)

**AI 服务测试重点**:

```typescript
// lib/services/openai.test.ts
describe('OpenAI Service', () => {
  describe('generateFlashRead', () => {
    it('enforces token limit', async () => {
      const mockContent = 'a'.repeat(100000); // 100K chars
      const MAX_TOKENS = 4000;

      const result = await generateFlashRead({
        title: 'Test',
        content: mockContent
      });

      // 验证内容被截断
      const createMock = OpenAI.prototype.chat.completions.create as jest.Mock;
      const sentContent = createMock.mock.calls[0][0].messages[0].content;
      expect(sentContent.length).toBeLessThanOrEqual(MAX_TOKENS * 4);
    });

    it('handles API timeout gracefully', async () => {
      OpenAI.prototype.chat.completions.create = jest.fn()
        .mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await generateFlashRead({ title: 'Test', content: 'Short' });

      // 应返回降级结果
      expect(result).toHaveProperty('hook');
      expect(result.hook).toContain('timeout');
    });
  });

  describe('hallucination detection', () => {
    it('detects fabricated numbers', () => {
      const original = 'Revenue increased by 15%';
      const summary = 'Revenue increased by 50%'; // 幻觉

      const detection = detectHallucinations(summary, original);

      expect(detection.passed).toBe(false);
      expect(detection.issues).toContain('数值 "50%" 在原文中未找到');
    });
  });
});
```

**测试策略**:
- ✅ Mock 所有外部 API 调用
- ✅ 测试成功和失败场景
- ✅ 验证降级机制

#### 3.1.3 组件逻辑 (`components/`)

```typescript
// components/dashboard/dashboard-content.test.tsx
describe('DashboardContent', () => {
  it('loads more notes on scroll', async () => {
    const mockNotes = Array.from({ length: 20 }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i}`
    }));

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({
                data: mockNotes.slice(0, 10),
                error: null
              }))
            }))
          }))
        }))
      }))
    };

    render(<DashboardContent supabase={mockSupabase} />);

    // 初始 10 条
    expect(screen.getAllByTestId('note-card')).toHaveLength(10);

    // 滚动到底部
    const sentinel = screen.getByTestId('infinite-scroll-sentinel');
    fireEvent.scroll(sentinel, { target: { scrollY: 10000 } });

    // 等待加载更多
    await waitFor(() => {
      expect(screen.getAllByTestId('note-card')).toHaveLength(20);
    });
  });
});
```

**测试原则**:
- ✅ 测试用户行为，而非实现细节
- ✅ 使用 `@testing-library/user-event` 模拟真实操作
- ✅ 避免 `querySelector`，优先使用语义化查询

### 3.2 集成测试 (pgTAP + Supabase CLI)

**目标**: 验证数据库层面的正确性和安全性。

#### 3.2.1 RLS 策略测试

**测试矩阵**:

| 表名 | 操作 | 预期行为 | 测试用例 |
|-----|------|---------|---------|
| `notes` | SELECT | 只能访问自己的笔记 | `test-rls-notes-select` |
| `notes` | INSERT | 不能设置其他 user_id | `test-rls-notes-insert` |
| `notes` | UPDATE | 只能更新自己的笔记 | `test-rls-notes-update` |
| `notes` | DELETE | 只能删除自己的笔记 | `test-rls-notes-delete` |
| `folders` | SELECT | 只能访问自己的收藏夹 | `test-rls-folders-select` |
| `tags` | SELECT | 只能访问自己的标签 | `test-rls-tags-select` |
| `annotations` | SELECT | 只能访问自己的批注 | `test-rls-annotations-select` |

**测试示例**:

```sql
-- supabase/tests/rls_notes.test.sql
BEGIN;
SELECT plan(20);

-- Setup: 创建测试用户
CREATE TEMP TABLE test_users (
  id UUID,
  email TEXT
);

INSERT INTO test_users VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com');

-- 插入测试数据
INSERT INTO auth.users (id, email)
SELECT id, email FROM test_users;

INSERT INTO notes (user_id, title, source_url, content_type)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'User1 Note', 'https://example.com/1', 'article'),
  ('22222222-2222-2222-2222-222222222222', 'User2 Note', 'https://example.com/2', 'article');

-- Test 1: User1 可以访问自己的笔记
SELECT lives_ok(
  'SELECT * FROM notes WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
  'User can access own notes'
);

-- Test 2: User1 不能访问 User2 的笔记
SELECT is_empty(
  'SELECT * FROM notes WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
  'User cannot access other user notes'
);

-- Test 3: User1 不能插入其他 user_id 的笔记
SELECT throws_ok(
  'INSERT INTO notes (user_id, title, source_url, content_type) VALUES (''22222222-2222-2222-2222-222222222222'', ''Hack'', ''https://hack.com'', ''article'')',
  '42501', -- insufficient_privilege
  'Cannot INSERT with different user_id'
);

-- Test 4: User1 不能通过 JOIN 绕过 RLS
SELECT is_empty(
  'SELECT n.* FROM notes n JOIN folders f ON n.folder_id = f.id WHERE f.user_id = ''22222222-2222-2222-2222-222222222222''',
  'JOIN does not bypass RLS'
);

SELECT * FROM finish();
ROLLBACK;
```

**执行方式**:

```bash
# 运行所有 RLS 测试
supabase test db

# 运行单个测试文件
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/rls_notes.test.sql
```

#### 3.2.2 数据库约束测试

```sql
-- 测试唯一约束
SELECT throws_ok(
  'INSERT INTO notes (user_id, source_url, content_type) VALUES (''user-id'', ''https://example.com'', ''article''), (''user-id'', ''https://example.com'', ''article'')',
  '23505', -- unique_violation
  'Duplicate URL rejected'
);

-- 测试 CHECK 约束
SELECT throws_ok(
  'INSERT INTO notes (content_type) VALUES (''invalid_type'')',
  '23514', -- check_violation
  'Invalid content_type rejected'
);
```

### 3.3 E2E 测试 (Playwright)

**目标**: 验证关键用户旅程端到端正常工作。

**测试覆盖**:

#### 3.3.1 认证流程

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // 填写表单
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 验证跳转到 Dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('我的收藏');
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    // 验证错误消息
    await expect(page.locator('text=邮箱或密码错误')).toBeVisible();
  });

  test('user can logout', async ({ page }) => {
    // 先登录
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 点击登出
    await page.click('[data-testid="user-menu"]');
    await page.click('text=登出');

    // 验证跳转到登录页
    await expect(page).toHaveURL('/auth/login');
  });
});
```

#### 3.3.2 添加笔记流程

```typescript
// e2e/capture.spec.ts
test.describe('Add Note Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('add note via URL', async ({ page }) => {
    // 点击添加按钮
    await page.click('[data-testid="add-note-button"]');

    // 选择 URL 标签
    await page.click('text=URL');

    // 输入 URL
    await page.fill('input[placeholder*="https://"]', 'https://example.com/article');

    // 点击保存
    await page.click('button:has-text("保存")');

    // 验证成功提示
    await expect(page.locator('text=添加成功')).toBeVisible();

    // 验证新笔记出现在列表
    await expect(page.locator('text=example.com')).toBeVisible();
  });

  test('add note via manual text', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');
    await page.click('text=手动输入');

    // 填写标题和内容
    await page.fill('input[name="title"]', 'Test Note');
    await page.fill('textarea[name="content"]', 'This is a test note');

    // 保存
    await page.click('button:has-text("保存")');

    // 验证
    await expect(page.locator('text=Test Note')).toBeVisible();
  });

  test('file upload validation', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');
    await page.click('text=文件上传');

    // 上传大文件（> 10MB）
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./fixtures/large-file.pdf');

    // 验证错误提示
    await expect(page.locator('text=文件大小不能超过 10MB')).toBeVisible();
  });
});
```

#### 3.3.3 阅读器体验

```typescript
// e2e/reader.spec.ts
test.describe('Reader Experience', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并打开一条笔记
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.click('[data-testid="note-card"]:first-child');
  });

  test('view switching works', async ({ page }) => {
    // 默认显示阅读视图
    await expect(page.locator('[data-testid="reader-view"]')).toBeVisible();

    // 切换到原始网页
    await page.click('[data-testid="view-switcher-web"]');
    await expect(page.locator('iframe')).toBeVisible();

    // 切换到 AI 速览
    await page.click('[data-testid="view-switcher-ai-brief"]');
    await expect(page.locator('text=AI 速览')).toBeVisible();
  });

  test('zen mode toggles with Esc key', async ({ page }) => {
    // 初始状态：侧栏可见
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeVisible();

    // 按 Esc 进入禅模式
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeHidden();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeHidden();

    // 再次按 Esc 退出
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-sidebar"]')).toBeVisible();
  });

  test('reading progress saves automatically', async ({ page }) => {
    // 滚动到中间
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

    // 等待保存（debounce 5s）
    await page.waitForTimeout(6000);

    // 刷新页面
    await page.reload();

    // 验证进度恢复
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});
```

#### 3.3.4 批注创建

```typescript
// e2e/annotations.spec.ts
test.describe('Annotation Creation', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并打开一条笔记
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.click('[data-testid="note-card"]:first-child');
  });

  test('create annotation from text selection', async ({ page }) => {
    // 选择文本
    await page.locator('[data-testid="article-content"]').click();
    const textElement = await page.locator('[data-testid="article-content"]').locator('p').first();
    await textElement.selectText();

    // 等待浮动工具栏出现
    await expect(page.locator('[data-testid="selection-toolbar"]')).toBeVisible();

    // 点击高亮按钮
    await page.click('[data-testid="highlight-btn"]');

    // 选择颜色
    await page.click('[data-testid="color-yellow"]');

    // 添加评论
    await page.fill('[data-testid="annotation-comment"]', 'This is important');
    await page.click('button:has-text("保存")');

    // 验证批注出现在右侧栏
    await expect(page.locator('[data-testid="annotation-list"]')).toContainText('This is important');
  });
});
```

### 3.4 性能测试 (k6 + Lighthouse)

**目标**: 确保系统在预期负载下性能可接受。

#### 3.4.1 负载测试 (k6)

```javascript
// k6/dashboard-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Spike to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'),  // 95% of requests < 500ms
    'http_req_failed': ['rate<0.01'],    // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 测试 Dashboard 加载
  const res = http.get(`${BASE_URL}/dashboard`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'page has content': (r) => r.html.includes('我的收藏'),
  });

  sleep(1);
}
```

**执行**:

```bash
# 设置环境变量
export BASE_URL=http://localhost:3000

# 运行测试
k6 run k6/dashboard-load-test.js
```

#### 3.4.2 性能预算 (Lighthouse)

```javascript
// lighthouse.config.js
module.exports = {
  extends: 'lighthouse:default',
  settings: {
    onlyAudits: [
      'first-contentful-paint',
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'speed-index',
    ],
  },
  budgets: [
    {
      path: '/*',
      timings: [
        { metric: 'interactive', budget: 5000 },
        { metric: 'first-contentful-paint', budget: 2000 },
      ],
      resourceSizes: [
        { resourceType: 'total', budget: 500 },
        { resourceType: 'script', budget: 200 },
      ],
    },
  ],
};
```

### 3.5 安全测试

**目标**: 确保系统无已知安全漏洞。

#### 3.5.1 OWASP Top 10 检查清单

| 风险 | 检查项 | 验证方式 | 状态 |
|-----|-------|---------|------|
| A01:2021 – 访问控制失效 | RLS 策略覆盖所有表 | pgTAP 测试 | [ ] |
| A02:2021 – 加密失效 | 敏感数据加密存储 | 代码审查 | [ ] |
| A03:2021 – 注入 | SQL 参数化查询 | 代码审查 | [ ] |
| A04:2021 – 不安全设计 | 输入验证 | E2E 测试 | [ ] |
| A05:2021 – 错误配置 | CORS 策略 | 配置审查 | [ ] |
| A07:2021 – 身份识别失败 | Session 管理 | E2E 测试 | [ ] |
| A08:2021 – 软件和数据完整性失败 | 数据校验 | 单元测试 | [ ] |
| A09:2021 – 安全日志和监控失败 | 审计日志 | 代码审查 | [ ] |

#### 3.5.2 RLS 绕过检测

**自动化扫描脚本**:

```typescript
// scripts/rls-bypass-scan.ts
import { createClient } from '@supabase/supabase-js';

async function scanRLSBypass() {
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const issues: string[] = [];

  // 检查 Edge Functions 是否使用了 service_role key
  const edgeFunctions = await adminClient
    .from('edge_functions')
    .select('name, source_code');

  for (const fn of edgeFunctions.data || []) {
    if (fn.source_code.includes('service_role')) {
      issues.push(`Edge Function "${fn.name}" uses service_role key`);
    }
  }

  // 检查 RLS 是否启用
  const tables = await adminClient
    .rpc('get_tables_with_rls');

  for (const table of tables) {
    if (!table.relrowsecurity) {
      issues.push(`Table "${table.relname}" has RLS disabled`);
    }
  }

  return issues;
}
```

### 3.6 可访问性测试

**目标**: 符合 WCAG 2.1 AA 标准。

**测试清单**:

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('dashboard has no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab 键导航
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Enter 键激活
    await page.keyboard.press('Enter');
    // 验证功能正常
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/dashboard');

    const violations = await page.locator('*').evaluateAll((elements) => {
      // 使用 axe-core 检查对比度
      return axe.run(elements, { rules: { 'color-contrast': { enabled: true } } });
    });

    expect(violations.length).toBe(0);
  });
});
```

---

## 4. 测试工具链

### 4.1 工具选型

| 测试类型 | 工具 | 版本 | 理由 |
|---------|-----|------|------|
| **单元测试** | Jest | 29.x | Next.js 官方支持，快速稳定 |
| **组件测试** | React Testing Library | 14.x | 鼓励测试用户行为 |
| **E2E 测试** | Playwright | 1.40.x | 多浏览器，快速，内置断言 |
| **集成测试** | pgTAP | 1.x | PostgreSQL 原生测试框架 |
| **性能测试** | k6 | 0.48.x | 轻量级，易用 |
| **覆盖率** | Jest Coverage | 内置 | 与 Jest 集成 |
| **可访问性** | axe-core | 4.x | 业界标准 |

### 4.2 Jest 配置

**`jest.config.js`**:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/e2e/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

**`jest.setup.js`**:

```javascript
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))
```

**`package.json` 脚本**:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathIgnorePatterns=e2e",
    "test:integration": "supabase test db",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:performance": "k6 run k6/dashboard-load-test.js"
  }
}
```

### 4.3 Playwright 配置

**`playwright.config.ts`**:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 4.4 测试目录结构

```
newsbox/
├── __tests__/
│   ├── mocks/
│   │   ├── supabase.ts
│   │   └── openai.ts
│   ├── lib/
│   │   ├── services/
│   │   │   ├── openai.test.ts
│   │   │   ├── jina.test.ts
│   │   │   └── knowledge-topics.test.ts
│   │   ├── utils.test.ts
│   │   └── supabase/
│   │       └── proxy.test.ts
│   └── components/
│       ├── dashboard/
│       │   └── dashboard-content.test.tsx
│       ├── reader/
│       │   ├── ReaderLayout.test.tsx
│       │   └── GlobalHeader/
│       │       ├── ActionMenu.test.tsx
│       │       └── TagPopup.test.tsx
│       └── settings/
│           └── sections/
│               ├── AppearanceSection.test.tsx
│               └── AccountSection.test.tsx
├── e2e/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   ├── reader.spec.ts
│   ├── annotations.spec.ts
│   ├── ai-features.spec.ts
│   └── knowledge-base.spec.ts
├── k6/
│   └── dashboard-load-test.js
├── supabase/
│   └── tests/
│       ├── seed.sql
│       ├── rls_notes.test.sql
│       ├── rls_folders.test.sql
│       ├── rls_tags.test.sql
│       └── rls_annotations.test.sql
├── jest.config.js
├── jest.setup.js
└── playwright.config.ts
```

---

## 5. 测试数据策略

### 5.1 数据分类

| 数据类型 | 用途 | 隔离要求 | GDPR 合规 |
|---------|------|---------|-----------|
| **生产数据** | 真实场景测试 | ❌ 不允许 | ⚠️ 需脱敏 |
| **合成数据** | 单元测试 | ✅ 自包含 | ✅ 合规 |
| **种子数据** | 集成测试 | ✅ 按用户隔离 | ✅ 合规 |
| **黄金数据集** | AI 质量评估 | ✅ 静态 | ✅ 合规 |

### 5.2 种子数据设计

**`supabase/tests/seed.sql`**:

```sql
-- 创建测试用户（2 个用户，用于隔离测试）
DO $$
DECLARE
  user1_id UUID := '11111111-1111-1111-1111-111111111111';
  user2_id UUID := '22222222-2222-2222-2222-222222222222';
  folder_tech UUID;
  folder_news UUID;
  note1_id UUID;
  note2_id UUID;
  tag_ai UUID;
  tag_react UUID;
BEGIN
  -- 插入 auth.users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
  VALUES
    (user1_id, 'user1@test.com', 'hash', NOW()),
    (user2_id, 'user2@test.com', 'hash', NOW());

  -- 插入 profiles
  INSERT INTO profiles (id, email, full_name)
  VALUES
    (user1_id, 'user1@test.com', 'Test User 1'),
    (user2_id, 'user2@test.com', 'Test User 2');

  -- 插入收藏夹
  INSERT INTO folders (id, user_id, name, position)
  VALUES
    (gen_random_uuid(), user1_id, 'Tech', 0)
    RETURNING id INTO folder_tech;

  INSERT INTO folders (id, user_id, name, position)
  VALUES
    (gen_random_uuid(), user1_id, 'News', 1)
    RETURNING id INTO folder_news;

  -- 插入笔记（不同状态）
  INSERT INTO notes (id, user_id, folder_id, title, source_url, content_type, status, published_at)
  VALUES
    (gen_random_uuid(), user1_id, folder_tech, 'AI 技术趋势', 'https://example.com/ai', 'article', 'unread', NOW() - INTERVAL '1 day')
    RETURNING id INTO note1_id,

    (gen_random_uuid(), user1_id, folder_news, '今日新闻', 'https://example.com/news', 'article', 'reading', NOW() - INTERVAL '2 hours')
    RETURNING id INTO note2_id,

    (gen_random_uuid(), user1_id, NULL, '归档笔记', 'https://example.com/archived', 'article', 'archived', NOW() - INTERVAL '1 week');

  -- 插入标签
  INSERT INTO tags (id, user_id, name, color)
  VALUES
    (gen_random_uuid(), user1_id, 'AI', '#FF5733')
    RETURNING id INTO tag_ai,

    (gen_random_uuid(), user1_id, 'React', '#33FF57')
    RETURNING id INTO tag_react;

  -- 插入笔记-标签关联
  INSERT INTO note_tags (note_id, tag_id)
  VALUES
    (note1_id, tag_ai),
    (note2_id, tag_react);

  -- 插入批注
  INSERT INTO annotations (id, user_id, note_id, quote, comment)
  VALUES
    (gen_random_uuid(), user1_id, note1_id, '重要段落', '这是一个重要的批注');

  -- User2 的数据（用于隔离测试）
  INSERT INTO notes (id, user_id, title, source_url, content_type)
  VALUES
    (gen_random_uuid(), user2_id, 'User2 Note', 'https://example.com/user2', 'article', 'unread', NOW());
END $$;

-- 验证数据
SELECT 'User1 has 3 notes' AS test_result, COUNT(*)
FROM notes WHERE user_id = '11111111-1111-1111-1111-111111111111';

SELECT 'User1 has 2 tags' AS test_result, COUNT(*)
FROM tags WHERE user_id = '11111111-1111-1111-1111-111111111111';

SELECT 'User1 has 1 annotation' AS test_result, COUNT(*)
FROM annotations WHERE user_id = '11111111-1111-1111-1111-111111111111';
```

**加载种子数据**:

```bash
# 重置数据库并加载种子数据
supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"

# 单独加载种子数据
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/seed.sql
```

### 5.3 Mock 数据工厂

**`__tests__/mocks/factory.ts`**:

```typescript
import { Note, Folder, Tag, Annotation } from '@/types';

export const mockNote = (overrides = {}) => ({
  id: 'mock-note-id',
  user_id: 'mock-user-id',
  title: 'Mock Note Title',
  source_url: 'https://example.com/mock',
  content_type: 'article',
  status: 'unread',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockFolder = (overrides = {}) => ({
  id: 'mock-folder-id',
  user_id: 'mock-user-id',
  name: 'Mock Folder',
  position: 0,
  ...overrides,
});

export const mockTag = (overrides = {}) => ({
  id: 'mock-tag-id',
  user_id: 'mock-user-id',
  name: 'Mock Tag',
  color: '#FF5733',
  ...overrides,
});

export const mockAnnotation = (overrides = {}) => ({
  id: 'mock-annotation-id',
  user_id: 'mock-user-id',
  note_id: 'mock-note-id',
  quote: 'Mock quote',
  comment: 'Mock comment',
  ...overrides,
});

// 批量生成
export const mockNotes = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    mockNote({ id: `mock-note-${i}`, title: `Note ${i}` })
  );
```

### 5.4 GDPR 合规性

**数据保护措施**:

1. **测试数据脱敏**
   - 不使用真实用户邮箱
   - 不使用真实密码
   - 不包含 PII（个人身份信息）

2. **测试环境隔离**
   - 测试数据库独立于生产
   - 使用独立的 Supabase 项目
   - 环境变量严格分离

3. **数据清理**
   - 每次测试前重置数据库
   - 测试后清理临时文件
   - 不在版本控制中存储敏感数据

```bash
# .gitignore
# 测试数据
supabase/.branches/develop/.env
coverage/
playwright-report/
test-results/

# 环境变量
.env.local
.env.test.local
```

---

## 6. CI/CD 集成

### 6.1 GitHub Actions 工作流

**`.github/workflows/test.yml`**:

```yaml
name: Test Suite

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit
          name: codecov-umbrella

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.1.0.127
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: supabase start

      - name: Reset database
        run: supabase db reset

      - name: Load seed data
        run: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/tests/seed.sql

      - name: Run pgTAP tests
        run: supabase test db

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6-v0.48.0-linux-amd64/k6 /usr/local/bin/

      - name: Start application
        run: npm run start &
          echo $! > /tmp/app.pid

      - name: Wait for app to be ready
        run: npx wait-on http://localhost:3000

      - name: Run performance tests
        run: k6 run k6/dashboard-load-test.js

      - name: Stop application
        run: kill $(cat /tmp/app.pid) || true

  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests]
    steps:
      - name: All tests passed
        run: echo "✅ Quality gate passed"
```

### 6.2 Pre-commit 钩子

**`.husky/pre-commit`**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# 运行单元测试（仅修改的文件）
npm run test:unit -- --onlyChanged --bail

# 运行 Lint
npm run lint

# 类型检查
npx tsc --noEmit

echo "✅ Pre-commit checks passed"
```

**`.husky/pre-push`**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-push checks..."

# 运行所有单元测试
npm run test:unit -- --coverage

# 检查覆盖率阈值
COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
if (( $(echo "$COVERAGE < 70" | bc -l) )); then
  echo "❌ Coverage $COVERAGE% is below 70%"
  exit 1
fi

echo "✅ Pre-push checks passed"
```

### 6.3 测试报告

**Jest HTML 报告器**:

```bash
npm install -D jest-html-reporters
```

**`jest.config.js` 添加**:

```javascript
module.exports = {
  // ...
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: 'coverage/html',
      filename: 'report.html',
      expand: true,
    }],
  ],
}
```

**查看报告**:

```bash
open coverage/html/report.html
```

---

## 7. 风险缓解

### 7.1 已识别风险

| 风险ID | 风险描述 | 影响 | 概率 | 严重度 | 缓解策略 |
|-------|---------|------|------|-------|---------|
| **R001** | AI 功能不稳定 | 高 | 高 | 🔴 高 | 三层评估体系（见 2.2 节） |
| **R002** | RLS 策略可能被绕过 | 高 | 中 | 🔴 高 | 自动化扫描 + 人工审计 |
| **R003** | 测试环境配置复杂 | 中 | 中 | 🟡 中 | Docker 容器化 |
| **R004** | 测试数据准备耗时 | 中 | 高 | 🟡 中 | 自动化数据生成 |
| **R005** | AI API 成本超预算 | 高 | 中 | 🟡 中 | Token 限制 + 监控 |
| **R006** | E2E 测试不稳定 | 中 | 中 | 🟢 低 | 重试机制 + 并行控制 |

### 7.2 降级策略

**当 AI 功能失败时**:

```typescript
async function safeAICall<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      timeout: 10000,
    });

    return result.choices[0].message.content;
  } catch (error) {
    console.warn('AI call failed, using fallback:', error);
    return fallback;
  }
}
```

**当数据库查询超时时**:

```typescript
async function safeQuery<T>(
  query: () => Promise<T>,
  fallback: T,
  timeout = 5000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await query();
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Query timeout, using fallback');
      return fallback;
    }
    throw error;
  }
}
```

### 7.3 监控和告警

**关键指标**:

| 指标 | 目标 | 告警阈值 |
|-----|------|---------|
| 测试通过率 | > 95% | < 90% |
| 测试覆盖率 | > 70% | < 65% |
| P95 响应时间 | < 500ms | > 1s |
| 错误率 | < 1% | > 5% |
| AI 成本/天 | < $10 | > $20 |

**告警通知**:

```typescript
// scripts/check-test-results.ts
import { Octokit } from 'octokit';

async function checkTestResults() {
  const coverage = JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json'));
  const lineCoverage = coverage.total.lines.pct;

  if (lineCoverage < 70) {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    await octokit.issues.create({
      owner: 'your-org',
      repo: 'newsbox',
      title: `⚠️ Test coverage dropped to ${lineCoverage}%`,
      body: `Current coverage is below 70% threshold.`,
      labels: ['test-failure', 'coverage'],
    });
  }
}
```

### 7.4 回滚计划

**当关键测试失败时**:

1. **立即回滚** (P0 测试失败):
   ```bash
   # Git revert
   git revert HEAD

   # 或部署上一个版本
   vercel rollback
   ```

2. **紧急修复** (P1 测试失败):
   - 创建 hotfix 分支
   - 修复问题
   - 快速通道审查
   - 合并到 main

3. **技术债务** (P2 测试失败):
   - 记录到技术债务清单
   - 计划在下个 Sprint 修复

---

## 附录

### A. 术语表

| 术语 | 解释 |
|-----|------|
| **RLS** | Row Level Security，PostgreSQL 行级安全策略 |
| **E2E** | End-to-End，端到端测试 |
| **pgTAP** | PostgreSQL 的 TAP (Test Anything Protocol) 实现 |
| **P0/P1/P2** | 优先级等级（P0 最高） |
| **Golden Dataset** | 黄金数据集，用于 AI 质量评估的标准数据 |
| **Hallucination** | AI 幻觉，指 AI 生成的不符合事实的内容 |

### B. 参考资料

1. [Next.js Testing Documentation](https://nextjs.org/docs/testing)
2. [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
3. [Playwright Best Practices](https://playwright.dev/docs/best-practices)
4. [Testing Library Principles](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
5. [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### C. 测试检查清单

**开发阶段**:
- [ ] 单元测试覆盖率 > 70%
- [ ] 所有分支都有测试
- [ ] 边界值测试
- [ ] 错误处理测试
- [ ] Mock 外部依赖

**集成阶段**:
- [ ] RLS 策略测试通过
- [ ] API 端点测试覆盖
- [ ] 数据库迁移测试
- [ ] 第三方集成测试

**E2E 阶段**:
- [ ] 关键用户旅程测试
- [ ] 跨浏览器测试
- [ ] 移动端测试
- [ ] 性能基准测试

**安全阶段**:
- [ ] RLS 绕过检测
- [ ] SQL 注入测试
- [ ] XSS 防护测试
- [ ] CSRF 防护测试
- [ ] 敏感数据保护测试

---

**文档结束**

*本文档由 AI 辅助生成，建议结合人工审查后执行。*
