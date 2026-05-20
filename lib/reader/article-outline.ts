export type ArticleSidebarMode = "outline" | "clues" | "inspiration";

export type ArticleOutlineItem = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  sourceIndex: number;
};

export type ArticleFallbackCard = {
  id: string;
  kind: "source" | "insight" | "question" | "quote";
  eyebrow: string;
  title: string;
  body: string;
  sourceLabel: string;
  accent: "blue" | "emerald" | "amber" | "violet";
};

export type ArticleSidebarModel =
  | {
      mode: "outline";
      outline: ArticleOutlineItem[];
      cards: [];
    }
  | {
      mode: "clues" | "inspiration";
      outline: [];
      cards: ArticleFallbackCard[];
    };

export type BuildArticleSidebarModelInput = {
  noteId: string;
  title?: string | null;
  excerpt?: string | null;
  siteName?: string | null;
  publishedAt?: string | null;
  contentHtml?: string | null;
  contentText?: string | null;
  date?: Date;
};

const MAX_CARD_TEXT_LENGTH = 96;
const MAX_FALLBACK_CARD_COUNT = 3;
const MIN_USEFUL_TEXT_LENGTH = 32;

const inspirationDeck = [
  {
    title: "今天先保留一个问题",
    body: "真正有用的阅读，不急着得出结论，而是先找到值得追问的地方。",
    accent: "blue" as const,
  },
  {
    title: "把复杂留给证据",
    body: "观点可以轻，证据要稳。读新闻时先看事实，再看情绪。",
    accent: "emerald" as const,
  },
  {
    title: "慢一点判断",
    body: "信息越快，越需要给判断留一点缓冲。少一点确定，多一点观察。",
    accent: "amber" as const,
  },
  {
    title: "读完带走一句话",
    body: "如果只能记住一句，这篇内容最值得留下的判断是什么？",
    accent: "violet" as const,
  },
  {
    title: "从反面再看一次",
    body: "一个结论越顺眼，越值得问问：如果它错了，最可能错在哪里？",
    accent: "blue" as const,
  },
  {
    title: "给注意力留边界",
    body: "不是每条消息都需要回应。能沉淀成判断的，才值得进入知识库。",
    accent: "emerald" as const,
  },
];

export function buildArticleSidebarModel(
  input: BuildArticleSidebarModelInput
): ArticleSidebarModel {
  const headings = extractHeadings(input.contentHtml);

  if (headings.length >= 2) {
    return {
      mode: "outline",
      outline: headings,
      cards: [],
    };
  }

  const clueCards = buildArticleClueCards(input);
  if (clueCards.length >= 2) {
    return {
      mode: "clues",
      outline: [],
      cards: clueCards,
    };
  }

  return {
    mode: "inspiration",
    outline: [],
    cards: buildInspirationCards(input),
  };
}

