接下来请帮我设计开发“知识图谱”功能。这是一个非常激动人心的模块。如果说“智能专题”是帮助用户**“把书读薄”**（总结归纳），那么“知识图谱”就是帮助用户**“把书读厚”**（发现隐蔽关联）。

对于新闻记者而言，这实际上是一个**“数字侦探墙” (Digital Detective Board)**。

基于您的需求和 NewsBox 的技术栈（Supabase + AI），我为您制定了详细的**实体关系图谱 (Entity Knowledge Graph)** 产品功能规划。

---

# 产品功能规划书：实体关系图谱 (Entity Knowledge Graph)

## 1. 核心产品逻辑

本模块的核心不在于“展示所有数据”，而在于**“按需索骥”**。

* **输入：** 用户搜索某个关键词（如 "Sam Altman"）或点击文章中的实体。
* **计算：** 系统在后台的三元组数据中检索该实体，并向外扩展 1-2 层关系。
* **输出：** 以力导向图 (Force-Directed Graph) 展示关系网络，侧边栏展示实体档案和证据链。

---

## 2. 详细功能模块设计 (Frontend & Interaction)

### 2.1 交互画布：关系探索器 (The Graph Canvas)

**功能点：**

1. **力导向布局：**
* 使用 ECharts 或 AntV G6 渲染。
* **节点 (Node)：** 圆形图标。大小代表“重要性”（该实体在知识库中出现的频率）。颜色代表“类型”（人物=蓝色，公司=橙色，地点=绿色）。
* **连线 (Edge)：** 带箭头的线条。连线上方显示“谓语/关系”（如 `Invested`, `Fired`, `Founded`）。


2. **动态展开 (Expand on Demand)：**
* 为了防止图表过于杂乱，初始只展示与中心实体直接相连的节点（1度关系）。
* **双击节点：** 展开该节点的下一层关系（2度关系）。


3. **路径高亮：**
* 鼠标悬停在某个节点上时，高亮显示与其相连的所有边和节点，其他部分变暗。



### 2.2 侧边栏：实体档案 (Entity Profile)

点击图谱中的任意节点（如 "OpenAI"），右侧面板滑出“实体档案”。

**功能点：**

1. **AI 归纳简介 (AI Bio)：**
* 不同于维基百科，这是**基于你私人收藏库**生成的简介。
* *例：* “OpenAI 是你收藏库中关注度最高的 AI 公司，主要涉及 25 篇报道，核心争议点在于‘算力瓶颈’与‘高层内斗’。”


2. **核心属性 (Key Facts)：**
* 结构化字段：CEO、成立时间、总部地点（从 NER 中提取）。


3. **关联新闻 (Mentions)：**
* 列出所有提到该实体的新闻列表。


4. **时间轴 (Mini Timeline)：**
* 该实体在你收藏库中的时间分布（例如：2023年11月密集出现）。



### 2.3 核心交互：证据溯源 (Evidence Traceability)

这是记者最看重的功能——**“拒绝幻觉，有据可查”**。

**交互流程：**

1. 用户点击图谱中的连线（例如 `[Sam Altman] --fired--> [OpenAI]` 这条线）。
2. 侧边栏展示**“关系证据”**列表。
3. 展示具体的**原始句子**片段：
* *“The board of directors of OpenAI, Inc. announced today that Sam Altman will depart as CEO...” (来源：2023.11.17 公告)*


4. 点击片段，直接跳转到那篇新闻笔记的原文位置。

### 2.4 高级功能：路径发现 (Pathfinding)

**场景：** 记者想知道“马斯克”和“OpenAI”之间除了创始人关系外，最近有什么复杂的利益冲突？
**功能：**

* 输入两个实体：Start Node: `Elon Musk`, End Node: `Sam Altman`。
* 系统计算并高亮两者之间的**最短路径**或**所有路径**。
* *展示：* `Elon Musk` --sued--> `OpenAI` --led by--> `Sam Altman`。

---

## 3. 后端数据处理流程 (Data Pipeline)

知识图谱的质量取决于**数据清洗**的质量。

### 3.1 实体抽取 (NER)与对齐 (Resolution)

