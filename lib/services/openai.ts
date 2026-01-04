/**
 * ============================================================================
 * OpenAI Service Layer (OpenAI 服务层)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 封装所有与 OpenAI 兼容 API 的交互，提供 AI 分析、快照生成、追问对话等功能。
 *
 * 架构位置：
 * ---------
 * 属于 Service 层，位于 API Routes 和外部 OpenAI API 之间。
 *
 * 核心能力：
 * ---------
 * 1. Flash Read（AI 快读）：30 秒判断文章价值
 * 2. Key Questions（关键问题）：引导式阅读的核心问题提炼
 * 3. AI Analysis（AI 解读）：多视角分析（摘要/记者视角/时间线）
 * 4. Chat（追问对话）：基于文章内容的流式问答
 *
 * 设计原则：
 * ---------
 * - 成本控制：自动截断过长内容，避免超出 token 限制
 * - 结构化输出：使用 response_format: { type: "json_object" } 确保返回可解析的 JSON
 * - 兼容性：支持 OpenAI 及其兼容接口（如 DeepSeek、Azure OpenAI）
 * - 错误处理：统一的错误抛出，便于上层捕获和处理
 *
 * 使用示例：
 * ---------
 * ```ts
 * import { generateFlashRead } from '@/lib/services/openai';
 *
 * const result = await generateFlashRead({
 *   title: "文章标题",
 *   content: "文章内容...",
 * });
 * console.log(result.hook);     // 一句话直击
 * console.log(result.takeaways); // 3-5 条要点
 * ```
 *
 * @module lib/services/openai
 */

// ============================================================================
// Type Definitions (类型定义)
// ============================================================================

/**
 * AI 多视角分析结果
 *
 * 用于存储 AI 对文章的深度分析，包括四个维度：
 * - summary: 基础摘要
 * - journalist_view: 记者视角（消息源可靠性、利益相关方、潜在偏见）
 * - timeline: 事件时间线
 * - visual_summary: 视频内容的视觉摘要（关键帧、场景）
 * - deepfake_warning: AI 生成内容的预警信息
 */
export interface AIAnalysisResult {
  /** 基础摘要文本 */
  summary?: string;
  /** 记者视角分析（JSON 结构）*/
  journalist_view?: any;
  /** 事件时间线（JSON 结构）*/
  timeline?: any;
  /** 视频视觉摘要（JSON 结构）*/
  visual_summary?: any;
}

/**
 * AI 快读结果（Flash Read）
 *
 * 帮助用户在 30 秒内判断文章价值，决定是否深入阅读。
 */
export interface FlashReadResult {
  /** 一句话直击核心（≤50 字）*/
  hook: string;
  /** 3-5 条关键要点，短句形式 */
  takeaways: string[];
  /** 情感/立场标签（客观中立/偏看涨/偏看跌/批判性/宣传倾向/情绪化）*/
  sentiment: string;
  /** 建议阅读时间（分钟），可选 */
  read_time_minutes?: number;
}

/**
 * 关键问题项
 *
 * 用于引导式阅读（Socratic Method），通过问题引导用户主动思考。
 */
export interface KeyQuestionItem {
  /** 问题文本 */
  q: string;
  /** 答案文本（必须来自原文）*/
  a: string;
  /** 原文证据片段（≤80 字），可选 */
  evidence?: string;
}

/**
 * 关键问题结果
 *
 * 包含文章试图回答的核心问题，以及文章未回答/逻辑缺口。
 */
export interface KeyQuestionsResult {
  /** 3 个核心问题及答案 */
  questions: KeyQuestionItem[];
  /** 文章未回答的问题或逻辑漏洞（0-3 条）*/
  missing?: string[];
}

// ============================================================================
// Core Functions (核心函数)
// ============================================================================