export function extractHeadings(contentHtml?: string | null): ArticleOutlineItem[] {
  if (!contentHtml) return [];

  const headingMatches = Array.from(contentHtml.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi));
  const seen = new Set<string>();

  return headingMatches
    .map((match, sourceIndex) => {
      const text = normalizeText(stripHtml(match[2] || ""));
      const level = Number(match[1]) as 1 | 2 | 3;
      return {
        id: `heading-${sourceIndex}`,
        level,
        text: truncate(text, 72),
        sourceIndex,
      };
    })
    .filter((item) => {
      if (item.text.length < 2) return false;
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildArticleClueCards(input: BuildArticleSidebarModelInput): ArticleFallbackCard[] {
  const cards: ArticleFallbackCard[] = [];
  const title = cleanMaybe(input.title);
  const excerpt = cleanMaybe(input.excerpt);
  const siteName = cleanMaybe(input.siteName);
  const paragraphs = extractParagraphs(input);

  if (excerpt || paragraphs[0]) {
    cards.push({
      id: "article-clue-core",
      kind: "insight",
      eyebrow: "阅读线索",
      title: title ? "先看核心信息" : "先抓住主线",
      body: truncate(excerpt || paragraphs[0], MAX_CARD_TEXT_LENGTH),
      sourceLabel: "来自当前文章",
      accent: "blue",
    });
  }

  const strongestParagraph = pickStrongParagraph(paragraphs.slice(1));
  if (strongestParagraph) {
    cards.push({
      id: "article-clue-paragraph",
      kind: "insight",
      eyebrow: "关键段落",
      title: "这里可能藏着判断依据",
      body: truncate(strongestParagraph, MAX_CARD_TEXT_LENGTH),
      sourceLabel: "来自当前文章",
      accent: "emerald",
    });
  }

  if (title && title.length >= 6) {
    cards.push({
      id: "article-clue-question",
      kind: "question",
      eyebrow: "今日一问",
      title: "读这篇时可以追问",
      body: `围绕“${truncate(title, 34)}”，它为什么发生，谁会受到影响？`,
      sourceLabel: "由标题生成",
      accent: "violet",
    });
  }

  if (siteName || input.publishedAt) {
    cards.push({
      id: "article-clue-source",
      kind: "source",
      eyebrow: "来源信息",
      title: siteName || "保存来源",
      body: [siteName ? "媒体来源已记录" : null, formatDate(input.publishedAt)]
        .filter(Boolean)
        .join(" · ") || "这条内容已进入你的阅读记录。",
      sourceLabel: "来自笔记元数据",
      accent: "amber",
    });
  }

  return cards.slice(0, MAX_FALLBACK_CARD_COUNT);
}

function buildInspirationCards(input: BuildArticleSidebarModelInput): ArticleFallbackCard[] {
  const todayKey = toDateKey(input.date ?? new Date());
  const start = stableHash(`${todayKey}:${input.noteId || "newsbox"}`) % inspirationDeck.length;
  const selected = Array.from({ length: 3 }, (_, offset) => {
    const item = inspirationDeck[(start + offset) % inspirationDeck.length];
    return {
      id: `inspiration-${offset}`,
      kind: offset === 1 ? ("question" as const) : ("quote" as const),
      eyebrow: offset === 1 ? "轻哲学" : "灵感卡片",
      title: item.title,
      body: item.body,
      sourceLabel: "本地灵感库",
      accent: item.accent,
    };
  });

  return selected;
}

function extractParagraphs(input: BuildArticleSidebarModelInput): string[] {
  const fromHtml = extractBlockText(input.contentHtml);
  const fromText = splitTextBlocks(input.contentText);

  const seen = new Set<string>();
  return [...fromHtml, ...fromText]
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= MIN_USEFUL_TEXT_LENGTH)
    .filter((item) => {
      const key = item.slice(0, 48).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function extractBlockText(contentHtml?: string | null): string[] {
  if (!contentHtml) return [];

  const blockMatches = Array.from(
    contentHtml.matchAll(/<(p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)
  );
  return blockMatches.map((match) => stripHtml(match[2] || ""));
}

function splitTextBlocks(contentText?: string | null): string[] {
  if (!contentText) return [];
  return contentText
    .replace(/([。！？!?])\s+/g, "$1\n")
    .split(/\n{1,}/)
    .map((item) => item.trim());
}

function pickStrongParagraph(paragraphs: string[]) {
  if (paragraphs.length === 0) return "";

  return [...paragraphs].sort((a, b) => scoreParagraph(b) - scoreParagraph(a))[0];
}

function scoreParagraph(text: string) {
  const keywords = ["因为", "但是", "然而", "导致", "影响", "表示", "认为", "原因", "风险", "问题"];
  const keywordScore = keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 8 : 0), 0);
  const lengthScore = Math.min(text.length, 180) / 12;
  return keywordScore + lengthScore;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function cleanMaybe(text?: string | null) {
  const clean = normalizeText(text || "");
  return clean && clean !== "无标题" ? clean : "";
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
