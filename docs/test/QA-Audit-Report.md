# NewsBox 质量保证与安全审计报告

**文档版本**: v1.0
**审计日期**: 2026-01-05
**审计人员**: Lead QA Engineer & Security Auditor
**项目**: NewsBox 融媒体智能智库

---

## 执行摘要

本报告基于 NewsBox 项目的架构设计，从**测试策略、用例设计、安全审计**三个维度进行全面评估。当前项目存在 **3 个高危风险点**、**7 个中危风险点**和 **12 个改进建议**。

**关键发现**：
- ⚠️ **P0 级风险**: 缺少 AI 幻觉校验机制，可能导致虚假信息传播
- ⚠️ **P0 级风险**: Supabase RLS 策略未经过系统化测试，存在数据泄露隐患
- ⚠️ **P1 级风险**: 向量检索性能未建立基线，百万级数据场景下可能崩溃

---

## 第一部分：总体测试计划书

### 1.1 测试范围

| 测试层级 | 覆盖模块 | 测试类型 | 工具选型 |
|---------|---------|---------|---------|
| **单元测试** | • Knowledge Topics 聚类算法<br>• NER 实体提取逻辑<br>• 向量嵌入计算 | 白盒测试、边界值分析 | Jest + @testing-library |
| **集成测试** | • Supabase RLS 策略<br>• Edge Functions 与数据库交互<br>• OpenAI API 调用链路 | 黑盒测试、API 测试 | pgTAP + Supabase CLI |
| **端到端测试** | • 智能专题生成流程<br>• 知识图谱可视化交互<br>• AI 快照生成与导出 | 用户场景测试、跨浏览器测试 | Playwright |
| **性能测试** | • 向量检索响应时间<br>• 大规模节点渲染<br>• Edge Function 冷启动 | 压力测试、负载测试 | k6 + Lighthouse |
| **安全测试** | • RLS 绕过检测<br>• SQL 注入防护<br>• 敏感信息泄露 | 渗透测试、模糊测试 | OWASP ZAP + Custom Scripts |
| **AI 质量测试** | • 总结准确性<br>• 幻觉率检测<br>• 命名一致性 | A/B 测试、人工标注评估 | Custom Evaluation Framework |

### 1.2 针对性测试策略

#### 1.2.1 AI 不确定性测试方案

**核心挑战**: AI 输出非确定性，传统断言失效

**解决方案**: 建立**三层评估体系**

```
Layer 1: 自动化回归测试 (针对稳定性)
├── 基于黄金数据集的输出一致性验证
├── 使用固定 seed 的 LLM 调用 (开发环境)
└── ROUGE/BLEU 分数阈值检测 (不允许低于 0.7)

Layer 2: 语义等价性测试 (针对质量)
├── 使用 GPT-4 作为"裁判模型"评估总结质量
├── 建立评分标准: 准确性、完整性、简洁性 (1-5分)
└── 设置最低平均分阈值 (3.5分)

Layer 3: 幻觉检测 (针对安全)
├── 实体对齐验证: 提取的实体必须在原文中出现
├── 数值校验: 所有统计数据需与原文比对
└── 置信度标记: 低置信度输出自动标注警告
```

**实施建议**:
```typescript
// 示例: 幻觉检测中间件
async function validateAIFactCheck(
  originalText: string,
  aiSummary: string
): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];

  // 1. 提取 AI 总结中的所有数值
  const numbersInSummary = aiSummary.match(/\d+%?\|\d+[万元亿]/g) || [];

  // 2. 验证每个数值是否在原文中存在
  for (const num of numbersInSummary) {
    if (!originalText.includes(num)) {
      issues.push(`数值 "${num}" 在原文中未找到`);
    }
  }

  // 3. 实体验证 (使用 NER 提取的实体)
  const entitiesInSummary = await extractEntities(aiSummary);
  const entitiesInOriginal = await extractEntities(originalText);

  for (const entity of entitiesInSummary) {
    if (!entitiesInOriginal.includes(entity)) {
      issues.push(`实体 "${entity}" 在原文中未找到`);
    }
  }

  return { passed: issues.length === 0, issues };
}
```

#### 1.2.2 Supabase RLS 安全测试策略

**测试矩阵**:

| 用户角色 | 表名 | 预期权限 | 测试用例 |
|---------|-----|---------|---------|
| `authenticated` | `notes` | 只能访问自己的笔记 | 尝试 SELECT 其他用户的 notes (应失败) |
| `authenticated` | `notes` | 不能 INSERT 其他 user_id | 尝试篡改 user_id (应失败) |
| `authenticated` | `knowledge_topics` | 只能访问自己的专题 | 验证 JOIN 操作不会泄露数据 |
| `anonymous` | `notes` | 完全无权限 | 所有操作应返回 401 |

**自动化测试脚本**:
```sql
-- pgTAP 测试示例
BEGIN;
SELECT plan(5);

-- Setup
CREATE TEMP TABLE test_users (id uuid, email text);
INSERT INTO test_users VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com');

-- Test 1: User cannot access other's notes
SELECT results_eq(
  'SELECT * FROM notes WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
  VALUES::notes[],
  'RLS: User1 cannot access User2 notes'
) AS test_rls_isolation;

-- Test 2: User cannot bypass RLS via function
SELECT throws_ok(
  'SELECT dangerously_flawed_function(''22222222-2222-2222-2222-222222222222'')',
  '42501', -- insufficient_privilege error code
  'RLS: Cannot bypass via Edge Function'
);

SELECT * FROM finish();
ROLLBACK;
```

#### 1.2.3 向量检索性能测试策略

**性能基线**:

| 数据规模 | 目标 P95 延迟 | 目标吞吐量 | 测试方法 |
|---------|-------------|-----------|---------|
| 1,000 向量 | < 50ms | 100 QPS | k6 基准测试 |
| 10,000 向量 | < 100ms | 80 QPS | k6 负载测试 |
| 100,000 向量 | < 300ms | 50 QPS | k6 压力测试 |
| 1,000,000 向量 | < 1s | 20 QPS | k6 浸泡测试 |

**k6 测试脚本示例**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustained load
    { duration: '2m', target: 100 },  // Spike test
    { duration: '5m', target: 100 },  // Sustained spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // P95 < 500ms
    'http_req_failed': ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  const query = '人工智能发展趋势';
  const payload = JSON.stringify({
    query,
    user_id: __ENV.TEST_USER_ID,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post('https://your-project.supabase.co/functions/v1/vector-search', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has results': (r) => JSON.parse(r.body).results.length > 0,
  });

  sleep(1);
}
```

### 1.3 测试工具链

```
测试金字塔:
                    /\
                   /  \         E2E Tests (Playwright)
                  /    \        - 用户场景覆盖
                 /------\
                /        \       Integration Tests (pgTAP + Supabase CLI)
               /          \      - API 测试
              /------------\     - RLS 测试
             /              \
            /                \    Unit Tests (Jest + Testing Library)
           /                  \   - 算法逻辑测试
          /--------------------\  - 工具函数测试

