这是“知识库”的最后一块拼图，也是最“实战”的模块。如果说图谱是用来查阅的地图，那么**“金句素材” (Asset Bank) 就是记者写作时的“弹药库”**。

为了确保这个模块既能复用现有的“批注”逻辑，又能发挥 AI 的提取能力，我为您制定了以下详细的**产品功能规划 (PRD)**。

---

# 产品功能规划书：金句素材 (Asset Bank)

## 1. 核心定位与场景

* **定位：** 写作辅助工具。将非结构化的长文，拆解为结构化的原子素材（观点、数据、描写），供用户在写作时直接调取。
* **核心隐喻：** **“卡片盒” (Zettelkasten)**。每一条数据或金句都是一张独立的知识卡片。

---

## 2. 详细功能模块设计

### 2.1 素材类型与来源

为了统一管理，我们将素材分为三种核心类型：

| 素材类型 | 图标 | 来源 | 定义 |
| --- | --- | --- | --- |
| **金句 (Quotes)** | ❝ | 用户划线 / AI 识别 | 具有修辞美感、哲理深度或代表性观点的原话。 |
| **数据 (Data)** | 📊 | AI 自动提取 | 包含具体数值、单位、时间范围的客观事实（如“2024年Q3营收增长15%”）。 |
| **描写 (Description)** | 👁️ | 用户划线 / AI 识别 | 优质的场景描写、人物刻画段落（适合特稿写作参考）。 |

### 2.2 功能视图设计

#### A. 金句墙 (Quote Wall) —— *灵感视图*

* **布局：** 瀑布流卡片 (Masonry Layout)。
* **展示内容：**
* 大字号展示金句核心文本。
* 底部小字展示出处：《文章标题》· 作者。
* **AI 标签：** 自动打上情感/风格标签（如 #犀利 #反讽 #愿景）。


* **交互：**
* **一键复制：** 鼠标悬停显示“复制”按钮。
* **海报生成：** 点击“分享”，将金句生成一张精美的分享图片（适合发朋友圈/小红书）。



#### B. 数据中心 (Data Grid) —— *事实视图*

这是一个结构化的表格或密集列表，专为查找硬核信息设计。

* **布局：** 表格 (Table) 或 紧凑列表 (Compact List)。
* **字段列：**
* **指标 (Metric):** 如 "GDP", "用户数", "净利润"。
* **数值 (Value):** 如 "5.2%", "10亿"。
* **时间 (Time Scope):** 如 "2023全年"。
* **语境 (Context):** 该数据所在的原始句子（这是为了防止断章取义）。
* **来源 (Source):** 关联的文章链接。



#### C. 引用格式化 (Smart Citation)

在任何素材卡片的“更多”菜单中，提供**“复制为...”**选项：

* **标准引用 (GB/T 7714):** `[1] 作者. 文章标题. 媒体名, 发布时间.`
* **Markdown 脚注:** `[^1]: 引用内容... [文章标题](URL)`
* **社交媒体版:** `“引用内容” —— via @媒体名`

---

## 3. 技术实现路径 (The "How")

这里是您最关心的落地部分。核心在于**“复用”**与**“增量”**。

### 3.1 数据库设计 (Schema Strategy)

我们不需要建立全新的复杂表，而是复用并扩展现有的 `annotations`（批注）表，或者新建一个轻量级的 `extracted_assets` 表。

**建议方案：统一资产表 (`knowledge_assets`)**
这张表同时存储“用户划线”和“AI 提取的数据”。

```sql
create type asset_type as enum ('quote', 'data', 'opinion', 'description');

create table knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  article_id uuid references articles not null,
  
  -- 核心内容
  type asset_type not null, -- 类型：金句/数据/观点
  content text not null, -- 原始内容（文本或 JSON 字符串）
  
  -- 结构化数据字段 (仅当 type='data' 时有值)
  meta_metric text, -- 指标名，如 "Revenue"
  meta_value text, -- 数值，如 "50M"
  meta_date text, -- 时间范围
  
  -- 来源定位
  source_context text, -- 上下文（前后的句子）
  citation_format text, -- 预生成的引用字符串
  
  is_ai_generated boolean default false, -- true=AI提取, false=用户手动
  created_at timestamptz default now()
);

-- 索引优化
create index idx_assets_type on knowledge_assets(type);
create index idx_assets_metric on knowledge_assets using gin(to_tsvector('english', meta_metric)); -- 支持搜指标

```

### 3.2 AI 提取工程 (Prompt Engineering)

这是本模块的灵魂。我们需要在文章入库分析时，增加一个步骤：**Extract Assets**。

**Prompt 设计 (JSON Output):**

```markdown
# Role
你是一个资深的新闻编辑和数据分析师。

# Task
阅读给定的新闻文本，提取其中的“高价值金句”和“关键统计数据”。

# Rules
1. **Quotes (金句):** 提取文中具有洞察力、修辞优美或核心观点的原话。
2. **Data (数据):** 提取文中明确的统计数据、财务数字或增长指标。
3. **Output:** 必须返回标准的 JSON 格式，不要包含 Markdown 标记。

# JSON Structure
{
  "assets": [
    {
      "type": "quote",
      "content": "金句的原话内容...",
      "tags": ["犀利", "预测"]
    },
    {
      "type": "data",
      "content": "2024年Q3营收增长15%",
      "metric": "营收增长率",
      "value": "15%",
      "time_scope": "2024 Q3",
      "context_sentence": "财报显示，公司在2024年Q3营收增长15%，超出市场预期。"
    }
  ]
}

# Input Text
{{article_content}}

```

### 3.3 后端处理流程 (Supabase Edge Function)

1. **Trigger:** 文章入库完成，或用户点击“深度分析”按钮。
2. **Edge Function (`extract-assets`):**
* 调用 OpenAI/DeepSeek API，发送上述 Prompt。
* 接收 JSON 响应。
* 遍历 JSON 数组，将数据插入 `knowledge_assets` 表。
* **去重逻辑：** 插入前检查同一 article_id 下是否已存在相同的 metric/value，避免重复提取。



### 3.4 前端实现细节

* **筛选器 (Filter Bar):**
* UI 组件：Tab 切换 `[全部] [金句] [数据] [观点]`。
* 数据源：直接 `select * from knowledge_assets where type = ?`。


* **全文搜索联动:**
* 当用户在顶部搜索框搜“营收”时，不仅搜文章，还要单独搜 `knowledge_assets` 表，并在结果页顶部优先展示“数据中心”匹配到的卡片。



---

## 4. 差异化亮点 (User Delight)

为了让这个功能超越普通的笔记软件，建议增加以下 **Pro 级细节**：

1. **数据核查 (Fact Check Link):**
* 在“数据卡片”上，提供一个“回溯”按钮。点击后，右侧滑出原文，并自动滚动并高亮该数据所在的段落。这能建立用户对数据的信任感。


2. **金句卡片编辑器:**
* 提供 3-5 个精美的 CSS 模板（极简风、黑金风、报纸风），允许用户将金句一键转为图片下载。这是促进用户进行社交分享（从而带来产品增长）的关键。


3. **写作助手侧边栏 (Copilot Sidebar):**
* 不仅在知识库里看，更要在**“写作模式”**下看。
* 当用户在 NewsBox 里写稿时，右侧可以打开“素材库”。用户输入“马斯克”，右侧自动筛选出所有关于马斯克的金句和数据，点击即可插入编辑器。
