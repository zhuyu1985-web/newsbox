"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun, Upload } from "lucide-react";

const FONT_KEY = "newsbox:readerCustomFont";

type StoredFont = {
  name: string;
  dataUrl: string; // base64 data url
};

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [fontName, setFontName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem(FONT_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw) as StoredFont;
      return parsed?.name ?? "";
    } catch {
      return "";
    }
  });
  const [msg, setMsg] = useState<string | null>(null);

  const saveFont = async (file: File) => {
    setMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const payload: StoredFont = { name: file.name, dataUrl };
      window.localStorage.setItem(FONT_KEY, JSON.stringify(payload));
      setFontName(file.name);
      setMsg("字体已导入（本地保存）。阅读器应用将在下一步接入。");
    };
    reader.onerror = () => setMsg("读取字体失败");
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-base font-bold text-slate-900">外观主题</h3>
        </div>
        <div className="p-6">
          <div className="flex bg-[#f5f5f7] p-1 rounded-xl w-[360px] max-w-full">
            <ThemeBtn active={theme === "system"} onClick={() => setTheme("system")}>
              <Monitor className="h-4 w-4 mr-2" />
              自动跟随系统
            </ThemeBtn>
            <ThemeBtn active={theme === "light"} onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4 mr-2" />
              浅色
            </ThemeBtn>
            <ThemeBtn active={theme === "dark"} onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4 mr-2" />
              深色
            </ThemeBtn>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-base font-bold text-slate-900">阅读器自定义字体</h3>
        </div>
        <div className="p-6">
          <div className="text-xs text-slate-500">
            导入后字体文件仅缓存在浏览器本地，不会云端同步。支持格式：ttf/otf/ttc。
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="inline-flex">
              <input
                type="file"
                accept=".ttf,.otf,.ttc"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void saveFont(f);
                }}
              />
              <Button className="rounded-xl">
                <Upload className="h-4 w-4 mr-2" />
                导入字体…
              </Button>
            </label>
            <div className="text-sm text-slate-700">
              {fontName ? `已导入：${fontName}` : "未导入"}
            </div>
          </div>
          {msg ? <div className="mt-3 text-xs text-slate-500">{msg}</div> : null}
        </div>
      </div>
    </div>
  );
}

function ThemeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center py-2 rounded-lg text-xs transition-all",
        active
          ? "bg-white shadow-sm text-slate-900"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}


