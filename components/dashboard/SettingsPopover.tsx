"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { User, Settings as SettingsIcon, LogOut, Moon, Sun, Monitor, Keyboard, Shield } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function SettingsPopover({
  user,
  onSignOut,
  children,
}: {
  user: any;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // 获取用户首字母或默认 A
  const initial = user?.email?.[0]?.toUpperCase() || "U";
  const email = user?.email || "unknown@example.com";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-[280px] p-2 bg-white/95 backdrop-blur-md border-black/5 shadow-2xl rounded-2xl"
      >
        {/* User Info */}
        <div className="flex items-center gap-3 px-3 py-3 mb-1">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-lg border border-black/5">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {email.split("@")[0]}
            </div>
            <div className="text-xs text-slate-400 truncate">{email}</div>
          </div>
        </div>

        <div className="h-px bg-black/5 mx-2 my-1" />

        {/* Menu Items */}
        <div className="space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-left text-sm text-slate-700">
            <SettingsIcon className="h-4 w-4" />
            偏好设置
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-left text-sm text-slate-700">
            <Keyboard className="h-4 w-4" />
            快捷键
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-left text-sm text-slate-700">
            <Shield className="h-4 w-4" />
            隐私与安全
          </button>
        </div>

        <div className="h-px bg-black/5 mx-2 my-1" />

        {/* Theme Switcher */}
        <div className="px-3 py-2">
          <div className="text-xs font-medium text-slate-400 mb-2">外观</div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex-1 flex items-center justify-center py-1 rounded-md text-xs transition-all",
                theme === "light"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Sun className="h-3.5 w-3.5 mr-1" />
              浅色
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex-1 flex items-center justify-center py-1 rounded-md text-xs transition-all",
                theme === "dark"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Moon className="h-3.5 w-3.5 mr-1" />
              深色
            </button>
            <button
              onClick={() => setTheme("system")}
              className={cn(
                "flex-1 flex items-center justify-center py-1 rounded-md text-xs transition-all",
                theme === "system"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Monitor className="h-3.5 w-3.5 mr-1" />
              自动
            </button>
          </div>
        </div>

        <div className="h-px bg-black/5 mx-2 my-1" />

        {/* Sign Out */}
        <button
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-left text-sm text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </PopoverContent>
    </Popover>
  );
}

