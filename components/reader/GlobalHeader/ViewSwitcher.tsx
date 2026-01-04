"use client";

import { Eye, Globe, Sparkles, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewSwitcherProps {
  currentView: "reader" | "web" | "ai-brief" | "archive";
  onViewChange: (view: "reader" | "web" | "ai-brief" | "archive") => void;
  sourceUrl?: string | null;
}

export function ViewSwitcher({ currentView, onViewChange, sourceUrl }: ViewSwitcherProps) {
  const views = [
    { id: "reader" as const, label: "沉浸阅读", icon: Eye },
    { id: "web" as const, label: "原始网页", icon: Globe },
    { id: "ai-brief" as const, label: "AI快照", icon: Sparkles },
    { id: "archive" as const, label: "网页存档", icon: Archive },
  ];

  return (
    <div className="inline-flex items-center bg-muted rounded-lg p-0.5">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            onClick={() => {
              // 原始网页：在新标签页打开
              if (view.id === "web") {
                if (sourceUrl) {
                  window.open(sourceUrl, "_blank");
                  return;
                }
              }
              // 其他视图：正常切换
              onViewChange(view.id);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden xl:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

