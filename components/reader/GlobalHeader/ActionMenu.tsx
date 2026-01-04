"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Share2,
  ExternalLink,
  Link as LinkIcon,
  Copy,
  Download,
  Star,
  FolderInput,
  Edit,
  Archive,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string | null;
  source_url: string | null;
  content_type: "article" | "video" | "audio";
  is_starred?: boolean;
}

interface ActionMenuProps {
  note: Note;
  onNoteChange?: (updates: Partial<Note>) => void;
}

export function ActionMenu({ note, onNoteChange }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(note.is_starred || false);
  const supabase = createClient();

  // 获取当前星标状态
  useEffect(() => {
    const fetchStarredStatus = async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("is_starred")
        .eq("id", note.id)
        .single();

      if (!error && data) {
        setIsStarred(data.is_starred);
      }
    };

    fetchStarredStatus();
  }, [note.id, supabase]);

  // 监听来自 ReaderLayout 的星标状态变化事件
  useEffect(() => {
    const handleStarChanged = (e: any) => {
      if (e.detail?.isStarred !== undefined) {
        setIsStarred(e.detail.isStarred);
      }
    };

    window.addEventListener('reader:star-changed', handleStarChanged);
    return () => window.removeEventListener('reader:star-changed', handleStarChanged);
  }, []);

  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMsg);
    } catch (err) {
      console.error("复制失败:", err);
      toast.error("复制失败，请重试");
    }
  };

  const handleAction = async (action: string) => {
    console.log("Action:", action);

    switch (action) {
      case "share": {
        // TODO: 实现分享功能
        toast.info("分享功能即将上线");
        break;
      }

      case "copy-url": {
        if (!note.source_url) {
          toast.error("当前笔记缺少来源链接");
          return;
        }
        await copyToClipboard(note.source_url, "原链接已复制");
        break;
      }

      case "copy-markdown-link": {
        if (!note.source_url) {
          toast.error("当前笔记缺少来源链接");
          return;
        }
        const mdLink = `[${note.title || "链接"}](${note.source_url})`;
        await copyToClipboard(mdLink, "Markdown 链接已复制");
        break;
      }

      case "copy-citation": {
        if (!note.source_url) {
          toast.error("当前笔记缺少来源链接");
          return;
        }
        const now = new Date().toLocaleDateString("zh-CN");
        const citation = `> 来源：${note.title || "无标题"}\n> 链接：${note.source_url}\n> 保存日期：${now}`;
        await copyToClipboard(citation, "引用格式已复制");
        break;
      }

      case "copy-text":
      case "copy-markdown":
      case "copy-html": {
        // 获取笔记的完整内容
        const { data: noteData, error } = await supabase
          .from("notes")
          .select("content_text, content_html, title, source_url, author, site_name, published_at")
          .eq("id", note.id)
          .single();

        if (error || !noteData) {
          toast.error("获取笔记内容失败");
          return;
        }

        if (action === "copy-text") {
          // 复制纯文本
          const text = noteData.content_text || "";
          if (!text) {
            toast.error("当前笔记没有可复制的文本内容");
            return;
          }
          await copyToClipboard(text, "纯文本已复制");
        } else if (action === "copy-html") {
          // 复制 HTML
          const html = noteData.content_html || "";
          if (!html) {
            toast.error("当前笔记没有可复制的 HTML 内容");
            return;
          }
          await copyToClipboard(html, "HTML 已复制");
        } else if (action === "copy-markdown") {
          // 复制 Markdown（简单转换）
          const title = noteData.title || "";
          const url = noteData.source_url || "";
          const author = noteData.author || "";
          const siteName = noteData.site_name || "";
          const publishedAt = noteData.published_at
            ? new Date(noteData.published_at).toLocaleDateString("zh-CN")
            : "";

          let markdown = "";
          if (title) markdown += `# ${title}\n\n`;
          if (author || siteName || publishedAt) {
            markdown += "> ";
            if (author) markdown += `作者：${author} `;
            if (siteName) markdown += `来源：${siteName} `;
            if (publishedAt) markdown += `发布时间：${publishedAt}`;
            markdown += "\n\n";
          }
          if (url) markdown += `原文链接：${url}\n\n---\n\n`;

          // 简单的 HTML 到 Markdown 转换（基础版）
          let content = noteData.content_text || noteData.content_html || "";
          // 移除 HTML 标签（非常基础的处理）
          content = content.replace(/<[^>]*>/g, "");
          // 清理多余的空白
          content = content.replace(/\s+/g, " ").trim();
          markdown += content;

          await copyToClipboard(markdown, "Markdown 已复制");
        }
        break;
      }

      case "export-pdf":
      case "export-markdown":
      case "export-txt": {
        toast.info("导出功能即将上线");
        break;
      }

      case "star": {
        // 切换星标状态
        const newStarredState = !isStarred;
        const { error } = await supabase
          .from("notes")
          .update({ is_starred: newStarredState })
          .eq("id", note.id);

        if (error) {
          console.error("星标更新失败:", error);
          toast.error("操作失败，请重试");
          return;
        }

        setIsStarred(newStarredState);
        toast.success(newStarredState ? "已设为星标" : "已取消星标");

        // 通知父组件状态变化
        onNoteChange?.({ is_starred: newStarredState });

        // 派发自定义事件，通知 ReaderLayout 状态已更新
        window.dispatchEvent(new CustomEvent('reader:star-changed', {
          detail: { isStarred: newStarredState }
        }));
        break;
      }

      case "move": {
        // TODO: 实现移动到文件夹功能
        toast.info("移动功能即将上线");
        break;
      }

      case "edit": {
        // TODO: 实现编辑元信息功能
        toast.info("编辑功能即将上线");
        break;
      }

      case "archive": {
        // TODO: 实现归档功能
        toast.info("归档功能即将上线");
        break;
      }

      case "delete": {
        // TODO: 实现删除功能
        toast.info("删除功能即将上线");
        break;
      }

      default:
        console.log("未知操作:", action);
    }

    setIsOpen(false);
  };

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="更多操作" className="focus-visible:outline-none focus-visible:ring-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>更多操作</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* 分享 */}
        <DropdownMenuItem onClick={() => handleAction("share")}>
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </DropdownMenuItem>

        {/* 访问原网页 */}
        <DropdownMenuItem
          onClick={() => {
            if (!note.source_url) {
              toast.error("当前笔记缺少来源链接");
              return;
            }
            window.open(note.source_url, "_blank");
          }}
          disabled={!note.source_url}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          访问原网页
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 复制链接 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LinkIcon className="h-4 w-4 mr-2" />
            复制链接
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAction("copy-url")}>
              复制原链接
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("copy-markdown-link")}>
              复制Markdown链接
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("copy-citation")}>
              复制为引用
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 复制内容 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Copy className="h-4 w-4 mr-2" />
            复制内容
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAction("copy-text")}>
              复制纯文本
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("copy-markdown")}>
              复制Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("copy-html")}>
              复制HTML
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 导出 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="h-4 w-4 mr-2" />
            导出
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAction("export-pdf")}>
              导出为PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("export-markdown")}>
              导出为Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("export-txt")}>
              导出为TXT
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* 整理 */}
        <DropdownMenuItem onClick={() => handleAction("star")}>
          <Star className={cn("h-4 w-4 mr-2", isStarred && "fill-yellow-400 text-yellow-400")} />
          {isStarred ? "取消星标" : "设为星标"}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction("move")}>
          <FolderInput className="h-4 w-4 mr-2" />
          移动到文件夹
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction("edit")}>
          <Edit className="h-4 w-4 mr-2" />
          编辑元信息
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction("archive")}>
          <Archive className="h-4 w-4 mr-2" />
          归档
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleAction("delete")}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

