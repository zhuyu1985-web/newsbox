/**
 * NewsBox DOM Content Extractor
 *
 * Extracts article content directly from the current page's DOM.
 * Advantages over server-side scraping:
 * - Works behind paywalls/login walls (user already authenticated)
 * - Captures dynamically loaded content (SPAs, lazy loading)
 * - No external API calls needed (saves Jina Reader quota)
 * - Faster (content already rendered)
 */

export interface ExtractedContent {
  url: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  coverImageUrl: string | null;
  author: string | null;
  siteName: string | null;
  publishedAt: string | null;
  contentType: "article" | "video";
}

// Video platform patterns
const VIDEO_PATTERNS = [
  /bilibili\.com/i,
  /youtube\.com|youtu\.be/i,
  /douyin\.com/i,
  /kuaishou\.com/i,
  /vimeo\.com/i,
  /ixigua\.com/i,
];

export function extractPageContent(): ExtractedContent {
  return {
    url: location.href,
    title: extractTitle(),
    excerpt: extractExcerpt(),
    contentHtml: extractMainContent(),
    contentText: extractPlainText(),
    coverImageUrl: extractCoverImage(),
    author: extractAuthor(),
    siteName: extractSiteName(),
    publishedAt: extractPublishedTime(),
    contentType: detectContentType(),
  };
}

/** Extract page title with priority: og:title > <title> > first <h1> */
function extractTitle(): string {
  const ogTitle = getMeta("og:title") || getMeta("twitter:title");
  if (ogTitle) return ogTitle.trim();

  const titleEl = document.querySelector("title");
  if (titleEl?.textContent) {
    // Remove common suffixes like " - Site Name" or " | Site Name"
    let title = titleEl.textContent.trim();
    title = title.replace(/\s*[-|–—]\s*[^-|–—]*$/, "").trim();
    if (title) return title;
    return titleEl.textContent.trim();
  }

  const h1 = document.querySelector("h1");
  if (h1?.textContent) return h1.textContent.trim();

  return document.title || location.hostname;
}

/** Extract page excerpt/description */
function extractExcerpt(): string {
  const ogDesc = getMeta("og:description") || getMeta("twitter:description");
  if (ogDesc) return ogDesc.trim().substring(0, 300);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc?.getAttribute("content")) {
    return metaDesc.getAttribute("content")!.trim().substring(0, 300);
  }

  // Fallback: first paragraph text
  const mainContent = findMainContentElement();
  if (mainContent) {
    const firstP = mainContent.querySelector("p");
    if (firstP?.textContent) {
      return firstP.textContent.trim().substring(0, 300);
    }
  }

  return "";
}

/** Extract main article content as clean HTML */
function extractMainContent(): string {
  const main = findMainContentElement();
  if (!main) return "";

  // Clone to avoid modifying the live DOM
  const clone = main.cloneNode(true) as HTMLElement;

  // Remove non-content elements
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "button",
    "input",
    "textarea",
    "select",
    ".ad",
    ".advertisement",
    ".social-share",
    ".comments",
    ".related-posts",
    ".sidebar",
    ".navigation",
    "[role='navigation']",
    "[role='banner']",
    "[role='complementary']",
  ];
  clone
    .querySelectorAll(removeSelectors.join(","))
    .forEach((el) => el.remove());

  // Clean attributes (keep only safe ones)
  clone.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      // Keep safe attributes
      if (tag === "img" && ["src", "alt", "title"].includes(name)) continue;
      if (tag === "a" && ["href"].includes(name)) continue;
      if (name === "referrerpolicy") continue;
      // Remove everything else
      el.removeAttribute(attr.name);
    }
    // Add referrerpolicy to images (bypass hotlink protection)
    if (tag === "img") {
      el.setAttribute("referrerpolicy", "no-referrer");
      // Convert data-src / data-original to src (lazy-loaded images)
      const dataSrc =
        el.getAttribute("data-src") || el.getAttribute("data-original");
      if (dataSrc && !el.getAttribute("src")) {
        el.setAttribute("src", dataSrc);
      }
    }
  });

  return clone.innerHTML.trim();
}

/** Extract plain text content */
function extractPlainText(): string {
  const main = findMainContentElement();
  if (!main) return "";

  const clone = main.cloneNode(true) as HTMLElement;
  // Remove scripts, styles, etc.
  clone
    .querySelectorAll("script, style, noscript")
    .forEach((el) => el.remove());

  return (
    clone.textContent?.replace(/\s+/g, " ").trim().substring(0, 5000) || ""
  );
}

/** Find the main content container using a scoring algorithm */
function findMainContentElement(): HTMLElement | null {
  // Priority 1: Semantic elements
  const article = document.querySelector("article");
  if (
    article &&
    article.textContent &&
    article.textContent.trim().length > 200
  ) {
    return article;
  }

  const main = document.querySelector("main");
  if (main && main.textContent && main.textContent.trim().length > 200) {
    return main;
  }

  // Priority 2: Common content class names
  const contentSelectors = [
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content-body",
    ".article-body",
    ".post-body",
    "#article-content",
    "#content",
    "#main-content",
    "[itemprop='articleBody']",
    // Chinese site patterns
    ".rich_media_content", // WeChat
    "#js_content", // WeChat
    "#article-content", // Tencent News
    ".syl-article-base", // Toutiao
    ".Post-RichTextContainer", // Zhihu
  ];

  for (const selector of contentSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.textContent && el.textContent.trim().length > 100) {
      return el;
    }
  }

  // Priority 3: Text density scoring
  return findByTextDensity();
}