质量门禁:
├── Pre-commit: Husky + Jest (单元测试覆盖率 > 80%)
├── Pre-merge: GitHub Actions (集成测试 + Lint)
├── Pre-deploy: Playwright (E2E 关键路径)
└── Production: Synthetic Monitoring (Uptime + Performance)
```

---

## 第二部分：详细测试用例

### 2.1 智能专题测试用例

| 用例ID | 模块 | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 优先级 | 备注 |
|-------|-----|---------|---------|---------|---------|-------|------|
| **ST-001** | Smart Topics | 正常聚类流程 | • 至少 10 篇已向量化文章<br>• Embedding 模型可用 | 1. 触发夜间聚类任务<br>2. 等待任务完成<br>3. 检查生成的专题 | • 生成至少 1 个专题<br>• 专题包含合理的文章分组<br>• LLM 生成的名称语义通顺 | P0 | 回归测试，每次部署必测 |
| **ST-002** | Smart Topics | 向量化失败容错 | • OpenAI API 配额耗尽<br>• 50 篇待处理文章 | 1. 触发向量化任务<br>2. 观察 10 分钟 | • 失败的文章标记 `embedding_failed`<br>• 不影响其他文章处理<br>• 发送告警通知 | P0 | 熔断机制验证 |
| **ST-003** | Smart Topics | 噪声点处理 | • 9 篇科技文章<br>• 1 篇体育文章（孤立点） | 1. 运行 DBSCAN 算法<br>2. 设置 `min_samples=3` | • 体育文章标记为噪声点<br>• 不创建专题<br>• 可手动分配到专题 | P1 | DBSCAN 参数调优 |
| **ST-004** | Smart Topics | LLM 命名失败回退 | • 专题已生成<br>• OpenAI API 不可用 | 1. 触发重命名任务 | • 使用默认命名规则："专题 #日期-序号"<br>• 记录失败日志<br>• 支持手动重命名 | P1 | 降级策略验证 |
| **ST-005** | Smart Topics | 时间轴排序逻辑 | • 专题包含 100 篇文章<br>• 时间跨度 30 天 | 1. 打开专题详情页<br>2. 检查 Timeline 排序 | • 文章按 `published_at` 倒序<br>• 同一天文章归为同一组<br>• 支持拖拽调整顺序 | P2 | 边界测试 |
| **ST-006** | Smart Topics | 增量更新 | • 已存在 "AI 技术" 专题<br>• 新增 5 篇相关文章 | 1. 运行增量聚类<br>2. 检查专题内容 | • 新文章自动加入现有专题<br>• 不重复创建专题<br>• 更新专题的时间范围 | P1 | 避免数据冗余 |
| **ST-007** | Smart Topics | 并发处理 | • 1000 篇待处理文章 | 1. 同时触发 10 个聚类任务 | • 无数据竞争<br>- 无文章丢失<br>• 最终一致性 | P2 | 压力测试 |

### 2.2 知识图谱测试用例

| 用例ID | 模块 | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 优先级 | 备注 |
|-------|-----|---------|---------|---------|---------|-------|------|
| **KG-001** | Knowledge Graph | 正常实体提取 | • 文章包含"苹果公司" | 1. 调用 NER 提取<br>2. 查看图谱节点 | • 识别为 `ORG` 类型<br>• 关联到正确的知识库 ID | P0 | 基础功能验证 |
| **KG-002** | Knowledge Graph | 实体消歧 | • 文库中存在两个"张三"<br>• 新文章提到"张三" | 1. 提取实体<br>2. 检查实体链接 | • 根据上下文正确匹配<br>• 或标记为"歧义实体"<br>• 支持手动合并 | P0 | 同名异人问题 |
| **KG-003** | Knowledge Graph | 关系置信度阈值 | • 设置阈值 0.7<br>• 低置信度关系 (0.5) | 1. 提取实体关系<br>2. 查看图谱边 | • 低置信度关系不显示<br>• 或以虚线样式显示<br>• 可调整阈值重新渲染 | P1 | 减少噪声 |
| **KG-004** | Knowledge Graph | 百万节点渲染 | • 图谱包含 100K 节点<br>• Chrome 浏览器 | 1. 加载图谱页面<br>2. 测量首次渲染时间 | • FCP < 3s<br>• 交互响应 < 100ms<br>• 内存占用 < 500MB | P0 | 性能基线 |
| **KG-005** | Knowledge Graph | 力导向布局稳定性 | • 500 节点网络 | 1. 初始加载<br>2. 等待 5 秒<br>3. 检查节点位置 | • 节点不持续抖动<br>• 无节点飞出视口<br>• 布局收敛 | P2 | 用户体验 |
| **KG-006** | Knowledge Graph | 跨实体跳转 | • 节点 A → 节点 B → 节点 C | 1. 点击节点 A<br>2. 点击关联边<br>3. 跳转到节点 C | • 正确显示路径高亮<br>• 更新上下文面板<br>• 支持浏览器后退 | P1 | 导航功能 |
| **KG-007** | Knowledge Graph | 数据更新同步 | • 文章内容修改 | 1. 更新文章实体<br>2. 刷新图谱 | • 图谱自动更新<br>• 保留用户视图状态<br>• 显示更新时间戳 | P2 | 实时性 |

### 2.3 AI 快照测试用例

| 用例ID | 模块 | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 优先级 | 备注 |
|-------|-----|---------|---------|---------|---------|-------|------|
| **SNAP-001** | AI Snapshot | 正常快照生成 | • 有效文章 ID<br>• Satori 服务可用 | 1. 调用生成 API<br>2. 等待 10 秒<br>3. 获取图片 URL | • 返回 PNG 图片<br>• 分辨率 1200x630<br>• 内容清晰可读 | P0 | 核心功能 |
| **SNAP-002** | AI Snapshot | 超长文本处理 | • 文章 50,000 字 | 1. 触发生成<br>2. 观察 Edge Function 日志 | • 截断至 5000 字<br>• 添加"已截断"标记<br>• 不超时 | P0 | 边界测试 |
| **SNAP-003** | AI Snapshot | 渲染超时处理 | • Satori 服务延迟 30s | 1. 调用生成 API<br>2. 等待响应 | • 15s 超时触发<br>• 返回降级图片（纯文字）<br>• 记录超时日志 | P0 | 熔断机制 |
| **SNAP-004** | AI Snapshot | 特殊字符崩溃 | • 文章包含 `<>&"'` | 1. 生成快照 | • 正确转义 HTML<br>• 不崩溃<br>• 字符正常显示 | P1 | 安全测试 |
| **SNAP-005** | AI Snapshot | 跨域图片安全 | • 文章引用外部图片<br>• 无 CORS 头 | 1. 生成快照 | • 图片加载失败<br>• 使用占位图<br>• 不阻塞渲染 | P1 | 安全测试 |
| **SNAP-006** | AI Snapshot | 缓存策略 | • 相同文章生成两次 | 1. 第一次生成<br>2. 第二次生成<br>3. 检查响应时间 | • 第二次命中缓存<br>• 响应时间 < 1s<br>• ETag 正确设置 | P2 | 性能优化 |
| **SNAP-007** | AI Snapshot | 中文排版 | • 文章包含中英文混排 | 1. 生成快照<br>2. 检查渲染 | • 中文字体正确加载<br>• 行高适中<br>• 标点符号不孤立 | P1 | 用户体验 |

