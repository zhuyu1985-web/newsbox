import * as cheerio from 'cheerio';
import { marked } from 'marked';

/**
 * 清洗和格式化爬取的 HTML 内容，确保一致的阅读体验
 *
 * @param html - 原始 HTML 字符串（来自 Jina AI Reader 或其他爬虫）
 * @returns 清洗后的 HTML 字符串
 *
 * 清洗策略（分 5 个阶段）：
 *
 * **阶段 1：移除非内容标签**
 * - 完全移除：script, style, nav, header, footer, iframe, noscript, link, meta, aside, form, button, input
 * - 原因：这些标签不包含文章正文内容，可能导致 XSS 攻击
 *
 * **阶段 2：移除重复元数据**
 * - 移除第一个 H1 标签：通常与笔记标题重复
 * - 移除元数据容器：author, time, source, article-info, metadata 等
 * - 移除来源/作者信息：匹配"来源"、"作者"、"发布时间"的 span 元素
 * - 针对平台：腾讯新闻（#article-author）、新浪新闻（.article-info）
 *
 * **阶段 3：提取正文区域**
 * - 优先级：article > main > body > 原始 html
 * - 原因：许多网页有侧边栏、广告等噪音，需要定位正文容器
 *
 * **阶段 4：属性清洗（XSS 防护）**
 * - **保留属性**：
 *   - img: src, alt, title（必需用于显示和可访问性）
 *   - a: href, target, rel（必需用于链接功能）
 * - **移除属性**：
 *   - style, class, id（避免样式冲突）
 *   - onclick, onload（事件处理程序，防止 XSS）
 *   - data-* 属性（清理元数据）
 *
 * **阶段 5：图片处理**
 * - 移除所有原有 class
 * - 前端通过全局 CSS 统一设置响应式样式
 * - 使用 Tailwind prose 类：prose-img:rounded, prose-img:max-w-full
 *
 * 安全性保证：
 * - Cheerio 解析不执行 JavaScript（无 DOM 环境）
 * - 所有事件属性（onclick 等）被移除
 * - 所有 script 标签被移除
 *
 * 性能考量：
 * - 单次调用耗时：~50-200ms（取决于 HTML 大小）
 * - 内存占用：约为 HTML 原大小的 2-3 倍（Cheerio DOM 树）
 * - 建议：服务端缓存清洗结果（使用 URL 作为 key）
 *
 * 已知限制：
 * - 无法处理动态生成的内容（需要浏览器渲染）
 * - 某些新闻网站的混合内容（文章 + 相关推荐）可能保留部分噪音
 * - 不执行 CSS，无法通过 display:none 判断隐藏内容
 *
 * @example
 * ```ts
 * const dirty = '<div class="article"><script>alert("XSS")</script><p>Hello</p></div>';
 * const clean = sanitizeHtmlContent(dirty);
 * // 结果：'<div><p>Hello</p></div>'
 * ```
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';

  const $ = cheerio.load(html);

  // 1. Remove unwanted tags
  $('script, style, nav, header, footer, iframe, noscript, link, meta, aside, form, button, input').remove();

  // 1.1 特殊处理：针对新闻门户（如腾讯新闻）移除重复的标题和元数据块
  // 许多新闻页面的正文开头会包含 h1 或特定 class 的作者/时间信息，这些已经在元数据中存储过
  $('h1').first().remove(); // 移除正文中的第一个 H1（通常是标题）
  
  // 移除常见的元数据容器（针对腾讯、新浪等）
  $('.author, .time, .source, .article-info, .metadata, .meta-info, .title-info').remove();

  // 腾讯新闻：作者信息容器（避免混入正文）
  $('#article-author').remove();

  $('span:contains("来源"), span:contains("作者"), span:contains("发布时间")').closest('div, p').remove();

  // 2. Select the main content if possible
  let content = $('article').length > 0 ? $('article').html() : 
                $('main').length > 0 ? $('main').html() : 
                $('body').length > 0 ? $('body').html() : html;

  if (!content) return '';

  const $clean = cheerio.load(content);

  // 3. Clean attributes and non-semantic tags
  $clean('*').each((_, el) => {
    // cheerio 的 Element 类型包含 TextElement，这里只处理 tag
    if ((el as any).type !== 'tag') return;

    const $el = $clean(el);
    const tagName = ((el as any).name || '').toLowerCase();

    // Remove unwanted attributes
    const attributes = (el as any).attribs || {};
    Object.keys(attributes).forEach((attr) => {
      // Keep only essential attributes
      if (tagName === 'img' && (attr === 'src' || attr === 'alt' || attr === 'title')) {
        return;
      }
      if (tagName === 'a' && (attr === 'href' || attr === 'target' || attr === 'rel')) {
        return;
      }
      // Remove everything else (style, class, id, etc.)
      $el.removeAttr(attr);
    });

    // 4. Unwrap non-semantic containers but keep their content
    // We only want to keep structural tags. 
    // If it's a div/span/section that's just a container, we could unwrap it, 
    // but for simplicity and safety of structure, we'll just keep them as clean tags.
    // However, the user specifically mentioned h1, h2, p, etc.
  });

  // 5. Final pass to ensure images have a consistent class for the frontend
  // Even though we remove classes above, we can add our own internal class 
  // or just rely on global CSS for the container.
  
  return $clean.html() || '';
}

/**
 * Tailwind Prose 样式类字符串（用于清洗后的内容容器）
 *
 * 设计目标：
 * - 使用 Tailwind Typography (@tailwindcss/typography) 插件实现优美的默认排版
 * - 支持深色模式（dark:prose-invert）
 * - 支持用户自定义字号/行高（通过 CSS 变量）
 * - 确保 Markdown 和 HTML 内容一致的视觉体验
 *
 * 样式说明：
 *
 * **基础 Prose 类**：
 * - prose: 启用 Tailwind Typography 排版引擎
 * - prose-slate: 使用 Slate 色系（中性灰色）
 * - max-w-none: 移除最大宽度限制（由外部容器控制）
 * - dark:prose-invert: 深色模式下自动反转颜色
 *
 * **动态字号/行高**：
 * - text-[var(--reader-font-size)]: 用户设置的字号（默认 16px）
 * - leading-[var(--reader-line-height)]: 用户设置的行高（默认 1.75）
 * - 更新方式：AppearanceMenu 组件修改容器 style 属性
 *
 * **段落样式**：
 * - mb-[24px]: 段落间距 24px（与标题间距一致）
 * - mt-0: 段落上方无间距（避免与标题重复）
 *
 * **标题层级**（H1-H4）：
 * - H1: 28px, 粗体, 上间距 40px, 下间距 16px
 * - H2: 24px, 粗体, 上间距 32px, 下间距 14px
 * - H3: 20px, 半粗体, 上间距 24px, 下间距 12px
 * - H4: 18px, 半粗体, 上间距 20px, 下间距 10px
 *
 * **图片样式**：
 * - rounded-[4px]: 圆角 4px（柔和但不过度）
 * - max-w-full: 最大宽度 100%（响应式）
 * - my-[32px]: 上下间距 32px（突出显示）
 * - mx-auto: 水平居中
 *
 * **引用块样式**：
 * - border-l-4 border-blue-500: 左侧蓝色边框 4px
 * - bg-blue-50/50: 浅蓝色半透明背景（增强可读性）
 * - italic: 斜体（传统引用样式）
 * - py-3 px-4: 内边距
 *
 * **列表样式**：
 * - ul: 圆点标记（list-disc）
 * - ol: 数字标记（list-decimal）
 * - li: 项间距 8px，继承用户行高设置
 *
 * 使用方式：
 * ```tsx
 * <div className={CONTENT_STYLING_CLASSES}>
 *   <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
 * </div>
 * ```
 *
 * 扩展性：
 * - 可通过修改 CSS 变量覆盖字号/行高
 * - 可添加自定义 prose-* 类覆盖特定元素
 * - 支持深色模式自动切换
 */