/** Find content by text density scoring */
function findByTextDensity(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "div, section, article, main"
  );

  let bestElement: HTMLElement | null = null;
  let bestScore = 0;

  for (const el of candidates) {
    // Skip tiny elements
    const text = el.textContent?.trim() || "";
    if (text.length < 200) continue;

    // Skip known non-content elements
    const cls = (el.className || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const combined = cls + " " + id;
    if (
      /nav|menu|sidebar|footer|header|comment|ad|social|widget|related/.test(
        combined
      )
    ) {
      continue;
    }

    // Score: text length * text density (text / total including tags)
    const htmlLength = el.innerHTML.length;
    const textLength = text.length;
    const density = textLength / Math.max(htmlLength, 1);

    // Bonus for having multiple paragraphs
    const pCount = el.querySelectorAll("p").length;
    const pBonus = Math.min(pCount * 0.1, 1);

    const score = textLength * density * (1 + pBonus);

    if (score > bestScore) {
      bestScore = score;
      bestElement = el;
    }
  }

  return bestElement;
}

/** Extract cover image URL */
function extractCoverImage(): string | null {
  // Priority 1: Open Graph image
  const ogImage = getMeta("og:image") || getMeta("twitter:image");
  if (ogImage) return resolveUrl(ogImage);

  // Priority 2: First large image in main content
  const main = findMainContentElement();
  if (main) {
    const images = main.querySelectorAll("img");
    for (const img of images) {
      const src =
        img.src ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original");
      if (!src) continue;
      // Skip tiny images (icons, avatars, etc.)
      const width =
        img.naturalWidth ||
        img.width ||
        parseInt(img.getAttribute("width") || "0");
      const height =
        img.naturalHeight ||
        img.height ||
        parseInt(img.getAttribute("height") || "0");
      if (width > 200 || height > 200 || (width === 0 && height === 0)) {
        return resolveUrl(src);
      }
    }
  }

  return null;
}

/** Extract author name */
function extractAuthor(): string | null {
  // Meta tags
  const metaAuthor = getMeta("author") || getMeta("article:author");
  if (metaAuthor) return metaAuthor.trim();

  // JSON-LD
  const jsonLd = getJsonLd();
  if (jsonLd?.author) {
    if (typeof jsonLd.author === "string") return jsonLd.author;
    if (jsonLd.author.name) return jsonLd.author.name;
  }

  // Common selectors
  const authorSelectors = [
    "[rel='author']",
    ".author",
    ".byline",
    "[itemprop='author']",
    ".article-author",
    ".post-author",
    "a[href*='/author/']",
    // Chinese sites
    "#article-author",
    ".article-meta .name",
    ".author-name",
    ".nickname",
  ];

  for (const selector of authorSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const text = el.textContent.trim();
      if (text.length > 0 && text.length < 100) return text;
    }
  }

  return null;
}

/** Extract site name */
function extractSiteName(): string | null {
  const ogSite = getMeta("og:site_name");
  if (ogSite) return ogSite.trim();

  const appName = document.querySelector('meta[name="application-name"]');
  if (appName?.getAttribute("content")) {
    return appName.getAttribute("content")!.trim();
  }

  // JSON-LD publisher
  const jsonLd = getJsonLd();
  if (jsonLd?.publisher?.name) return jsonLd.publisher.name;

  return location.hostname.replace(/^www\./, "");
}

/** Extract publish time */
function extractPublishedTime(): string | null {
  // Meta tags
  const pubTime =
    getMeta("article:published_time") || getMeta("datePublished");
  if (pubTime) return pubTime;

  // JSON-LD
  const jsonLd = getJsonLd();
  if (jsonLd?.datePublished) return jsonLd.datePublished;

  // Time element
  const timeEl = document.querySelector("time[datetime]");
  if (timeEl?.getAttribute("datetime")) {
    return timeEl.getAttribute("datetime");
  }

  return null;
}

/** Detect if this is a video page */
function detectContentType(): "article" | "video" {
  const url = location.href;
  for (const pattern of VIDEO_PATTERNS) {
    if (pattern.test(url)) return "video";
  }
  // 用 og:type 判定未知视频站点（YouTube/B 站等都会声明 video.*）
  // 不再扫 DOM 里的 <video>：新闻图文页常带广告/推荐位的 <video>，会把图文误判成视频。
  const ogType = getMeta("og:type");
  if (ogType && /^video\b/i.test(ogType)) return "video";
  return "article";
}

// --- Helpers ---

function getMeta(name: string): string | null {
  const el =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute("content") || null;
}

function getJsonLd(): Record<string, any> | null {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      // Handle @graph arrays
      if (data["@graph"]) {
        const article = data["@graph"].find(
          (item: any) =>
            item["@type"] === "Article" || item["@type"] === "NewsArticle"
        );
        if (article) return article;
      }
      if (
        data["@type"] === "Article" ||
        data["@type"] === "NewsArticle"
      ) {
        return data;
      }
      return data;
    } catch {
      continue;
    }
  }
  return null;
}

function resolveUrl(url: string): string {
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return location.origin + url;
  if (url.startsWith("http")) return url;
  return new URL(url, location.href).href;
}
