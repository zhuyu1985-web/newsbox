/**
 * ============================================================================
 * Jina Reader API Service (Jina Reader API 服务)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 封装 Jina Reader API 调用，提供高质量的网页内容抓取能力。
 * 相比基础爬虫（fetch + Cheerio），Jina Reader 具有以下优势：
 * - 支持动态加载内容（SPA）
 * - 自动绕过反爬机制
 * - 智能提取正文内容
 * - 过滤广告和噪音
 *
 * API 文档：
 * ---------
 * - 官方网站：https://jina.ai/reader/
 * - API 端点：https://r.jina.ai/{url}
 * - 返回格式：Markdown 或 HTML
 *
 * 使用示例：
 * ---------
 * ```typescript
 * const result = await extractWithJinaReader('https://example.com/article');
 * console.log(result.title);
 * console.log(result.content); // Markdown 格式
 * ```
 *
 * @module lib/services/jina-reader
 */

/**
 * Jina Reader API 响应接口
 */
export interface JinaReaderResult {
  /** 文章标题 */
  title: string;
  /** 文章摘要/描述 */
  description: string;
  /** 文章正文内容（Markdown 格式） */
  content: string;
  /** 原始 URL */
  url: string;
  /** 站点名称（可选） */
  siteName?: string;
  /** 作者（可选） */
  author?: string;
  /** 发布时间（可选） */
  publishedTime?: string;
}

/**
 * Jina Reader API 调用选项
 */
export interface JinaReaderOptions {
  /** 返回格式：markdown 或 html，默认 markdown */
  returnFormat?: 'markdown' | 'html';
  /** 超时时间（秒），默认 15 秒 */
  timeout?: number;
}

/**
 * 调用 Jina Reader API 提取网页内容
 *
 * 功能说明：
 * ---------
 * 1. 验证 API Key 配置
 * 2. 构造请求 URL 和 Headers
 * 3. 发送 GET 请求到 Jina Reader API
 * 4. 解析返回的 JSON 数据
 * 5. 返回结构化的内容数据
 *
 * 错误处理：
 * ---------
 * - API Key 缺失：抛出配置错误
 * - 网络超时：抛出超时错误
 * - API 返回错误：抛出 HTTP 状态错误
 *
 * @param url - 目标网页 URL
 * @param options - 可选配置
 * @returns 提取的内容数据
 * @throws Error 当 API Key 缺失、网络错误或 API 返回错误时
 *
 * @example
 * ```typescript
 * try {
 *   const result = await extractWithJinaReader('https://example.com');
 *   console.log(result.title, result.content);
 * } catch (error) {
 *   console.error('Extraction failed:', error);
 * }
 * ```
 */
export async function extractWithJinaReader(
  url: string,
  options?: JinaReaderOptions
): Promise<JinaReaderResult> {
  // 2.3.1 验证 API Key 配置
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error(
      'JINA_API_KEY is not configured. Please set it in your environment variables.'
    );
  }

  // 设置默认选项
  const returnFormat = options?.returnFormat || 'markdown';
  const timeout = options?.timeout || 15;

  try {
    // 2.3.2 构造 API 请求（URL、Headers、Timeout）
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Return-Format': returnFormat,
        'X-Timeout': timeout.toString(),
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(timeout * 1000), // 毫秒转换
    });

    // 2.4.3 处理 API 返回错误（401/429/500）
    if (!response.ok) {
      let errorMessage = `Jina Reader API error: ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid JINA_API_KEY. Please check your API key configuration.';
      } else if (response.status === 429) {
        errorMessage = 'Jina Reader API rate limit exceeded. Please try again later.';
      } else if (response.status >= 500) {
        errorMessage = 'Jina Reader service is temporarily unavailable. Please try again later.';
      }

      throw new Error(errorMessage);
    }

    // 2.3.3 处理 API 响应并解析 JSON
    const data = await response.json();

    // 2.3.4 返回结构化数据
    return {
      title: data.data?.title || '',
      description: data.data?.description || '',
      content: data.data?.content || '',
      url: data.data?.url || url,
      siteName: data.data?.siteName || undefined,
      author: data.data?.author || undefined,
      publishedTime: data.data?.publishedTime || undefined,
    };
  } catch (error: any) {
    // 2.4.2 网络超时错误
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(
        `Jina Reader API request timeout after ${timeout} seconds. The target website may be slow or unreachable.`
      );
    }

    // 2.4.1 API Key 缺失错误（已在开头处理）
    // 其他网络错误
    console.error('Jina Reader extraction failed:', error);
    throw error;
  }
}

/**
 * 检查 Jina Reader API 是否可用
 *
 * 用途：
 * -----
 * 在应用启动时或定期检查 API 可用性。
 * 可以用于监控和告警。
 *
 * @returns Promise<boolean> API 是否可用
 */
export async function checkJinaReaderAvailability(): Promise<boolean> {
  try {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      return false;
    }

    // 使用一个简单的 URL 测试
    const response = await fetch('https://r.jina.ai/https://example.com', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Return-Format': 'markdown',
        'X-Timeout': '5',
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