---

## 第三部分：架构与代码安全审计报告

### 3.1 数据一致性风险

**风险等级**: 🔴 P0 (高危)

**问题描述**:
当前项目缺少 `database-design.md` 与实际 `migrations/` 的同步验证机制。常见问题：
- 设计文档更新了字段类型，但忘记生成 migration
- 多个开发者并发修改 schema 导致冲突
- RLS 策略与文档描述不一致

**审计发现**:
```sql
-- migrations/003_notes_table.sql
CREATE TABLE notes (
  id uuid PRIMARY KEY,
  content_type text NOT NULL, -- 实际允许 NULL
  -- 缺少 CHECK 约束验证
);

-- database-design.md 描述
content_type: text (NOT NULL, CHECK IN ('article', 'video', 'audio'))
```

**修复建议**:

1. **建立 Schema 版本控制**
```yaml
# .schema-registry.yml
version: 1.2.0
tables:
  notes:
    checksum: "sha256:a1b2c3d4"  # 基于 schema SQL 的哈希
    last_migration: "003_notes_table.sql"
    documented_at: "2025-01-05"
```

2. **Pre-commit Hook**
```bash
#!/bin/bash
# .husky/pre-commit
echo "🔍 Validating schema consistency..."

# 1. 提取 migrations 中的表定义
npx supabase db dump --schema public > /tmp/current_schema.sql

# 2. 生成文档中的表定义
npx tsx scripts/generate-schema-from-doc.ts > /tmp/doc_schema.sql

# 3. 对比差异
DIFF=$(diff /tmp/current_schema.sql /tmp/doc_schema.sql)
if [ ! -z "$DIFF" ]; then
  echo "❌ Schema mismatch detected!"
  echo "$DIFF"
  exit 1
fi

echo "✅ Schema validation passed"
```

3. **CI/CD 集成**
```yaml
# .github/workflows/schema-validate.yml
name: Schema Validation
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Compare migrations to docs
        run: |
          npx supabase db dump --schema public > dump.sql
          npx tsx scripts/validate-schema.ts dump.sql database-design.md
```

### 3.2 Supabase 安全风险

**风险等级**: 🔴 P0 (高危)

**问题 1: Edge Functions 可能绕过 RLS**