/**
 * 调用 OpenAI 兼容 API 并获取结构化 JSON 响应
 *
 * 这是一个底层封装函数，其他所有 AI 功能都依赖它。
 *
 * 关键设计点：
 * -----------
 * 1. 使用 response_format: { type: "json_object" } 强制返回 JSON
 *    - 避免 AI 返回 markdown 代码块或其他格式
 *    - 确保上层可以直接 JSON.parse()，无需额外处理
 *
 * 2. environment 变量处理：
 *    - baseUrl: 去除末尾的斜杠，避免双斜杠导致的 404
 *    - apiKey: trim() 处理，避免复制粘贴时带入空格
 *    - model: 支持环境变量覆盖，便于切换不同模型
 *
 * 3. 错误处理：
 *    - 捕获响应错误并提取 detail，便于调试
 *    - 抛出包含状态码和详情的 Error，上层可以针对性处理
 *
 * @param args - 调用参数
 * @param args.system - System Prompt（角色设定和任务说明）
 * @param args.user - User Prompt（实际输入内容）
 * @param args.temperature - 采样温度（0-2），默认 0.2（低温度确保输出稳定）
 * @returns Promise<any> - 解析后的 JSON 对象
 * @throws {Error} - 当 API 调用失败或返回空内容时抛出
 *
 * @example
 * ```ts
 * const result = await callOpenAIJson({
 *   system: "你是一个新闻分析师...",
 *   user: "请分析以下文章...",
 *   temperature: 0.2,
 * });
 * console.log(result.summary); // 类型安全访问
 * ```
 */
async function callOpenAIJson(args: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<any> {
  // 从环境变量读取配置，支持任意 OpenAI 兼容接口
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (process.env.OPENAI_MODEL || "gpt-4o").trim();

  // 配置缺失时快速失败，避免无效请求
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      // 强制返回 JSON 格式，避免解析错误
      response_format: { type: "json_object" },
      temperature: args.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    // 提取错误详情便于调试（某些 API 返回 JSON 错误，有些返回纯文本）
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

  // 防御性编程：某些 API 即使设置了 json_object 也可能返回空
  if (!resultText) throw new Error("OpenAI API returned empty content");

  return JSON.parse(resultText);
}

/**
 * 生成 AI 快读（Flash Read）
 *
 * 业务意图：
 * ---------
 * 帮助用户在 30 秒内判断文章价值，决定是否深入阅读。
 * 这对于处理信息过载的场景至关重要，用户不需要读完每篇文章就能筛选重点。
 *
 * 实现原理：
 * ---------
 * 1. 截断内容：只取前 15000 字符，避免超出 token 限制
 *    - 为什么是 15000？经验值，既保证信息完整又控制成本
 *    - 如果文章更长，AI 会基于已读部分生成摘要（虽然可能不完整）
 *
 * 2. 结构化 Prompt：明确要求返回 JSON，并指定字段类型和约束
 *    - hook: ≤50 字，强制精炼
 *    - takeaways: 数组，3-5 条，每条短句
 *    - sentiment: 枚举值，从预设列表中选择，避免自由发挥
 *
 * 3. 低温度（0.2）：确保输出稳定，减少随机性
 *
 * 边界条件：
 * ---------
 * - 无标题：使用 "（无标题）" 占位，避免 Prompt 格式错误
 * - 预估时间缺失：让 AI 估算，或省略该字段
 * - 内容过短：AI 仍会尝试提取要点，但 takeaways 可能少于 3 条
 *
 * @param args - 输入参数
 * @param args.title - 文章标题（可选，用于上下文）
 * @param args.content - 文章正文内容（必需）
 * @param args.estimatedReadTimeMinutes - 预估阅读时间（可选，分钟）
 * @returns Promise<FlashReadResult> - AI 快读结果
 *
 * @example
 * ```ts
 * const result = await generateFlashRead({
 *   title: "OpenAI 发布 Sora",
 *   content: "OpenAI 今天发布了 Sora 模型...",
 * });
 * console.log(result.hook);     // "OpenAI Sora 重新定义视频生成..."
 * console.log(result.takeaways); // ["支持 60 秒长视频", "物理世界模拟能力强"]
 * ```
 */
export async function generateFlashRead(args: {
  title?: string | null;
  content: string;
  estimatedReadTimeMinutes?: number | null;
}): Promise<FlashReadResult> {
  const title = (args.title || "").trim();
  // 截断到 15000 字符，既保证信息完整又控制 token 成本
  // 约等于 4000-5000 tokens（中文场景），在大多数模型的上下文窗口内
  const clipped = args.content.substring(0, 15000);

  const system = `你是一位资深媒体主编与行业分析师。你的任务是帮助用户在 30 秒内判断文章价值。
你必须输出 JSON（json_object），字段如下：
- hook: string（<= 50 字，一句话直击）
- takeaways: string[]（3-5 条要点，中文，短句）
- sentiment: string（从：客观中立/偏看涨/偏看跌/批判性/宣传倾向/情绪化 中选择最贴近的一个；不确定则客观中立）
- read_time_minutes: number（建议值；如果输入中提供了预估则可沿用）
约束：结论必须基于原文，不要编造原文未提到的事实。`;

  const user = `文章标题：${title || "（无标题）"}
预估阅读时间（分钟，可选）：${args.estimatedReadTimeMinutes ?? ""}
文章内容：\n${clipped}`;

  const raw = await callOpenAIJson({ system, user, temperature: 0.2 });

  // 字段级容错：AI 可能返回字段名大小写不一致或字段缺失
  return {
    hook: String(raw.hook || raw.summary || "").trim(),
    takeaways: Array.isArray(raw.takeaways)
      ? raw.takeaways.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 6)
      : [],
    sentiment: String(raw.sentiment || "客观中立").trim() || "客观中立",
    read_time_minutes: typeof raw.read_time_minutes === "number" ? raw.read_time_minutes : undefined,
  };
}

