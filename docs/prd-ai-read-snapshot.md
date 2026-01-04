这是一个非常棒的产品触点。在 NewsBox 这样一款以“深度阅读”和“知识管理”为主的产品中，**“AI 快照” (AI Snapshot)** 承担着**“轻量化消费”**和**“社交货币”**的双重职能。

它不应该只是一段文字摘要，而应该是一张**“由 AI 实时生成的、高美感、高信息密度的分享卡片”**。

以下是针对 NewsBox 的“AI 快照”功能设计规划：

---

### 一、 产品定义与核心价值

* **产品定义：** 将一篇长文章，瞬间浓缩为一张包含核心事实、观点摘要、金句和关键数据的精美图片。
* **核心隐喻：** **“拍立得” (Polaroid)**。定格新闻发生的那一刻，把动态的信息变成静态的资产。
* **用户价值：**
1. **极速获取 (TL;DR)：** 不用读全文，看图就知道发生了什么。
2. **社交炫耀 (Social Currency)：** 极易分享到微信朋友圈、小红书，带有 NewsBox 的品牌水印，通过优质内容带量。
3. **证据留存 (Archive)：** 即使原链接失效，快照依然保存了核心信息。



---

### 二、 功能模块设计 (UI/UX)

#### 1. 入口设计

* **位置：** 阅读页顶部导航栏“原始网页”后的“AI快照”按钮，并且支持在选中文本后出现的浮动菜单中增加“生成快照”按钮。
* **交互特效：** 点击后，屏幕出现类似快门闭合的动画（Shutter Effect）和声效，随后弹出一张生成的卡片预览。

#### 2. 快照卡片结构 (The Card Anatomy)

一张优秀的 AI 快照应包含以下 5 层信息：

* **Header (来源层)：**
* 媒体 LOGO + 媒体名称 (如 "36Kr")。
* 发布时间 & 预估阅读时间。


* **Visual (视觉层)：**
* 文章封面图（经过 AI 裁剪）或 AI 根据内容生成的抽象背景图。


* **Insight (AI 智力层) —— 核心区域：**
* **一句话直击 (One-Liner)：** 比标题更辛辣的核心总结。
* **3 点摘要 (Key Takeaways)：** 列表形式。
* **情绪气泡：** 显示文章情绪（如 🔥 热议、⚠️ 预警、📈 利好）。


* **Data/Quote (高光层)：**
* 自动提取的一个关键数据（如“营收 +50%”）或一句金句，大字号排版。


* **Footer (引流层)：**
* NewsBox 品牌 Logo。
* 二维码（扫码回原文/下载 App）。



#### 3. 模版切换 (Templates)

提供 3 种风格供用户选择：

* **商务简报风 (The Brief)：** 白底黑字，极简，强调信息密度。
* **黑金深邃风 (The Deep)：** 深色模式，适合科技/深度报道，强调沉浸感。
* **社交海报风 (The Social)：** 大图模式，类似于小红书风格，适合情感/生活类新闻。

---

### 三、 技术实现路径 (Next.js + AI)

#### 1. AI 内容生成 (Backend)

复用你现有的 AI 总结能力，但需要专门的 Prompt 来输出适合卡片的短语。

* **Prompt 策略：** 要求 AI 输出 JSON，严格限制字数。
```json
{
  "one_liner": "OpenAI 再次震撼硅谷，Sora 模型重新定义视频生成。",
  "bullet_points": ["支持60秒长视频生成", "物理世界模拟能力惊人", "暂未对公众开放"],
  "sentiment": "Shocking",
  "key_stat": "60s Video"
}

```



#### 2. 图片生成技术 (Frontend/Edge)

鉴于你使用的是 **Next.js**，强烈推荐使用 **Vercel Satori**。这是目前最先进的方案，它允许你**用写 HTML/CSS 的方式来画图**，然后转换成 SVG/PNG。

* **方案优势：**
* **速度快：** 比传统的 Puppeteer 截图快 10 倍。
* **可编程：** 完全用 React 组件来写卡片布局。
* **后端生成：** 在 Edge Function 里生成，不依赖用户手机性能。


* **流程：**
1. 前端请求 `/api/snapshot?articleId=xxx`。
2. API 调用 LLM 获取总结 JSON。
3. API 使用 `satori` + `resvg` 将 JSON + React Template 渲染为 PNG 图片。
4. 返回图片 URL 给前端展示。



---

### 四、 详细开发 Prompt (可直接发给 AI)

你可以直接使用下面的 Prompt 让 CodeBuddy 帮你生成核心代码：

```markdown
# Role
你是一个 Next.js 全栈专家，精通 `vercel/og`, `satori` 和 AI 接口集成。

# Task
我们要为 NewsBox 开发“AI 新闻快照”功能。请基于 Next.js App Router 实现一个 API Route，用于动态生成新闻分享卡片图片。

# Requirements

1. **Tech Stack**:
   - Next.js App Router (`app/api/og/route.tsx`)
   - `next/og` (基于 Satori)
   - OpenAI/DeepSeek API (用于生成卡片内容)

2. **Functionality**:
   - 接收 `title`, `content` (或 article_id) 作为输入。
   - **Step 1 (AI Process)**: 调用 LLM 总结文章，要求返回 JSON：包含 `summary_3_points` (数组), `one_liner` (金句), `sentiment_emoji`。
   - **Step 2 (Image Gen)**: 使用 `ImageResponse` (next/og) 渲染一张 1200x1920 (竖屏 9:16) 的图片。
   - **Visual Style**:
     - 背景色：深色渐变 (#1a1a1a)。
     - 布局：顶部放 Title，中间放 AI 总结的 3 个点（使用 Flexbox 布局），底部放 NewsBox Logo 和二维码占位符。
     - 字体：使用系统无衬线字体。

3. **Output**:
   - 请提供 `app/api/snapshot/route.tsx` 的完整代码。
   - 请包含 AI Prompt 的设计。

# Constraints
- 确保处理 AI 请求超时的情况（Satori 有执行时间限制，可能需要将 AI 处理和图片生成拆分，这里先写在一起作为 MVP）。
- 代码需包含 TypeScript 类型定义。

```

---

### 五、 差异化亮点建议

为了让 NewsBox 的快照脱颖而出：

1. **“关联知识”彩蛋：**
如果在“知识库”中该新闻属于某个“智能专题”（如 CES 2025），在快照右上角自动打上 **#CES 2025** 的标签。这体现了 NewsBox 的知识库属性。
2. **记者视角 (Reporter's Note)：**
允许用户在生成快照前，手动输入一句自己的点评，这句点评会以“手写体”字体印在卡片下方。