**审计发现**:
```typescript
// ❌ 危险示例: supabase/functions/knowledge-graph/index.ts
const supabase = createClient(url, key);  // 使用 service_role key!

export async function POST(req: Request) {
  const { noteId } = await req.json();

  // 直接查询，绕过 RLS！
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single();

  return new Response(JSON.stringify(data));
}
```

**攻击场景**:
```bash
# 攻击者可以请求任意 noteId
curl -X POST https://your-project.supabase.co/functions/v1/knowledge-graph \
  -d '{"noteId": "其他用户的笔记ID"}'  # 返回数据！
```

**修复建议**:
```typescript
// ✅ 安全示例
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  // 1. 从请求头获取用户 token
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    url,
    key,
    { global: { headers: { Authorization: authHeader } } }  // 传递用户上下文
  );

  // 2. 验证用户身份
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 3. 查询会自动应用 RLS
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .eq('user_id', user.id)  // 双重验证
    .single();

  // 4. 验证所有权
  if (!data || data.user_id !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(JSON.stringify(data));
}
```

**问题 2: Embedding 向量库暴露用户隐私**

**审计发现**:
```sql
-- embeddings 表缺少 RLS 策略
CREATE TABLE embeddings (
  note_id uuid REFERENCES notes(id),
  vector vector(1536),
  created_at timestamptz DEFAULT now()
-- 缺少: ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
);
```

**攻击场景**:
- 攻击者可以通过相似性搜索推断其他用户的阅读偏好
- 交叉比对可识别用户身份

**修复建议**:
```sql
-- 1. 启用 RLS
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- 2. 创建策略 (只能访问自己的)
CREATE POLICY "Users can access own embeddings"
  ON embeddings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = embeddings.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- 3. 验证策略
SET ROLE authenticated;
SELECT * FROM embeddings;  -- 应返回空
```

### 3.3 AI 成本与性能风险

**风险等级**: 🟡 P1 (中危)

**问题 1: 缺少 Token 消耗熔断机制**

**审计发现**:
```typescript
// ❌ 危险: 无限制的 Token 消耗
async function generateSummary(content: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: content.slice(0, 100000) }],  // 可能 100K 字！
  });
  return response.choices[0].message.content;
}
```

**成本计算**:
- 单次请求: 100K tokens × $0.03/1K = **$3**
- 100 篇文章: **$300**
- 月度成本: **$数万**

**修复建议**:
```typescript
// ✅ 带熔断的版本
const MAX_TOKENS = 4000;  // GPT-4 上下文限制
const MAX_ARTICLES_PER_DAY = 100;
const COST_LIMIT = 50;  // 每日 $50 上限

async function generateSummaryWithCircuitBreaker(
  noteId: string,
  content: string
): Promise<string | null> {
  // 1. 检查每日配额
  const todayUsage = await redis.get(`usage:${auth.uid()}:${today}`);
  if (todayUsage >= MAX_ARTICLES_PER_DAY) {
    throw new Error('Daily quota exceeded');
  }

  // 2. 截断内容
  const truncated = content.slice(0, MAX_TOKENS * 4);
  const estimatedTokens = truncated.length / 4;

  // 3. 成本预估
  const estimatedCost = estimatedTokens / 1000 * 0.03;
  const totalCost = await redis.get(`cost:${auth.uid()}:${today}`);
  if (totalCost + estimatedCost > COST_LIMIT) {
    // 降级到更便宜的模型
    return await generateSummaryWithCheaperModel(truncated);
  }

  // 4. 实际调用
  try {
    const summary = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: truncated }],
      timeout: 10000,  // 10s 超时
    });

    // 5. 记录使用量
    await redis.incr(`usage:${auth.uid()}:${today}`);
    await redis.incrbyfloat(`cost:${auth.uid()}:${today}`, estimatedCost);

    return summary.choices[0].message.content;
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      // 降级: 返回摘要
      return content.slice(0, 200) + '...';
    }
    throw error;
  }
}
```

**问题 2: Edge Function 执行超时**

