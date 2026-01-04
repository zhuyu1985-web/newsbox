/**
 * AI快照内容生成服务
 * 根据文章内容生成适合卡片展示的结构化数据
 */

export interface SnapshotCardData {
  one_liner: string; // 一句话直击核心
  bullet_points: string[]; // 3点关键摘要
  sentiment: string; // 情绪标签: 🔥 热议 | ⚠️ 预警 | 📈 利好 | 📊 数据 | 💡 深度
  key_stat?: string; // 关键数据或金句
  source_name?: string; // 来源媒体名
  publish_time?: string; // 发布时间
  read_time?: number; // 预估阅读时间（分钟）
}

async function callOpenAIJson(args: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (process.env.OPENAI_MODEL || "gpt-4o").trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
      temperature: args.temperature ?? 0.3,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      detail = await response.text();
    }
    throw new Error(`OpenAI API failed with status ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content;
  if (!resultText) throw new Error("OpenAI API returned empty content");
  return JSON.parse(resultText);
}

/**
 * 生成AI快照卡片数据
 */
export async function generateSnapshotData(args: {
  title?: string | null;
  content: string;
  sourceName?: string | null;
  publishTime?: string | null;
  readTime?: number | null;
}): Promise<SnapshotCardData> {
  const title = (args.title || "").trim();
  const clipped = args.content.substring(0, 15000);

  const system = `你是一位专业的信息设计师与内容策展人。你的任务是将长文章浓缩为一张精美的分享卡片。
这张卡片需要在 5 秒内让读者理解文章核心价值。

你必须输出 JSON（json_object），字段如下：
- one_liner: string（<= 40 字，比标题更辛辣的核心总结，必须能引起共鸣或好奇）
- bullet_points: string[]（恰好 3 条要点，每条 <= 25 字，信息密度高，使用数据和事实）
- sentiment: string（从以下选项中选择最合适的一个：🔥 热议 | ⚠️ 预警 | 📈 利好 | 📉 看跌 | 📊 数据 | 💡 深度 | 🎯 趋势）
- key_stat: string（可选，提取一个最震撼的数据或最犀利的金句，<= 30 字。必须来自原文，不可编造）

约束规则：
1. one_liner 必须有态度、有洞察，避免平淡陈述
2. bullet_points 必须是递进关系或并列维度，形成完整信息结构
3. key_stat 优先选择数据（如"营收增长 50%"），其次选择观点金句
4. 所有内容必须基于原文，不得编造
5. 使用简洁、有力的表达，避免废话`;

  const user = `文章标题：${title || "（无标题）"}
文章内容：\n${clipped}

请提取最核心的信息，生成适合社交分享的快照卡片数据。`;

  const raw = await callOpenAIJson({ system, user, temperature: 0.3 });

  return {
    one_liner: String(raw.one_liner || "").trim() || title || "精选内容",
    bullet_points: Array.isArray(raw.bullet_points)
      ? raw.bullet_points.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 3)
      : [],
    sentiment: String(raw.sentiment || "💡 深度").trim(),
    key_stat: raw.key_stat ? String(raw.key_stat).trim() : undefined,
    source_name: args.sourceName || undefined,
    publish_time: args.publishTime || undefined,
    read_time: args.readTime || undefined,
  };
}