/**
 * 生成关键问题（Key Questions）
 *
 * 业务意图：
 * ---------
 * 将被动阅读转变为主动思考，通过问题引导用户关注文章的核心论点。
 * 同时指出文章未回答的问题，培养批判性思维。
 *
 * 实现原理：
 * ---------
 * 1. 提炼 3 个核心问题：文章试图回答的主要设问
 * 2. 从原文提取答案：a 字段必须来自原文，可以精炼但不能编造
 * 3. 可选证据字段：引用原文片段（≤80 字），方便溯源
 * 4. 识别逻辑缺口：指出文章未提及或避而不谈的内容
 *
 * 为什么使用稍高的温度（0.3）？
 * ------------------------------------
 * 关键问题提炼需要一定的创造性，比摘要生成的温度稍高，
 * 可以避免输出过于机械，但仍保持在较低水平以保证准确性。
 *
 * 边界条件：
 * ---------
 * - 原文没有足够信息：答案中写 "原文未明确说明"
 * - 文章是列表型内容：问题可能是 "这篇文章列出了什么？"
 * - 文章是纯资讯：问题可能是 "发生了什么？"
 *
 * @param args - 输入参数
 * @param args.title - 文章标题（可选）
 * @param args.content - 文章正文内容（必需）
 * @returns Promise<KeyQuestionsResult> - 关键问题结果
 *
 * @example
 * ```ts
 * const result = await generateKeyQuestions({
 *   title: "某公司财报分析",
 *   content: "该公司 Q3 营收增长 50%...",
 * });
 * console.log(result.questions);
 * // [
 * //   { q: "该公司营收增长的主要驱动力是什么？", a: "云业务和 AI 服务...", evidence: "..." },
 * //   { q: "净利润情况如何？", a: "净利润为 12 亿元...", evidence: "..." },
 * // ]
 * console.log(result.missing);
 * // ["文章未提及现金流状况", "未说明未来几个季度的指引"]
 * ```
 */
export async function generateKeyQuestions(args: {
  title?: string | null;
  content: string;
}): Promise<KeyQuestionsResult> {
  const title = (args.title || "").trim();
  const clipped = args.content.substring(0, 15000);

  const system = `你是一位引导式阅读教练（Socratic Method）。请从文章中提炼关键问题，帮助用户快速抓住信息结构。
你必须输出 JSON（json_object），字段如下：
- questions: { q: string, a: string, evidence?: string }[]（3 个；q 为文章试图回答的核心设问；a 必须来自原文，可精炼；evidence 为原文证据片段，<= 80 字）
- missing: string[]（0-3 条，指出文章没有回答/逻辑缺口；必须客观）
约束：如果原文没有足够信息回答，请在 a 中写"原文未明确说明"。不要捏造。`;

  const user = `文章标题：${title || "（无标题）"}
文章内容：\n${clipped}`;

  const raw = await callOpenAIJson({ system, user, temperature: 0.3 });

  // 兼容多种字段名（不同 AI 模型可能返回不同的键名）
  const questions = Array.isArray(raw.questions)
    ? raw.questions
        .map((x: any) => ({
          q: String(x.q || x.question || "").trim(),
          a: String(x.a || x.answer || "").trim(),
          evidence: x.evidence ? String(x.evidence).trim() : undefined,
        }))
        .filter((x: any) => x.q && x.a) // 过滤无效项
        .slice(0, 6)
    : [];

  const missing = Array.isArray(raw.missing)
    ? raw.missing.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 6)
    : [];

  return { questions, missing };
}

