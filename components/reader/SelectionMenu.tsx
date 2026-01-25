"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Pen,
  MessageSquare,
  Sparkles,
  Search,
  Copy,
  Check,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

interface SelectionMenuProps {
  noteId: string;
  onHighlight?: (text: string, color: string) => void;
  onUpdateHighlight?: (highlightId: string, color: string) => void;
  onAnnotate?: (text: string, color: string, highlightId?: string) => void;
  onAIExplain?: (text: string) => void;
}

export function SelectionMenu({
  noteId,
  onHighlight,
  onUpdateHighlight,
  onAnnotate,
  onAIExplain,
}: SelectionMenuProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastUsedColor, setLastUsedColor] = useState("yellow");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const savedColor = localStorage.getItem("newsbox_reader_last_color");
    if (savedColor) setLastUsedColor(savedColor);
  }, []);

  useEffect(() => {
    const handleSelection = (e: Event) => {
      // 使用 setTimeout 确保选择完成后再处理
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        console.log("Selection event:", {
          text,
          hasSelection: !!selection,
          rangeCount: selection?.rangeCount || 0,
          target: (e.target as HTMLElement)?.tagName,
        });

        if (text && text.length > 0) {
          setSelectedText(text);

          // 获取选中文本的位置
          try {
            const range = selection?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();

            if (rect) {
              // 计算菜单位置（在选中文本上方居中）
              // 注意：菜单使用 position: fixed，所以直接使用 rect.top（相对视口）
              // 使用 rect.top 作为基准，transform 会向上移动菜单
              const top = rect.top;
              const left = rect.left + rect.width / 2;

              console.log("Menu position:", { top, left, rect, scrollY: window.scrollY });
              setPosition({ top, left });
            }
          } catch (error) {
            console.error("Error getting selection range:", error);
          }
        } else {
          setPosition(null);
          setSelectedText("");
          setCopied(false);
        }
      }, 10);
    };

    // 监听鼠标抬起事件
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);

    // 监听点击事件，点击菜单外部关闭
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (selection && !selection.toString().trim() && !editingHighlightId) {
          setPosition(null);
          setSelectedText("");
          setCopied(false);
          setEditingHighlightId(null);
        } else if (editingHighlightId) {
          // 编辑模式下，点击外部也关闭
          setPosition(null);
          setSelectedText("");
          setCopied(false);
          setEditingHighlightId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    // 监听已有高亮的交互事件
    const handleInteraction = (e: any) => {
      const { highlightId, rect, color, text } = e.detail;
      if (highlightId && rect) {
        setEditingHighlightId(highlightId);
        setSelectedText(text || "");
        if (color) setLastUsedColor(color);
        
        // 设置位置
        const top = rect.top;
        const left = rect.left + rect.width / 2;
        setPosition({ top, left });
        
        // 清除原生选区，避免干扰
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener("reader:interaction-highlight", handleInteraction);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("reader:interaction-highlight", handleInteraction);
    };
  }, []);

  const handleHighlight = (color: string) => {
    setLastUsedColor(color);
    localStorage.setItem("newsbox_reader_last_color", color);
    
    if (editingHighlightId && onUpdateHighlight) {
      onUpdateHighlight(editingHighlightId, color);
      setPosition(null);
      setEditingHighlightId(null);
    } else if (onHighlight) {
      onHighlight(selectedText, color);
      // 清除选择
      window.getSelection()?.removeAllRanges();
      setPosition(null);
    }
  };

  const handleAnnotate = () => {
    if (onAnnotate) {
      onAnnotate(selectedText, lastUsedColor, editingHighlightId || undefined);
    }
    // 保持选择或菜单状态，或者关闭菜单
    if (editingHighlightId) {
      setPosition(null);
      setEditingHighlightId(null);
    }
  };

  const handleAIExplain = () => {
    if (onAIExplain) {
      onAIExplain(selectedText);
    }
  };

  const handleSearch = () => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      selectedText
    )}`;
    window.open(searchUrl, "_blank");
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(selectedText);
    if (!ok) {
      console.error("Failed to copy selection text");
      return;
    }

    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      window.getSelection()?.removeAllRanges();
      setPosition(null);
    }, 1500);
  };

  if (!mounted || !position || !selectedText) {
    return null;
  }

  const menu = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[100] flex flex-col items-center gap-2",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%) translateY(-100%) translateY(-15px)",
      }}
    >
      {/* Top Bubble: Colors */}
      <div className="bg-card border rounded-full shadow-xl px-3 py-1.5 flex items-center gap-2">
        {[
          { id: "yellow", class: "bg-[#fef08a]" },
          { id: "green", class: "bg-[#bbf7d0]" },
          { id: "blue", class: "bg-[#bfdbfe]" },
          { id: "pink", class: "bg-[#fbcfe8]" },
          { id: "purple", class: "bg-[#e9d5ff]" },
        ].map((color) => (
          <button
            key={color.id}
            onClick={() => handleHighlight(color.id)}
            className={cn(
              "h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95",
              color.class,
              lastUsedColor === color.id && "ring-2 ring-offset-1 ring-black/10 dark:ring-white/20",
              // 如果是当前颜色的高亮，且在编辑模式，显示选中状态
              editingHighlightId && lastUsedColor === color.id && "ring-2 ring-offset-1 ring-black/20 dark:ring-white/30"
            )}
          />
        ))}
      </div>

      {/* Bottom Bubble: Actions */}
      <div className="bg-card border rounded-2xl shadow-xl p-1 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl hover:bg-muted"
          onClick={() => handleHighlight(lastUsedColor)}
        >
          <Pen className={cn(
            "h-5 w-5",
            lastUsedColor === "yellow" && "text-yellow-500",
            lastUsedColor === "green" && "text-green-500",
            lastUsedColor === "blue" && "text-blue-500",
            lastUsedColor === "pink" && "text-pink-500",
            lastUsedColor === "purple" && "text-purple-500"
          )} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl hover:bg-muted"
          onClick={handleAnnotate}
        >
          <MessageSquare className="h-5 w-5 text-card-foreground" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl hover:bg-muted"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <Copy className="h-5 w-5 text-card-foreground" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl hover:bg-muted"
          onClick={handleAIExplain}
        >
          <Sparkles className="h-5 w-5 text-pink-500" />
        </Button>

        <div className="w-px h-6 bg-slate-200 mx-1 dark:bg-slate-700" />

        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl hover:bg-muted"
          onClick={handleSearch}
        >
          <MoreHorizontal className="h-5 w-5 text-card-foreground" />
        </Button>
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}

