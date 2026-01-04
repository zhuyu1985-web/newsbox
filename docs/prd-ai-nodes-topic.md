这是一个非常专业且核心的模块。为了让大模型（如 ChatGPT, Claude, 或 CodeBuddy）能够准确执行开发，我们需要提供一份**结构清晰、逻辑严密、技术细节明确**的 Prompt（提示词）。

这份 Prompt 被设计为**“产品经理 + 架构师”**的口吻，它不仅告诉 AI “做什么”，还规定了“怎么做（数据库设计、算法策略）”。

---

### 第一部分：功能设计规划书 (供你审核)

在发给 AI 之前，我们先确认一下设计的细节。我基于你的需求，细化了以下逻辑：

#### 1. 核心逻辑架构

* **输入：** 用户收藏的新闻/视频（已存入 Supabase `articles` 表）。
* **处理（The Brain）：**
* **向量化：** 每次新增文章，自动触发 Edge Function 生成 Embedding。
* **聚类 Cron Job：** 每天凌晨扫描未归类文章，运行 **DBSCAN 算法**（比 K-Means 更适合未知数量的主题）。
* **主题生成：** 对聚类后的文章簇，调用 LLM 提取“标题”和“综述”。


* **输出（The Face）：** 专题列表页、专题详情页（含时间轴、报告）。

#### 2. 数据库设计 (Supabase)

我们需要两张核心表：

* `topics`: 存储专题元数据（标题、摘要、封面、中心向量）。
* `article_topics`: 关联表（多对多），存储文章与专题的关系及相似度分数。

#### 3. 关键算法策略

* **去噪：** 不是所有文章都必须进专题。DBSCAN 能识别“噪声点”，我们允许孤立文章不属于任何专题。
* **增量更新：** 新文章进来时，先计算与现有 `topics` 中心向量的余弦相似度。如果 > 0.85，直接归入旧专题；否则等待夜间聚类形成新专题。
* **时间轴排序：** 优先使用 AI 提取的 `event_date`（事件发生时间），如果为空，降级使用 `publish_date`。

---

### 第二部分：生成的 Prompt (可直接发送给大模型)

你可以将以下内容直接复制发送给 CodeBuddy 或其他 AI 开发助手。

```markdown
# Role
你是一名资深的全栈工程师（Expert Full-Stack Engineer），精通 Next.js, Supabase (pgvector), Python 数据处理以及 OpenAI API 开发。

# Context
我们要为全媒体新闻笔记应用 "NewsBox" 开发核心模块 —— **"智能专题 (Smart Topics)"**。
该模块的目标是将用户零散收藏的新闻（文章/视频），通过 AI 自动聚类，整理成结构化的专题（如“2025 CES 展会”），并生成脉络时间轴和总结报告。

# Goal
请根据以下详细的功能需求和技术路径，设计数据库 Schema，并编写核心业务逻辑的代码/伪代码。

---

## 1. 功能需求 (Functional Requirements)

### 1.1 自动聚类 (Auto-Clustering)
- **触发机制：** 设定定时任务（Cron Job），每天夜间执行一次。
- **逻辑：** 1. 获取所有未归类（或新入库）文章的 Embedding 向量。
  2. 使用聚类算法（推荐 DBSCAN，因为不知道具体的专题数量）发现高密度的文章簇。
  3. 对于每个簇：
     - 如果簇中心与现有 Topic 相似度高，则合并。
     - 否则，创建一个新 Topic。
  4. 调用 LLM 为新 Topic 生成简短的**标题**（10字内）和**封面图关键词**。

### 1.2 脉络梳理 (Smart Timeline)
- **逻辑：** 在专题详情页，不单纯按收藏时间排序，而是按“事件发生时间”排序。
- **AI 处理：** 在文章入库时，需要 AI 提取 `event_date` 字段。
- **展示：** 垂直时间轴，左侧显示日期，右侧显示文章摘要卡片。

### 1.3 专题报告 (Topic Report)
- **逻辑：** 用户点击“生成报告”或进入详情页时，实时/预生成该专题的总结。
- **内容：** Markdown 格式，包含“事件背景”、“核心观点”、“当前进展”。

---

## 2. 技术栈 (Tech Stack)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Backend/Edge:** Supabase Edge Functions (TypeScript) 或 Python Worker (用于跑聚类算法)
- **AI Model:** - Embedding: `text-embedding-3-small`
  - Chat: `gpt-4o-mini` (用于命名和总结)

---

## 3. 待执行任务 (Tasks)

请按步骤完成以下输出：

### Step 1: 数据库设计 (SQL)
请编写 Supabase SQL 代码，创建以下表，并包含必要的 RLS 策略和索引：
1. `topics` 表：包含 id, user_id, title, summary, topic_vector (存储簇中心点), created_at。
2. `article_topics` 表：关联表，包含 article_id, topic_id, similarity_score。

### Step 2: 聚类算法逻辑 (Python 伪代码)
请写一段 Python 风格的伪代码，描述核心聚类服务的逻辑：
- 如何从 DB 拉取向量。
- 如何使用 DBSCAN (sklearn) 进行聚类。
- 如何判断是“创建新专题”还是“归入旧专题”。
- 如何调用 OpenAI 生成标题。

### Step 3: 智能时间轴数据结构 (Frontend Interface)
请定义前端 React 组件需要的数据结构 TypeScript Interface。
- 需要考虑 TimelineNode 包含文章的 `event_date`, `title`, `summary`, `source_type` (video/text)。

### Step 4: 边缘函数：生成专题报告 (Edge Function)
请编写一个 Supabase Edge Function (`generate-topic-report`)：
- 输入：`topic_id`
- 逻辑：拉取该 Topic 下的前 20 篇核心文章 -> 拼接 Prompt -> 调用 OpenAI 生成 Markdown 总结 -> 更新回 `topics` 表的 `summary` 字段 -> 返回 Markdown。

---

### 如何使用这个 Prompt？

1. **Step 1 (数据库)**：AI 会先给你 SQL 语句。你在 Supabase 的 SQL Editor 里运行即可建表。
2. **Step 2 (聚类逻辑)**：这是最难的部分。AI 会给出一套逻辑，你可以决定是用 Python 写一个独立的 Microservice，还是尝试用 JS 库在 Edge Function 里硬抗（推荐 Python，计算库更成熟）。
3. **Step 3 & 4**：分别对应前端和 API 开发。
