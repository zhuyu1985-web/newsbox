"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Bell, ChevronLeft, Info } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  read: boolean;
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "NewsBox AI 1.0 更新",
    summary: "全新 AI 引擎，更精准的摘要与问答...",
    content: "我们很高兴地宣布 NewsBox AI 1.0 正式上线！\n\n本次更新包含：\n1. 升级的 LLM 模型，解析速度提升 30%。\n2. 支持对视频内容的深度问答。\n3. 优化了自动标签生成的准确率。\n\n快去体验吧！",
    date: "2025-01-03",
    read: false,
  },
  {
    id: "2",
    title: "浏览器扩展升级",
    summary: "修复了部分网站无法抓取的问题...",
    content: "浏览器扩展版本 8.1.0 已发布。\n\n修复了以下问题：\n- 某些动态加载网站无法正确识别正文。\n- 优化了图片抓取逻辑，支持 WebP 格式。\n\n请在浏览器扩展商店更新。",
    date: "2025-01-03",
    read: true,
  },
  {
    id: "3",
    title: "欢迎使用 NewsBox",
    summary: "新手指南：如何高效管理你的知识库...",
    content: "欢迎来到 NewsBox\n\n这里有一些入门建议：\n1. 安装浏览器扩展，一键收藏网页。\n2. 绑定微信，转发文章即可收藏。\n3. 尝试使用 AI 解读功能，快速获取文章要点。\n\n祝你使用愉快！",
    date: "2025-01-03",
    read: true,
  },
];

export function NotificationsPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClickItem = (note: Notification) => {
    handleRead(note.id);
    setActiveNote(note);
  };

  const handleBack = () => {
    setActiveNote(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          {children}
          {unreadCount > 0 && (
            <span className="absolute top-[10px] right-[10px] w-2.5 h-2.5 bg-[#FF4D4D] rounded-full border-[2.5px] border-[#EBECEE] shadow-sm pointer-events-none" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-[360px] p-0 overflow-hidden bg-white/95 backdrop-blur-md border-black/5 shadow-2xl rounded-2xl"
      >
        <div className="px-5 pt-4 pb-3 border-b border-black/5">
          <div className="flex items-center gap-2 h-7">
            {activeNote ? (
              <button
                onClick={handleBack}
                className="flex items-center text-slate-500 hover:text-slate-900 transition-colors -ml-1 pr-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                返回
              </button>
            ) : (
              <div className="text-base font-semibold text-slate-900">系统通知</div>
            )}
            
            {!activeNote && unreadCount > 0 && (
              <span className="bg-[#FF4D4D]/10 text-[#FF4D4D] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount} 未读
              </span>
            )}
          </div>
        </div>

        <div className="h-[400px] overflow-y-auto bg-slate-50/50">
          {activeNote ? (
            <div className="p-6 animate-in slide-in-from-right-4 duration-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">
                {activeNote.title}
              </h3>
              <div className="text-xs text-slate-400 mb-6">{activeNote.date}</div>
              <div className="prose prose-sm prose-slate max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                {activeNote.content}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {notifications.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleClickItem(note)}
                  className={cn(
                    "w-full flex gap-3 px-3 py-3 rounded-xl transition-all text-left group relative overflow-hidden",
                    "hover:bg-white hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]",
                    !note.read ? "bg-white/50" : "opacity-80 hover:opacity-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mt-2 shrink-0 transition-colors",
                      !note.read ? "bg-[#FF4D4D]" : "bg-transparent"
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm truncate",
                          !note.read
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700"
                        )}
                      >
                        {note.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {note.date}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {note.summary}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