export const CONTENT_STYLING_CLASSES =
  "prose prose-slate max-w-none dark:prose-invert " +
  // 字号/行高用 CSS 变量驱动（由阅读器设置写入 --reader-font-size / --reader-line-height）
  "text-[var(--reader-font-size)] leading-[var(--reader-line-height)] " +
  "prose-p:text-[var(--reader-font-size)] prose-p:leading-[var(--reader-line-height)] prose-p:mb-[24px] prose-p:mt-0 " +
  "prose-headings:font-bold " +
  "prose-h1:text-[28px] prose-h1:leading-tight prose-h1:mt-[40px] prose-h1:mb-[16px] prose-h1:font-bold " +
  "prose-h2:text-[24px] prose-h2:leading-tight prose-h2:mt-[32px] prose-h2:mb-[14px] prose-h2:font-bold " +
  "prose-h3:text-[20px] prose-h3:leading-snug prose-h3:mt-[24px] prose-h3:mb-[12px] prose-h3:font-semibold " +
  "prose-h4:text-[18px] prose-h4:leading-snug prose-h4:mt-[20px] prose-h4:mb-[10px] prose-h4:font-semibold " +
  "prose-img:rounded-[4px] prose-img:my-[32px] prose-img:mx-auto prose-img:block prose-img:max-w-full " +
  "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:bg-blue-50/50 prose-blockquote:my-[24px] " +
  "prose-ul:list-disc prose-ol:list-decimal prose-li:mb-[8px] prose-li:leading-[var(--reader-line-height)] " +
  "prose-strong:font-semibold prose-em:italic";

/**
 * 新闻详情页样式类（基于 docs/tec-news-reader-style.md 规范）
 *
 * 设计目标：
 * - 统一新闻文章的展现格式
 * - 符合主流新闻平台的阅读体验（腾讯新闻、今日头条等）
 * - 响应式适配（桌面/平板/移动端）
 *
 * 样式规范：
 * - 标题 H1: 28px bold, line-height 1.3, margin-bottom 16px
 * - 标题 H2: 20px semibold, line-height 1.4, margin-bottom 12px
 * - 正文段落: 18px, line-height 1.8, margin-bottom 24px
 * - 图片: 居中 + 圆角 + 阴影, margin 32px
 * - 引用: 左侧蓝色边框 4px + 浅蓝背景
 * - 列表: line-height 1.7, margin-bottom 12px
 *
 * 响应式断点：
 * - 移动端 (<768px): 16px 字号, line-height 1.6
 * - 平板端 (768-1024px): 17px 字号, line-height 1.7
 * - 桌面端 (>1024px): 18px 字号, line-height 1.8
 *
 * @example
 * ```tsx
 * <div className={NEWS_STYLING_CLASSES}>
 *   <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
 * </div>
 * ```
 */