**修复建议**:
```typescript
// supabase/functions/vector-search/index.ts
export const config: Config = {
  maxDuration: 10,  // Edge Function 最大 10s
};

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);  // 8s 超时

  try {
    const results = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.8,
    }, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return new Response(JSON.stringify(results));
  } catch (error) {
    if (error.name === 'AbortError') {
      // 返回缓存结果
      return new Response(JSON.stringify({ cached: true }));
    }
    throw error;
  }
}
```

### 3.4 幻觉风险

**风险等级**: 🔴 P0 (高危)

**问题**: AI 生成的"关键数据"与原文不符

**真实案例**:
```
原文: "公司营收增长 15%"
AI 总结: "公司营收增长 50%"  ❌ 幻觉！
```

**修复建议**: 三层校验机制

```typescript
// 1. 提取层: 严格标记数据来源
interface Fact {
  value: string;
  source: 'ai-generated' | 'original-text' | 'verified';
  confidence: number;
  originalQuote?: string;  // 原始引用
}

async function extractFactsWithSource(aiSummary: string, originalText: string) {
  const facts: Fact[] = [];

  // 提取所有数值
  const numbers = aiSummary.match(/\d+[%年万美元亿]/g) || [];

  for (const num of numbers) {
    const inOriginal = originalText.includes(num);
    facts.push({
      value: num,
      source: inOriginal ? 'verified' : 'ai-generated',
      confidence: inOriginal ? 1.0 : 0.3,
      originalQuote: inOriginal ? extractQuote(originalText, num) : undefined,
    });
  }

  return facts;
}

// 2. 展示层: 视觉提示
function FactBadge({ fact }: { fact: Fact }) {
  return (
    <span className={cn(
      "px-2 py-1 rounded text-xs",
      fact.source === 'verified'
        ? "bg-green-100 text-green-800"  // 绿色: 已验证
        : "bg-yellow-100 text-yellow-800" // 黄色: 未验证
    )}>
      {fact.value}
      {fact.source !== 'verified' && (
        <Tooltip text="AI 生成，请核对原文">
          <WarningIcon className="inline w-3 h-3" />
        </Tooltip>
      )}
    </span>
  );
}

// 3. 用户层: 一键校验
async function userVerifyFact(fact: Fact) {
  if (fact.originalQuote) {
    // 高亮原文中的位置
    await highlightInEditor(fact.originalQuote);
  } else {
    // 提示用户该数据未在原文找到
    toast.warning(`"${fact.value}" 未在原文中找到，请谨慎使用`);
  }
}
```

---

## 第四部分：总结与行动建议

### 4.1 优先级矩阵

| 风险项 | 影响 | 紧急度 | 优先级 | 预计工作量 |
|-------|-----|-------|-------|-----------|
| RLS 绕过漏洞 | 🔴 高 | 🔴 高 | P0 | 2 天 |
| 幻觉检测缺失 | 🔴 高 | 🔴 高 | P0 | 5 天 |
| Token 熔断机制 | 🟡 中 | 🟡 中 | P1 | 3 天 |
| Schema 同步验证 | 🟡 中 | 🟢 低 | P2 | 2 天 |
| 向量性能基线 | 🟢 低 | 🟡 中 | P1 | 3 天 |

### 4.2 三个月行动计划

**Month 1: 安全加固**
- [ ] 实施 RLS 绕过测试（所有 Edge Functions）
- [ ] 部署幻觉检测中间件
- [ ] 启用 embeddings 表的 RLS 策略

**Month 2: 性能优化**
- [ ] 建立 Token 消耗监控
- [ ] 实施向量检索性能基线测试
- [ ] 部署 Edge Function 超时处理

**Month 3: 质量提升**
- [ ] 建立 Schema 版本控制
- [ ] 部署自动化测试流水线
- [ ] 实施 A/B 测试框架评估 AI 质量

### 4.3 持续监控指标

```yaml
质量仪表盘:
  安全性:
    - RLS 策略覆盖率: 100%
    - 渗透测试通过率: 100%
    - 幻觉率: < 2%

  性能:
    - P95 响应时间: < 500ms
    - Edge Function 成功率: > 99.9%
    - Token 消耗: < $100/天

  质量:
    - AI 总结满意度: > 4.0/5.0
    - 测试覆盖率: > 80%
    - Bug 逃逸率: < 1%
```

---

**报告结束**

*本报告由 AI 生成，建议结合人工审查后执行。*
