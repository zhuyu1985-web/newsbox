"use client";

import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Bell, ChevronLeft, Info, CreditCard, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "mock-1",
    title: "NewsBox AI 1.0 更新",
    message: "我们很高兴地宣布 NewsBox AI 1.0 正式上线！\n\n本次更新包含：\n1. 升级的 LLM 模型，解析速度提升 30%。\n2. 支持对视频内容的深度问答。\n3. 优化了自动标签生成的准确率。\n\n快去体验吧！",
    type: "system",
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

// 获取通知类型的图标
function getNotificationIcon(type: string) {
  switch (type) {
    case "membership_expiring_7d":
    case "membership_expiring_3d":
      return <CreditCard className="w-4 h-4 text-amber-500" />;
    case "membership_expired":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

// 格式化日期
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function NotificationsPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [loading, setLoading] = useState(false);

  // 从数据库加载通知
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        // 合并数据库通知和默认通知
        setNotifications(data.length > 0 ? data : MOCK_NOTIFICATIONS);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleRead = async (id: string) => {
    // 更新本地状态
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    // 如果不是 mock 通知，更新数据库
    if (!id.startsWith("mock-")) {
      try {
        const supabase = createClient();
        await supabase
          .from("user_notifications")
          .update({ is_read: true })
          .eq("id", id);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
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
              <div className="text-xs text-slate-400 mb-6">{formatDate(activeNote.created_at)}</div>
              <div className="prose prose-sm prose-slate max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                {activeNote.message}
              </div>
              {activeNote.link && (
                <Link
                  href={activeNote.link}
                  className="mt-6 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => setOpen(false)}
                >
                  查看详情 &rarr;
                </Link>
              )}
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
                    !note.is_read ? "bg-white/50" : "opacity-80 hover:opacity-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mt-2 shrink-0 transition-colors",
                      !note.is_read ? "bg-[#FF4D4D]" : "bg-transparent"
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm truncate",
                          !note.is_read
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700"
                        )}
                      >
                        {note.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {note.message}
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

