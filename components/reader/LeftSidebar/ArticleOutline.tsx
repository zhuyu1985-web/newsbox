"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  HelpCircle,
  Lightbulb,
  Newspaper,
  Quote,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildArticleSidebarModel,
  type ArticleFallbackCard,
  type ArticleOutlineItem,
} from "@/lib/reader/article-outline";
import { Button } from "@/components/ui/button";

interface ArticleOutlineProps {
  noteId: string;
  title: string | null;
  excerpt: string | null;
  siteName: string | null;
  publishedAt: string | null;
  contentHtml: string | null;
  contentText: string | null;
}

const cardIconMap = {
  source: Newspaper,
  insight: Compass,
  question: HelpCircle,
  quote: Quote,
} satisfies Record<ArticleFallbackCard["kind"], typeof Compass>;

const accentClassMap = {
  blue: {
    card: "border-blue-500/15 bg-blue-500/[0.06] hover:border-blue-500/35",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    line: "from-blue-500/0 via-blue-500/70 to-blue-500/0",
  },
  emerald: {
    card: "border-emerald-500/15 bg-emerald-500/[0.06] hover:border-emerald-500/35",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    line: "from-emerald-500/0 via-emerald-500/70 to-emerald-500/0",
  },
  amber: {
    card: "border-amber-500/20 bg-amber-500/[0.07] hover:border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    line: "from-amber-500/0 via-amber-500/70 to-amber-500/0",
  },
  violet: {
    card: "border-violet-500/15 bg-violet-500/[0.06] hover:border-violet-500/35",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    line: "from-violet-500/0 via-violet-500/70 to-violet-500/0",
  },
} satisfies Record<ArticleFallbackCard["accent"], { card: string; icon: string; line: string }>;

const MAX_VISIBLE_FALLBACK_CARDS = 3;

export function ArticleOutline({
  noteId,
  title,
  excerpt,
  siteName,
  publishedAt,
  contentHtml,
  contentText,
}: ArticleOutlineProps) {
  const [activeId, setActiveId] = useState<string>("");
  const headingElementsRef = useRef<Record<string, HTMLElement>>({});

  const sidebarModel = useMemo(
    () =>
      buildArticleSidebarModel({
        noteId,
        title,
        excerpt,
        siteName,
        publishedAt,
        contentHtml,
        contentText,
      }),
    [noteId, title, excerpt, siteName, publishedAt, contentHtml, contentText]
  );

  useEffect(() => {
    if (sidebarModel.mode !== "outline") {
      headingElementsRef.current = {};
      setActiveId("");
      return;
    }

    // 监听实际DOM中的标题位置（需要等待内容渲染）
    const timer = window.setTimeout(() => {
      const realHeadings = document.querySelectorAll("article h1, article h2, article h3");
      const nextElements: Record<string, HTMLElement> = {};

      sidebarModel.outline.forEach((item) => {
        const matched = realHeadings[item.sourceIndex];
        if (matched) {
          nextElements[item.id] = matched as HTMLElement;
        }
      });

      headingElementsRef.current = nextElements;
    }, 500);

    return () => window.clearTimeout(timer);
  }, [sidebarModel]);

  useEffect(() => {
    if (sidebarModel.mode !== "outline") {
      return;
    }

    // 监听滚动，高亮当前章节
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (let i = sidebarModel.outline.length - 1; i >= 0; i--) {
        const item = sidebarModel.outline[i];
        const element = headingElementsRef.current[item.id];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(item.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [sidebarModel]);

  const handleClick = (item: ArticleOutlineItem) => {
    const element = headingElementsRef.current[item.id];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (sidebarModel.mode !== "outline") {
    return <FallbackCards cards={sidebarModel.cards} mode={sidebarModel.mode} />;
  }

  return (
    <nav className="px-4 py-6">
      <ul className="space-y-3">
        {sidebarModel.outline.map((item) => {
          const isActive = activeId === item.id;
          
          return (
            <li key={item.id}>
              <Button
                variant="ghost"
                onClick={() => handleClick(item)}
                className={cn(
                  "group h-auto w-full justify-start rounded-md px-2 py-1.5 text-left transition-all duration-200",
                  item.level === 1 ? "text-[13px] font-medium" : item.level === 2 ? "pl-4 text-[12px]" : "pl-8 text-[11px]",
                  isActive
                    ? "text-card-foreground"
                    : "text-muted-foreground/70 hover:text-card-foreground"
                )}
              >
                <span className={cn(
                  "truncate leading-relaxed",
                  isActive && "relative after:absolute after:-left-3 after:top-1/2 after:-translate-y-1/2 after:w-1 after:h-1 after:bg-slate-900 after:rounded-full dark:after:bg-slate-100"
                )}>
                  {item.text}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FallbackCards({
  cards,
  mode,
}: {
  cards: ArticleFallbackCard[];
  mode: "clues" | "inspiration";
}) {
  return (
    <div className="space-y-3 px-4 pb-6">
      <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground/70">
        {mode === "clues" ? (
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        )}
        {mode === "clues" ? "从当前文章提取" : "内容不足时的本地灵感"}
      </div>

      {cards.slice(0, MAX_VISIBLE_FALLBACK_CARDS).map((card, index) => {
        const Icon = cardIconMap[card.kind];
        const accent = accentClassMap[card.accent];

        return (
          <article
            key={card.id}
            className={cn(
              "group relative min-h-[128px] overflow-hidden rounded-lg border p-4 shadow-sm",
              "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2",
              accent.card
            )}
            style={{ animationDelay: `${index * 65}ms` }}
          >
            <div className={cn("absolute inset-x-3 top-0 h-px bg-gradient-to-r", accent.line)} />
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", accent.icon)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {card.eyebrow}
              </span>
            </div>
            <h4 className="text-[13px] font-semibold leading-5 text-card-foreground">
              {card.title}
            </h4>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {card.body}
            </p>
            <div className="mt-3 text-[10px] text-muted-foreground/60">
              来源：{card.sourceLabel}
            </div>
          </article>
        );
      })}
    </div>
  );
}
