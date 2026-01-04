"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReaderPreferences } from "@/components/reader/ReaderPreferencesProvider";

interface AppearanceMenuProps {
  contentType: "article" | "video" | "audio";
  currentView: "reader" | "web" | "ai-brief" | "archive";
}

export function AppearanceMenu({ contentType, currentView }: AppearanceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { prefs, setPrefs, reset, hasCustomFont } = useReaderPreferences();

  const canUseTypography = currentView === "reader" && contentType === "article";

  const fontSize = prefs.fontSize;
  const decFont = () => setPrefs((p) => ({ fontSize: Math.max(12, p.fontSize - 1) }));
  const incFont = () => setPrefs((p) => ({ fontSize: Math.min(28, p.fontSize + 1) }));

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="阅读器样式">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>阅读器设置</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-3 space-y-4">
          {contentType === "article" ? (
            <>
              {currentView !== "reader" ? (
                <div className="text-xs text-slate-500">
                  提示：字号/行高/字体仅在“沉浸阅读”视图下生效（切到“阅读”即可看到变化）
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">字号</label>
                  <button
                    className="text-[11px] text-slate-500 hover:text-slate-700"
                    onClick={() => reset()}
                    type="button"
                  >
                    重置
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={decFont} disabled={!canUseTypography}>
                    A-
                  </Button>
                  <div className="flex-1 text-center text-sm tabular-nums">{fontSize}px</div>
                  <Button variant="outline" size="sm" onClick={incFont} disabled={!canUseTypography}>
                    A+
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">行高</label>
                <div className="flex gap-2">
                  {([
                    { id: "compact", label: "紧凑" },
                    { id: "comfortable", label: "适中" },
                    { id: "loose", label: "宽松" },
                  ] as const).map((x) => (
                    <Button
                      key={x.id}
                      variant="outline"
                      size="sm"
                      className={cn("flex-1", prefs.lineHeight === x.id && "bg-blue-50 text-blue-600 border-blue-200")}
                      onClick={() => setPrefs({ lineHeight: x.id })}
                      disabled={!canUseTypography}
                    >
                      {x.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">主题</label>
                <div className="flex gap-2">
                  {([
                    { id: "light", label: "亮色" },
                    { id: "dark", label: "暗色" },
                    { id: "sepia", label: "护眼" },
                  ] as const).map((x) => (
                    <Button
                      key={x.id}
                      variant="outline"
                      size="sm"
                      className={cn("flex-1", prefs.theme === x.id && "bg-blue-50 text-blue-600 border-blue-200")}
                      onClick={() => setPrefs({ theme: x.id })}
                      disabled={false}
                    >
                      {x.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">字体</label>
                <div className="flex gap-2">
                  {([
                    { id: "system", label: "系统" },
                    { id: "serif", label: "衬线" },
                    { id: "custom", label: "自定义" },
                  ] as const).map((x) => (
                    <Button
                      key={x.id}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1",
                        prefs.fontFamily === x.id && "bg-blue-50 text-blue-600 border-blue-200",
                        x.id === "custom" && !hasCustomFont && "opacity-50",
                      )}
                      onClick={() => setPrefs({ fontFamily: x.id })}
                      disabled={!canUseTypography || (x.id === "custom" && !hasCustomFont)}
                      title={x.id === "custom" && !hasCustomFont ? "请先在设置-外观中导入字体" : undefined}
                    >
                      {x.label}
                    </Button>
                  ))}
                </div>
                {!hasCustomFont ? (
                  <div className="mt-2 text-[11px] text-slate-500">提示：可在“设置 → 外观”中导入自定义字体</div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-500">该内容类型的外观设置暂未接入。</div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

