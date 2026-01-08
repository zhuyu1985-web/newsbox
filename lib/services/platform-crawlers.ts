/**
 * ============================================================================
 * Platform-Specific Web Crawlers (平台特定爬虫服务)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 为主流新闻平台提供定制化的内容抓取逻辑，确保高质量的内容提取。
 * 支持的平台：
 * - 腾讯新闻 (news.qq.com)
 * - 微信公众号 (mp.weixin.qq.com)
 * - 今日头条 (toutiao.com)
 *
 * 优先级：
 * ---------
 * 1. 平台特定爬虫（本模块）
 * 2. Jina Reader API（通用方案）
 * 3. 基础爬虫（fetch + Cheerio）
 *
 * @module lib/services/platform-crawlers
 */

import * as cheerio from "cheerio";

/**
 * 平台爬虫返回的结果接口
 */
export interface PlatformCrawlResult {
  /** 文章标题 */
  title: string;
  /** 文章摘要/描述 */
  description?: string;
  /** 文章正文 HTML */
  contentHtml: string;
  /** 文章正文纯文本 */
  contentText: string;
  /** 站点名称 */
  siteName: string;
  /** 作者 */
  author?: string;
  /** 发布时间（ISO 8601 格式） */
  publishedAt?: string;
  /** 封面图片 URL */
  coverImageUrl?: string;
}

/**
 * 支持的平台类型
 */
export type SupportedPlatform = "tencent" | "weixin" | "toutiao" | "unknown";

/**
 * 检测 URL 所属的平台
 *
 * @param url - 目标 URL
 * @returns 平台类型
 */
export function detectPlatform(url: string): SupportedPlatform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("news.qq.com")) {
      return "tencent";
    }
    if (hostname.includes("mp.weixin.qq.com")) {
      return "weixin";
    }
    if (hostname.includes("toutiao.com")) {
      return "toutiao";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 解析时间字符串为 ISO 8601 格式
 *
 * 支持的格式：
 * - "2026-01-08 12:34:56"
 * - "2026年01月08日 12:34"
 * - "01-08 12:34"（当年）
 * - 时间戳
 *
 * @param timeStr - 时间字符串
 * @returns ISO 8601 格式的时间字符串，或 undefined
 */
function parsePublishTime(timeStr: string | undefined): string | undefined {
  if (!timeStr) return undefined;

  try {
    const cleaned = timeStr.trim();

    // 匹配 "2026-01-08 12:34:56" 或 "2026/01/08 12:34:56"
    const iso1 = cleaned.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (iso1) {
      const [_, year, month, day, hour, minute, second = "00"] = iso1;
      return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+08:00`).toISOString();
    }

    // 匹配 "2026年01月08日 12:34"
    const cn = cleaned.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2})/);
    if (cn) {
      const [_, year, month, day, hour, minute] = cn;
      return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+08:00`).toISOString();
    }

    // 匹配 "01-08 12:34"（当年）
    const shortDate = cleaned.match(/(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
    if (shortDate) {
      const [_, month, day, hour, minute] = shortDate;
      const currentYear = new Date().getFullYear();
      return new Date(`${currentYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+08:00`).toISOString();
    }

    // 尝试直接解析（兜底）
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return undefined;
  } catch (error) {
    console.warn("Failed to parse publish time:", timeStr, error);
    return undefined;
  }
}

/**
 * 爬取腾讯新闻
 *
 * DOM 结构：
 * - 标题: <h1 id="article-title">
 * - 正文: <div id="article-content">
 * - 作者/时间: <div id="article-author">
 *
 * @param html - HTML 内容
 * @returns 解析结果
 */
function crawlTencentNews(html: string): PlatformCrawlResult | null {
  try {
    const $ = cheerio.load(html);

    // 提取标题
    const title = $("#article-title").text().trim();
    if (!title) {
      console.warn("Tencent News: Title not found");
      return null;
    }

    // 提取正文
    const contentDiv = $("#article-content");
    if (contentDiv.length === 0) {
      console.warn("Tencent News: Content div not found");
      return null;
    }

    // 清理内容：移除脚本、样式、广告
    contentDiv.find("script, style, .ad, .advertisement").remove();
    const contentHtml = contentDiv.html() || "";
    const contentText = contentDiv.text().trim();

    // 提取作者和发布时间
    let author: string | undefined;
    let publishedAt: string | undefined;

    const authorDiv = $("#article-author");
    if (authorDiv.length > 0) {
      const authorText = authorDiv.text();

      // 尝试提取作者（常见格式："作者：张三"）
      const authorMatch = authorText.match(/作者[：:]\s*([^\s]+)/);
      if (authorMatch) {
        author = authorMatch[1];
      }

      // 尝试提取发布时间
      const timeMatch = authorText.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)/);
      if (timeMatch) {
        publishedAt = parsePublishTime(timeMatch[1]);
      }
    }

    // 提取封面图片
    const coverImageUrl = $("meta[property='og:image']").attr("content") ||
                         $("#article-content img").first().attr("src") ||
                         undefined;

    // 生成摘要
    const description = contentText.substring(0, 200);

    return {
      title,
      description,
      contentHtml,
      contentText,
      siteName: "腾讯新闻",
      author,
      publishedAt,
      coverImageUrl,
    };
  } catch (error) {
    console.error("Failed to crawl Tencent News:", error);
    return null;
  }
}