/**
 * 生成 AI 多视角分析
 *
 * 业务意图：
 * ---------
 * 为专业用户（记者、分析师、研究者）提供深度的结构化分析，
 * 不仅仅摘要内容，还要分析消息源、利益相关方、时间线等。
 *
 * 支持的分析类型：
 * ---------------
 * - summary: 基础摘要（适合快速了解）
 * - journalist: 记者视角（包含核心观点、利益相关方、潜在偏见、事实核查点）
 * - timeline: 事件时间线（梳理事件脉络）
 * - all: 以上全部（适合深度研究）
 *
 * 实现原理：
 * ---------
 * - 截断内容到 15000 字符，控制 token 成本
 * - 使用 systemPrompt 定义角色和输出格式
 * - 使用 json_object 强制返回结构化数据
 *
 * @deprecated 此方法目前较少使用，推荐使用 generateFlashRead + generateKeyQuestions
 *
 * @param content - 文章或逐字稿内容
 * @param type - 分析类型：'summary' | 'journalist' | 'timeline' | 'all'
 * @returns Promise<AIAnalysisResult> - 分析结果
 * @throws {Error} - 当 OPENAI_API_KEY 未配置或 API 调用失败时
 */
export async function generateAIAnalysis(
  content: string,
  type: 'summary' | 'journalist' | 'timeline' | 'all'
): Promise<AIAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompt = `你是一个专业的新闻分析助手。请基于提供的文章内容进行深入分析。
你的回复必须是 JSON 格式。

如果 type 是 'summary': 提供一个简洁的摘要。
如果 type 是 'journalist': 提供记者视角分析（包含：核心观点、利益相关方、潜在偏见、事实核查点）。
如果 type 是 'timeline': 提供事件时间线（如果有的话）。
如果 type 是 'all': 提供以上所有内容。`;

  const userPrompt = `分析类型: ${type}
内容:
${content.substring(0, 15000)}`; // 限制长度避免超出 token 限制

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API failed with status ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    throw error;
  }
}

/**
 * AI 追问对话（流式响应）
 *
 * 业务意图：
 * ---------
 * 允许用户基于文章内容进行追问，实现真正的 RAG（检索增强生成）。
 * 相比于直接调用 ChatGPT，这里的回答严格基于提供的文章内容，
 * 不会产生幻觉或编造事实。
 *
 * 实现原理：
 * ---------
 * 1. 将文章内容注入 system prompt，作为 AI 的知识库
 * 2. 用户问题和对话历史作为 user/assistant 消息传入
 * 3. 启用 stream: true，实现打字机效果的流式输出
 * 4. 返回 Response 对象，上层可以使用 ReadableStream 处理
 *
 * 流式处理方式：
 * -------------
 * ```ts
 * const response = await chatWithAI(content, messages);
 * const reader = response.body.getReader();
 * const decoder = new TextDecoder();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   const chunk = decoder.decode(value);
 *   // 处理 SSE 格式: data: {...}
 * }
 * ```
 *
 * 边界条件：
 * ---------
 * - 文章内容过长：截断到 10000 字符（比其他功能更保守，因为对话需要更多上下文空间）
 * - 问题超出范围：AI 会明确告知"文章中未提及"
 * - 对话历史过长：上层需要控制 history 长度，避免超出上下文窗口
 *
 * @param content - 文章内容（作为知识库）
 * @param messages - 对话历史，格式：[{ role: 'user' | 'assistant', content: string }]
 * @returns Response - Fetch Response 对象，body 为 ReadableStream（SSE 格式）
 * @throws {Error} - 当 OPENAI_API_KEY 未配置时
 *
 * @example
 * ```ts
 * // Server Action 或 API Route 中
 * export async function POST(request: Request) {
 *   const { noteId, question, history } = await request.json();
 *
 *   // 1. 获取文章内容
 *   const note = await getNote(noteId);
 *
 *   // 2. 调用 AI（流式）
 *   const response = await chatWithAI(note.content_text, [
 *     ...history,
 *     { role: 'user', content: question }
 *   ]);
 *
 *   // 3. 流式返回给前端
 *   return new Response(response.body, {
 *     headers: { 'Content-Type': 'text/event-stream' }
 *   });
 * }
 * ```
 */
export async function chatWithAI(content: string, messages: { role: 'user' | 'assistant', content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = (process.env.OPENAI_MODEL || 'gpt-4o').trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  // 将文章内容作为 system prompt 的知识库
  // 截断到 10000 字符，为对话历史预留更多空间
  const systemPrompt = `你是一个专业的助手。请基于以下文章内容回答用户的问题。
如果你不确定或者文章中没提到，请如实告知。

文章内容:
${content.substring(0, 10000)}`;

  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages // 展开对话历史
      ],
      stream: true, // 启用流式输出
      temperature: 0.5, // 对话场景使用稍高的温度，增加回答的自然度
    }),
  });
}