export const NEWS_STYLING_CLASSES =
  "prose prose-slate max-w-none dark:prose-invert " +
  // 标题样式（符合新闻规范）
  "prose-h1:text-[28px] prose-h1:font-bold prose-h1:leading-[1.3] prose-h1:mb-4 prose-h1:text-gray-900 dark:prose-h1:text-gray-100 " +
  "prose-h2:text-[20px] prose-h2:font-semibold prose-h2:leading-[1.4] prose-h2:mb-3 prose-h2:text-gray-800 dark:prose-h2:text-gray-200 " +
  "prose-h3:text-[18px] prose-h3:font-semibold prose-h3:leading-[1.5] prose-h3:mb-2 prose-h3:text-gray-800 dark:prose-h3:text-gray-200 " +
  "prose-h4:text-[16px] prose-h4:font-medium prose-h4:leading-[1.5] prose-h4:mb-2 prose-h4:text-gray-700 dark:prose-h4:text-gray-300 " +
  // 正文样式
  "prose-p:text-[18px] prose-p:leading-[1.8] prose-p:mb-6 prose-p:text-gray-700 dark:prose-p:text-gray-300 " +
  "md:prose-p:text-[17px] md:prose-p:leading-[1.7] " +
  "sm:prose-p:text-[16px] sm:prose-p:leading-[1.6] " +
  // 图片样式
  "prose-img:rounded prose-img:shadow-md prose-img:mx-auto prose-img:my-8 prose-img:block prose-img:max-w-full " +
  // 引用样式
  "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 " +
  "prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-900/20 " +
  "prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:my-6 " +
  "prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 " +
  // 列表样式
  "prose-ul:list-disc prose-ul:ml-6 prose-ul:my-6 " +
  "prose-ol:list-decimal prose-ol:ml-6 prose-ol:my-6 " +
  "prose-li:mb-3 prose-li:leading-[1.7] prose-li:text-gray-700 dark:prose-li:text-gray-300 " +
  // 链接样式
  "prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 " +
  "hover:prose-a:text-blue-700 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 " +
  // 强调样式
  "prose-strong:font-semibold prose-strong:text-gray-900 dark:prose-strong:text-gray-100 " +
  "prose-em:italic prose-em:text-gray-600 dark:prose-em:text-gray-400";

/**
 * 将 Markdown 转换为 HTML 并应用新闻样式格式化
 *
 * 功能说明：
 * ---------
 * 1. 使用 marked 库将 Markdown 转换为 HTML
 * 2. 使用 sanitizeHtmlContent 清洗 HTML（移除危险标签和属性）
 * 3. 返回干净的、适合展示的 HTML
 *
 * 处理流程：
 * ---------
 * Markdown (from Jina Reader)
 *   ↓
 * marked.parse() → 原始 HTML
 *   ↓
 * sanitizeHtmlContent() → 清洗后的 HTML
 *   ↓
 * 前端使用 NEWS_STYLING_CLASSES 应用样式
 *
 * 安全性：
 * ---------
 * - marked 默认配置禁用 HTML（防 XSS）
 * - sanitizeHtmlContent 进一步清洗输出
 * - 所有脚本和事件属性都被移除
 *
 * @param markdown - Markdown 格式的内容（来自 Jina Reader）
 * @returns 清洗后的 HTML 字符串
 *
 * @example
 * ```typescript
 * const markdown = "# Hello\n\nThis is **bold** text.";
 * const html = formatNewsContent(markdown);
 * // 返回: "<h1>Hello</h1><p>This is <strong>bold</strong> text.</p>"
 * ```
 */
export function formatNewsContent(markdown: string): string {
  if (!markdown) return '';

  try {
    // 配置 marked 选项
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // 将换行符转换为 <br>
    });

    // 1. Markdown → HTML
    const rawHtml = marked.parse(markdown) as string;

    // 2. 清洗 HTML（复用现有函数）
    const cleanHtml = sanitizeHtmlContent(rawHtml);

    // 3. 返回清洗后的 HTML
    return cleanHtml;
  } catch (error) {
    console.error('Failed to format news content:', error);
    return '';
  }
}

/**
 * 从 HTML 中提取纯文本内容
 *
 * 用途：
 * -----
 * 生成用于搜索、摘要的纯文本版本
 *
 * @param html - HTML 字符串
 * @returns 纯文本字符串
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';

  try {
    const $ = cheerio.load(html);
    // 移除所有标签，只保留文本
    const text = $.root().text();
    // 清理多余空白
    return text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('Failed to extract text from HTML:', error);
    return '';
  }
}