/**
 * 爬取微信公众号
 *
 * DOM 结构：
 * - 标题: <h1 class="rich_media_title" id="activity-name">
 * - 作者/时间: <div id="meta_content" class="rich_media_meta_list">
 * - 正文: <div id="js_content">
 *
 * 注意：
 * - 微信公众号图片有防盗链，需要添加 referrerpolicy="no-referrer"
 *
 * @param html - HTML 内容
 * @returns 解析结果
 */
function crawlWeixinArticle(html: string): PlatformCrawlResult | null {
  try {
    const $ = cheerio.load(html);

    // 提取标题
    const title = $("#activity-name").text().trim() ||
                 $("h1.rich_media_title").text().trim();
    if (!title) {
      console.warn("Weixin Article: Title not found");
      return null;
    }

    // 提取正文
    const contentDiv = $("#js_content");
    if (contentDiv.length === 0) {
      console.warn("Weixin Article: Content div not found");
      return null;
    }

    // 清理内容：移除脚本、样式
    contentDiv.find("script, style").remove();

    // **关键处理：为所有图片添加 referrerpolicy="no-referrer"**
    contentDiv.find("img").each((_, img) => {
      const $img = $(img);
      $img.attr("referrerpolicy", "no-referrer");

      // 处理微信的 data-src 延迟加载
      const dataSrc = $img.attr("data-src");
      if (dataSrc && !$img.attr("src")) {
        $img.attr("src", dataSrc);
      }
    });

    const contentHtml = contentDiv.html() || "";
    const contentText = contentDiv.text().trim();

    // 提取作者和发布时间
    let author: string | undefined;
    let publishedAt: string | undefined;

    const metaDiv = $("#meta_content, .rich_media_meta_list");
    if (metaDiv.length > 0) {
      const metaText = metaDiv.text();

      // 提取作者
      const authorMatch = metaText.match(/作者[：:]\s*([^\s]+)/) ||
                         metaText.match(/^([^\s]+)\s+\d{4}/); // 格式："作者名 2026-01-08"
      if (authorMatch) {
        author = authorMatch[1];
      }

      // 提取发布时间
      const timeMatch = metaText.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)/);
      if (timeMatch) {
        publishedAt = parsePublishTime(timeMatch[1]);
      }
    }

    // 提取封面图片（微信公众号通常用 msg_cdn_url）
    const coverImageUrl = $("meta[property='og:image']").attr("content") ||
                         $("#js_content img").first().attr("src") ||
                         $("#js_content img").first().attr("data-src") ||
                         undefined;

    // 生成摘要
    const description = contentText.substring(0, 200);

    return {
      title,
      description,
      contentHtml,
      contentText,
      siteName: "微信公众号",
      author,
      publishedAt,
      coverImageUrl,
    };
  } catch (error) {
    console.error("Failed to crawl Weixin article:", error);
    return null;
  }
}

