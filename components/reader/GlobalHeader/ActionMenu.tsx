"use client";

import { useState } from "react";
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
}

interface ActionMenuProps {
  note: Note;
}

export function ActionMenu({ note }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = async (action: string) => {
    console.log("Action:", action);

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
          <Star className="h-4 w-4 mr-2" />
          设为星标
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

