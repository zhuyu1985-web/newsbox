"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  Plus,
  Puzzle,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_STORAGE_KEY = "newsbox:onboarding:v1:completed";
const OPEN_ONBOARDING_EVENT = "newsbox:open-onboarding";

const steps = [
  {
    title: "先保存第一条内容",
    description: "用右上角加号保存网页链接、粘贴文字，或上传本地文件。NewsBox 会把内容变成可阅读、可检索的笔记。",
    icon: Plus,
    actionLabel: "新建笔记",
    action: "create-note",
  },
  {
    title: "安装浏览器插件",
    description: "插件能在当前页面一键收藏，也能在视频平台遇到反盗链时走浏览器侧保存。",
    icon: Puzzle,
    actionLabel: "查看安装说明",
    action: "extension",
  },
  {
    title: "打开 AI 解读",
    description: "进入任意新闻详情页后，可用 AI 解读、关键问题和追问对话快速判断内容价值。",
    icon: Sparkles,
    actionLabel: "知道了",
    action: "next",
  },
  {
    title: "整理成你的知识库",
    description: "用标签、收藏夹、星标和批注把信息沉淀下来，后续可以在知识库里继续追问和复用。",
    icon: FolderKanban,
    actionLabel: "完成引导",
    action: "finish",
  },
] as const;

type ProductOnboardingProps = {
  onCreateNote: () => void;
};

export function ProductOnboarding({ onCreateNote }: ProductOnboardingProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const shouldShow = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
    if (shouldShow) {
      const timer = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const openGuide = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_ONBOARDING_EVENT, openGuide);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, openGuide);
  }, []);

  const complete = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
  };

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      complete();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const runAction = () => {
    const action = steps[stepIndex].action;
    if (action === "create-note") {
      onCreateNote();
      complete();
      return;
    }
    if (action === "extension") {
      complete();
      router.push("/extension");
      return;
    }
    goNext();
  };

  const current = steps[stepIndex];
  const CurrentIcon = current.icon;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <BookOpen className="h-4 w-4 text-blue-600" />
                NewsBox 使用引导
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={complete}
                aria-label="关闭使用引导"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center gap-2">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      index <= stepIndex ? "bg-blue-600" : "bg-muted"
                    )}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={current.title}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="min-h-[210px]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <CurrentIcon className="h-7 w-7" />
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                    第 {stepIndex + 1} 步 / 共 {steps.length} 步
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-card-foreground">
                    {current.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {current.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={complete}>
                  跳过
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex((currentStep) => Math.max(0, currentStep - 1))}
                  >
                    上一步
                  </Button>
                  <Button onClick={runAction}>
                    {current.actionLabel}
                    {current.action !== "finish" ? <ArrowRight className="h-4 w-4" /> : null}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function openProductOnboarding() {
  window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_EVENT));
}