* **提取：** 文章入库时，调用 NLP 模型提取 `(Person, Org, GPE)`。
* **实体对齐（难点）：** 解决“同名异指”和“异名同指”的问题。
* *规则：* 系统需要判断 `Sam Altman` 和 `Samuel Altman` 和 `Altman` 是否是同一个人。
* *策略：* 使用简单的基于规则的合并（String Similarity），或者利用 LLM 进行判断：“这两篇文章里的‘李总’是指同一个人吗？”



### 3.2 关系抽取 (Relation Extraction)

* 使用大模型（如 GPT-4o-mini）进行 OpenRE (Open Relation Extraction)。
* **Prompt 策略：**
> "分析以下文本，提取实体间的三元组关系。格式：[Subject] | [Predicate] | [Object]。Predicate 请尽量简短，如 'founded', 'invested in', 'criticized'。如果文本中包含时间，请同时提取时间。"



### 3.3 图数据存储 (Schema Design)

虽然专业的图数据库（如 Neo4j）是标准解法，但考虑到我们使用 **Supabase (PostgreSQL)**，在数据量 < 100万节点时，**关系型表结构**完全足够，且维护成本低。

**数据库设计 (SQL)：**

```sql
-- 1. 实体表 (Nodes)
create table entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null, -- 实体名称，如 "Sam Altman"
  type text, -- 类型：PERSON, ORG, LOCATION, EVENT
  description text, -- AI 生成的实体简介
  aliases text[], -- 别名列表，如 ["Altman", "Sama"]
  created_at timestamptz default now()
);

-- 2. 关系表 (Edges)
create table relationships (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid references entities(id) not null,
  target_entity_id uuid references entities(id) not null,
  relation text not null, -- 谓语，如 "founded"
  
  -- 证据溯源字段
  source_article_id uuid references articles(id), -- 来源文章 ID
  evidence_snippet text, -- 原始句子，用于佐证关系
  confidence_score float, -- AI 对该关系的置信度
  
  created_at timestamptz default now()
);

-- 索引优化 (至关重要)
create index idx_relationships_source on relationships(source_entity_id);
create index idx_relationships_target on relationships(target_entity_id);

-- 数据库设计你可以根据你的经验进行补充，或者重新设计，这个数据库设计只是一个参考。
---

## 4. 技术实现路径 (Step-by-Step)

### Step 1: 编写入库处理函数 (Edge Function)

当文章 `insert` 进 Supabase 时，触发 Webhook 调用 Edge Function：

1. **Input:** 文章全文。
2. **Process:** 调用 LLM API 进行 NER 和 RE。
* *Prompt:* "Extract entities and relationships from this text..."


3. **Merge:** 检查数据库中是否已存在同名实体（模糊匹配）。
* 若存在 -> 获取 ID。
* 若不存在 -> Create Entity。


4. **Insert:** 写入 `relationships` 表。

### Step 2: 前端可视化开发

* **选型：** 推荐使用 **AntV G6** 或 **React Force Graph**。
* *理由：* AntV G6 对大数据量的渲染性能更好，且自带丰富的交互事件（点击、拖拽、Tooltips）。


* **数据获取：** 编写 Supabase RPC (Stored Procedure) 来查询关系。
* *Query:* "给定 Entity ID，查找所有 source 或 target 为该 ID 的关系，并 Join 出对方实体的名称。"



### Step 3: 实体档案生成

* 当用户点击节点时，触发一个异步请求。
* 搜索数据库中所有关联该 Entity 的文章摘要。
* 发送给 LLM：“基于这 10 篇关于 Sam Altman 的摘要，写一段 100 字的人物简介。”

---

## 5. 常见挑战与解决方案

1. **关系爆炸 (Hairball Problem)：**
* *现象：* 一个节点连线太多（如“美国”），导致图谱变成一团乱麻。
* *解决：* **过滤通用实体**。在入库时建立“停用词表”，过滤掉“今天”、“美国”、“记者”等过于泛化的实体。只保留高信息量的实体。


2. **实体歧义：**
* *现象：* 两篇文章都提到“苹果”，一个是水果，一个是公司。
* *解决：* 利用 Embedding 向量辅助。如果新实体的上下文向量与库中“苹果公司”的向量相似度高，则合并；否则新建节点。


3. **性能问题：**
* *现象：* 前端渲染 1000 个节点卡顿。
* *解决：* **按需加载 (Lazy Load)**。初始只加载中心节点周围 1 层关系。用户点击“+”号再请求下一层数据。