/**
 * 爬取今日头条
 *
 * DOM 结构：
 * - 标题: <h1>
 * - 作者/时间: <div class="article-meta">
 * - 正文: <article class="syl-article-base syl-page-article tt-article-content syl-device-pc">
 *
 * @param html - HTML 内容
 * @returns 解析结果
 */
function crawlToutiaoArticle(html: string): PlatformCrawlResult | null {
  try {
    const $ = cheerio.load(html);

    // 提取标题（优先使用第一个 h1）
    const title = $("h1").first().text().trim();
    if (!title) {
      console.warn("Toutiao Article: Title not found");
      return null;
    }

    // 提取正文
    const contentArticle = $("article.syl-article-base, article.tt-article-content, article.syl-page-article");
    if (contentArticle.length === 0) {
      console.warn("Toutiao Article: Content article not found");
      return null;
    }

    // 清理内容：移除脚本、样式、广告
    contentArticle.find("script, style, .ad, .advertisement").remove();
    const contentHtml = contentArticle.html() || "";
    const contentText = contentArticle.text().trim();

    // 提取作者和发布时间
    let author: string | undefined;
    let publishedAt: string | undefined;

    const metaDiv = $(".article-meta");
    if (metaDiv.length > 0) {
      const metaText = metaDiv.text();

      // 提取作者
      const authorMatch = metaText.match(/作者[：:]\s*([^\s]+)/) ||
                         metaText.match(/来源[：:]\s*([^\s]+)/);
      if (authorMatch) {
        author = authorMatch[1];
      }

      // 提取发布时间
      const timeMatch = metaText.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)/) ||
                       metaText.match(/(\d{1,2}[-月]\d{1,2}[日]?\s+\d{1,2}:\d{1,2})/);
      if (timeMatch) {
        publishedAt = parsePublishTime(timeMatch[1]);
      }
    }

    // 提取封面图片
    const coverImageUrl = $("meta[property='og:image']").attr("content") ||
                         $("article img").first().attr("src") ||
                         undefined;

    // 生成摘要
    const description = contentText.substring(0, 200);

    return {
      title,
      description,
      contentHtml,
      contentText,
      siteName: "今日头条",
      author,
      publishedAt,
      coverImageUrl,
    };
  } catch (error) {
    console.error("Failed to crawl Toutiao article:", error);
    return null;
  }
}

/**
 * 通用爬虫入口
 *
 * 根据 URL 自动选择对应的平台爬虫
 *
 * @param url - 目标 URL
 * @param html - HTML 内容（已由外部 fetch 获取）
 * @returns 解析结果，如果平台不支持或解析失败则返回 null
 *
 * @example
 * ```typescript
 * const html = await fetch(url).then(r => r.text());
 * const result = crawlPlatformContent(url, html);
 * if (result) {
 *   console.log(result.title, result.siteName);
 * }
 * ```
 */
export function crawlPlatformContent(
  url: string,
  html: string
): PlatformCrawlResult | null {
  const platform = detectPlatform(url);

  console.log(`Detected platform: ${platform} for URL: ${url}`);

  switch (platform) {
    case "tencent":
      return crawlTencentNews(html);
    case "weixin":
      return crawlWeixinArticle(html);
    case "toutiao":
      return crawlToutiaoArticle(html);
    default:
      return null;
  }
}

/**
 * 检查 URL 是否为支持的平台
 *
 * @param url - 目标 URL
 * @returns 是否为支持的平台
 */
export function isSupportedPlatform(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}
