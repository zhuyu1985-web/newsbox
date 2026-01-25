"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface OutlineItem {
  id: string;
  level: number; // 1, 2, 3 对应 H1, H2, H3
  text: string;
  element?: HTMLElement;
}

interface ArticleOutlineProps {
  content: string | null;
}

export function ArticleOutline({ content }: ArticleOutlineProps) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!content) return;

    // 解析HTML内容，提取H1-H3标题
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3");

    const items: OutlineItem[] = Array.from(headings).map((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent || "";
      const id = `heading-${index}`;

      return {
        id,
        level,
        text,
      };
    });

    setOutline(items);

    // 监听实际DOM中的标题位置（需要等待内容渲染）
    setTimeout(() => {
      const realHeadings = document.querySelectorAll("article h1, article h2, article h3");
      items.forEach((item, index) => {
        if (realHeadings[index]) {
          item.element = realHeadings[index] as HTMLElement;
        }
      });
    }, 500);
  }, [content]);

  useEffect(() => {
    // 监听滚动，高亮当前章节
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (let i = outline.length - 1; i >= 0; i--) {
        const item = outline[i];
        if (item.element && item.element.offsetTop <= scrollPosition) {
          setActiveId(item.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [outline]);

  const handleClick = (item: OutlineItem) => {
    if (item.element) {
      item.element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (outline.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-xl">📄</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">文章较短</p>
        <p className="text-xs text-muted-foreground/70 mt-1">无需目录大纲</p>
      </div>
    );
  }

  return (
    <nav className="px-4 py-6">
      <ul className="space-y-3">
        {outline.map((item) => {
          const isActive = activeId === item.id;
          
          return (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item)}
                className={cn(
                  "w-full text-left transition-all duration-200 group flex items-start",
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
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

