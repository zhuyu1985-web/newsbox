"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Brain,
  ChevronRight,
  Clock,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getMembershipBlockedCopy,
  parseMembershipErrorPayload,
} from "@/lib/membership/client-error";
import { showUpgradeDialog } from "@/components/ui/upgrade-dialog";

interface AIOutputRow {
  summary: string | null;
  key_questions: any | null;
  journalist_view: any | null;
  timeline: any | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface StakeholderItem {
  name: string;
  role?: string;
  stance?: string;
}

interface TimelineItem {
  time: string;
  event: string;
  source?: string;
}

type AISubTab = "overview" | "qa" | "deep" | "annotation";

function safeArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function safeObject(v: any): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function toStringArray(v: any): string[] {
  return safeArray(v)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizeStakeholders(v: any): StakeholderItem[] {
  return safeArray(v)
    .map((item) => {
      const record = safeObject(item);
      const name = String(record.name || "").trim();
      if (!name) return null;
      return {
        name,
        role: record.role ? String(record.role).trim() : undefined,
        stance: record.stance ? String(record.stance).trim() : undefined,
      };
    })
    .filter(Boolean) as StakeholderItem[];
}

function normalizeTimeline(v: any): TimelineItem[] {
  return safeArray(v)
    .map((item) => {
      const record = safeObject(item);
      const event = String(record.event || "").trim();
      if (!event) return null;
      return {
        time: String(record.time || "原文未明确说明").trim() || "原文未明确说明",
        event,
        source: record.source ? String(record.source).trim() : undefined,
      };
    })
    .filter(Boolean) as TimelineItem[];
}

function parseSSEBlock(block: string): { event: string; data: string } | null {
  const lines = block
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);

  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export function AIAnalysisPanel({
  noteId,
  contentType,
}: {
  noteId: string;
  contentType: string;
}) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AIOutputRow | null>(null);

  const [subTab, setSubTab] = useState<AISubTab>("overview");
  const [generating, setGenerating] = useState(false);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabledRef = useRef(true);

  const journalistView = useMemo(() => safeObject(analysis?.journalist_view), [analysis?.journalist_view]);
  const deepRead = useMemo(() => safeObject(journalistView.deep_read), [journalistView]);

  const fastRead = journalistView.fast_read || null;
  const takeaways = useMemo(() => toStringArray(fastRead?.takeaways), [fastRead?.takeaways]);

  const keyQuestions = useMemo(() => {
    const raw = analysis?.key_questions;
    return safeArray(raw);
  }, [analysis?.key_questions]);

  const keyQuestionsMissing = useMemo(
    () => toStringArray(journalistView.key_questions_missing),
    [journalistView.key_questions_missing]
  );
  const deepOverview = useMemo(() => String(deepRead.overview || "").trim(), [deepRead.overview]);
  const deepBackground = useMemo(() => toStringArray(deepRead.background), [deepRead.background]);
  const deepImplications = useMemo(() => toStringArray(deepRead.implications), [deepRead.implications]);
  const deepRisks = useMemo(() => toStringArray(deepRead.risks), [deepRead.risks]);
  const deepWatchpoints = useMemo(() => toStringArray(deepRead.watchpoints), [deepRead.watchpoints]);
  const stakeholders = useMemo(() => normalizeStakeholders(deepRead.stakeholders), [deepRead.stakeholders]);
  const timelineItems = useMemo(() => normalizeTimeline(analysis?.timeline), [analysis?.timeline]);

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    if (!autoScrollEnabledRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: messages.length <= 2 ? "auto" : "smooth", block: "end" });
  }, [messages.length]);

  const handleChatScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    autoScrollEnabledRef.current = atBottom;
  };

  // 选中文本触发：ArticleReader 会 dispatch `reader:switch-tab` 并携带 text
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.tab !== "ai-analysis") return;
      const text = e?.detail?.text;
      if (text && typeof text === "string") {
        setSubTab("annotation");
        handleChat(`请帮我解释一下这段文字（术语/背景/潜台词），并尽量结合上下文：\n\n"${text}"`);
      }
    };
    window.addEventListener("reader:switch-tab", handler);
    return () => window.removeEventListener("reader:switch-tab", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, messages, chatLoading]);

  const loadAnalysis = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("ai_outputs")
      .select("summary, key_questions, journalist_view, timeline")
      .eq("note_id", noteId)
      .single();

    if (!error && data) {
      setAnalysis(data as any);
    } else {
      setAnalysis(null);
    }

    setLoading(false);
  };

  const showMembershipBlockedPrompt = (payload: unknown) => {
    const membershipError = parseMembershipErrorPayload(payload);
    if (!membershipError) return false;

    const feature = "AI 解读";
    toast.error(
      getMembershipBlockedCopy({
        requiredPlan: membershipError.requiredPlan,
        feature,
        message: membershipError.message,
      })
    );
    showUpgradeDialog({
      requiredPlan: membershipError.requiredPlan,
      feature,
    });
    return true;
  };

  const applyStreamEvent = (event: string, payload: any) => {
    if (event === "cached") {
      setAnalysis((prev) => ({
        summary: payload?.summary ?? prev?.summary ?? null,
        key_questions: payload?.key_questions ?? prev?.key_questions ?? [],
        journalist_view: payload?.journalist_view ?? prev?.journalist_view ?? null,
        timeline: payload?.timeline ?? prev?.timeline ?? null,
      }));
      return;
    }

    if (event === "fast_read") {
      setAnalysis((prev) => {
        const base: AIOutputRow =
          prev || ({ summary: null, key_questions: [], journalist_view: {}, timeline: null } as any);
        const merged = {
          ...(base.journalist_view || {}),
          fast_read: payload,
        };
        return {
          ...base,
          summary: payload?.hook ?? base.summary,
          journalist_view: merged,
        };
      });
      return;
    }

    if (event === "key_questions") {
      setAnalysis((prev) => {
        const base: AIOutputRow =
          prev || ({ summary: null, key_questions: [], journalist_view: {}, timeline: null } as any);
        const merged = {
          ...(base.journalist_view || {}),
          key_questions_missing: payload?.missing || [],
        };
        return {
          ...base,
          key_questions: payload?.questions || [],
          journalist_view: merged,
        };
      });
      return;
    }

    if (event === "deep_analysis") {
      setAnalysis((prev) => {
        const base: AIOutputRow =
          prev || ({ summary: null, key_questions: [], journalist_view: {}, timeline: null } as any);
        const merged = {
          ...(base.journalist_view || {}),
          deep_read: {
            overview: payload?.overview || "",
            background: payload?.background || [],
            stakeholders: payload?.stakeholders || [],
            implications: payload?.implications || [],
            risks: payload?.risks || [],
            watchpoints: payload?.watchpoints || [],
          },
        };
        return {
          ...base,
          journalist_view: merged,
          timeline: payload?.timeline || base.timeline,
        };
      });
      return;
    }

    if (event === "warn") {
      toast.message("AI 解读已生成（未能写入缓存）", { description: payload?.detail || payload?.message });
      return;
    }

    if (event === "error") {
      if (showMembershipBlockedPrompt(payload)) {
        return "membership-blocked";
      }
      toast.error(payload?.message || "AI 解读生成失败");
      return "error";
    }
  };

  const handleGenerate = async (opts?: { force?: boolean }) => {
    if (generating) return;

    setGenerating(true);
    try {
      const response = await fetch("/api/ai/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, force: !!opts?.force }),
      });

      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || "生成失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      let buffer = "";
      let hasStreamError = false;
      let completed = false;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx < 0) break;
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const parsed = parseSSEBlock(block);
          if (!parsed) continue;

          try {
            const payload = JSON.parse(parsed.data);
            const result = applyStreamEvent(parsed.event, payload);
            if (parsed.event === "error") hasStreamError = true;
            if (result === "membership-blocked") hasStreamError = true;
            if (parsed.event === "done") completed = true;
          } catch {
            // ignore invalid chunks
          }
        }
      }

      if (!hasStreamError && completed) {
        toast.success("AI 解读生成完成");
      }
    } catch (e) {
      toast.error(`生成失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleChat = async (userMessage?: string) => {
    const text = (userMessage ?? input).trim();
    if (!text || chatLoading) return;

    setInput("");
    setChatLoading(true);

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, messages: nextMessages }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (showMembershipBlockedPrompt(payload)) return;
        throw new Error(payload?.message || payload?.error || "对话失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let carry = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        carry += decoder.decode(value, { stream: true });
        const lines = carry.split("\n");
        carry = lines.pop() || "";

        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;
          if (!l.startsWith("data:")) continue;

          const data = l.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (!delta) continue;

            assistantMessage += delta;
            setMessages([...nextMessages, { role: "assistant", content: assistantMessage }]);
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "对话出错了");
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground/70">加载 AI 数据中...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-muted/30 dark:bg-slate-900/30 text-[15px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border dark:border-slate-800 bg-card dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold text-card-foreground dark:text-slate-200">AI 智能解读</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-card-foreground dark:text-muted-foreground/70 hover:bg-muted dark:hover:bg-slate-800 font-semibold px-3"
              onClick={() => handleGenerate({ force: true })}
              disabled={generating}
              title="忽略缓存重新生成"
            >
              {generating ? "生成中..." : "重生成"}
            </Button>
            <Button
              size="sm"
              variant="glass"
              className="h-9 rounded-full text-xs font-semibold px-3.5"
              onClick={() => handleGenerate()}
              disabled={generating}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {analysis ? "更新解读" : "生成解读"}
            </Button>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="px-2 flex gap-1 mt-3 mb-2">
          {([
            { id: "overview", label: "概览" },
            { id: "qa", label: "问答" },
            { id: "deep", label: "精读" },
            { id: "annotation", label: "批注" },
          ] as Array<{ id: AISubTab; label: string }>).map((t) => {
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={cn(
                  "relative flex-1 py-2 text-[13px] rounded-xl transition-all duration-200",
                  isActive ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground dark:text-muted-foreground/70 hover:text-blue-500 hover:bg-card/50 dark:hover:bg-slate-800/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/10 dark:border-blue-500/20 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4"
      >
        {!analysis ? (
          <div className="flex min-h-[360px] items-center px-1 py-6">
            <div className="relative w-full overflow-hidden rounded-lg border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.08] via-card to-cyan-500/[0.07] p-5 shadow-sm">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 left-6 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/10 text-blue-600 shadow-inner dark:text-blue-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-[14px] font-semibold text-card-foreground dark:text-slate-100">暂无 AI 解读</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  生成后会在这里呈现快读、关键问题、背景脉络与后续追问。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border/70 bg-background/65 px-3 py-2">
                    <Brain className="mb-2 h-3.5 w-3.5 text-blue-500" />
                    <div className="text-[11px] font-medium text-muted-foreground">提炼核心信息</div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/65 px-3 py-2">
                    <MessageSquare className="mb-2 h-3.5 w-3.5 text-cyan-500" />
                    <div className="text-[11px] font-medium text-muted-foreground">继续追问细节</div>
                  </div>
                </div>
                <Button
                  onClick={() => handleGenerate()}
                  disabled={generating}
                  variant="glass"
                  className="mt-5 h-9 rounded-full px-5 text-[13px] font-semibold shadow-sm"
                >
                  {generating ? "正在生成..." : "生成 AI 解读"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={subTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {subTab === "overview" && (
                <div className="space-y-4">
                  <section className="bg-card dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50/80 dark:bg-blue-900/30 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-[14px] font-bold text-card-foreground dark:text-slate-200">⚡ AI 快读</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70 dark:text-muted-foreground font-bold">
                        <Clock className="h-3.5 w-3.5" />
                        {fastRead?.read_time_minutes ? `${fastRead.read_time_minutes} 分钟` : "-"}
                      </div>
                    </div>

                    <div className="px-4 py-4 space-y-3">
                      <div className="text-[14.5px] font-bold text-card-foreground dark:text-slate-200 leading-relaxed">
                        {fastRead?.hook || analysis.summary}
                      </div>

                      {takeaways.length > 0 && (
                        <ul className="space-y-1.5">
                          {takeaways.slice(0, 5).map((pt: any, i: number) => (
                            <li key={i} className="text-[14px] text-card-foreground dark:text-muted-foreground/70 flex gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-300 dark:bg-blue-600 flex-shrink-0" />
                              {String(pt)}
                            </li>
                          ))}
                        </ul>
                      )}

                      {fastRead?.sentiment && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="px-2 py-0.5 rounded-md bg-muted dark:bg-slate-800 text-card-foreground dark:text-muted-foreground/70 text-[12px] font-bold">
                            #{fastRead.sentiment}
                          </span>
                        </div>
                      )}

                      {(!fastRead?.hook || takeaways.length === 0) && (
                        <div className="text-[13px] text-muted-foreground/70">
                          当前仅有旧版解读数据，建议点击右上角“更新解读”生成新版快读。
                        </div>
                      )}
                    </div>
                  </section>

                  <button
                    type="button"
                    className="w-full text-left bg-card dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] px-4 py-3 hover:bg-muted dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setSubTab("qa")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[14.5px] font-bold text-card-foreground dark:text-slate-200">❓ 进入关键问题</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground dark:text-muted-foreground/70">用 3 个问题带你把文章读“透”。</div>
                  </button>
                </div>
              )}

              {subTab === "qa" && (
                <section className="bg-card dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800">
                    <div className="text-[14.5px] font-bold text-card-foreground dark:text-slate-200">❓ 关键问题</div>
                    <div className="mt-1 text-[13px] text-muted-foreground dark:text-muted-foreground/70">每个问题都尽量用原文作答，并附带证据片段。</div>
                  </div>

                  <div className="p-4 space-y-4">
                    {keyQuestions.length === 0 ? (
                      <div className="text-[13px] text-muted-foreground/70">暂无关键问题数据，点击右上角“更新解读”生成。</div>
                    ) : (
                      keyQuestions.slice(0, 8).map((qa: any, i: number) => (
                        <div key={i} className="rounded-xl border border-border dark:border-slate-800 bg-muted/40 dark:bg-slate-800/40 p-3">
                          <div className="text-[13.5px] font-black text-card-foreground dark:text-slate-200">Q{i + 1}: {qa.q || qa.question}</div>
                          <div className="mt-2 text-[14px] text-card-foreground dark:text-muted-foreground/70 leading-relaxed">{qa.a || qa.answer}</div>
                          {(qa.evidence || qa.evidence_snippet) && (
                            <div className="mt-2 text-[12px] text-muted-foreground/70 dark:text-muted-foreground border-l-2 border-border dark:border-slate-700 pl-2">
                              “{qa.evidence || qa.evidence_snippet}”
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {keyQuestionsMissing.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 text-[13.5px] font-bold text-popover-foreground dark:text-muted-foreground/50 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          未解之谜 / 逻辑缺口
                        </div>
                        <ul className="space-y-1.5">
                          {keyQuestionsMissing.slice(0, 5).map((m: any, idx: number) => (
                            <li key={idx} className="text-[13.5px] text-card-foreground dark:text-muted-foreground/70 flex gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                              {String(m)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {subTab === "deep" && (
                <div className="space-y-4">
                  <section className="bg-card dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800">
                      <div className="text-[14.5px] font-bold text-card-foreground dark:text-slate-200">🧐 AI 精读</div>
                      <div className="mt-1 text-[13px] text-muted-foreground dark:text-muted-foreground/70">把背景、主体、影响、风险与时间线拆成可直接阅读的结构化结果。</div>
                    </div>
                    <div className="p-4 space-y-4">
                      {deepOverview ? (
                        <div className="rounded-xl border border-border dark:border-slate-800 bg-muted/40 dark:bg-slate-800/40 p-4">
                          <div className="text-[13px] font-bold text-muted-foreground dark:text-muted-foreground/70">核心判断</div>
                          <div className="mt-2 text-[14px] leading-7 text-card-foreground dark:text-slate-200">{deepOverview}</div>
                        </div>
                      ) : null}

                      {deepBackground.length > 0 && (
                        <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                          <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">背景脉络</div>
                          <ul className="mt-3 space-y-2">
                            {deepBackground.map((item, index) => (
                              <li key={index} className="flex gap-2 text-[13.5px] text-card-foreground dark:text-muted-foreground/70">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {stakeholders.length > 0 && (
                        <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                          <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">相关主体</div>
                          <div className="mt-3 space-y-3">
                            {stakeholders.map((item, index) => (
                              <div key={`${item.name}-${index}`} className="rounded-xl bg-muted/50 dark:bg-slate-800/50 border border-border dark:border-slate-700 p-3">
                                <div className="text-[13.5px] font-semibold text-card-foreground dark:text-slate-200">{item.name}</div>
                                {(item.role || item.stance) && (
                                  <div className="mt-1 space-y-1 text-[12.5px] text-muted-foreground dark:text-muted-foreground/70">
                                    {item.role ? <div>角色：{item.role}</div> : null}
                                    {item.stance ? <div>关注点：{item.stance}</div> : null}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(deepImplications.length > 0 || deepRisks.length > 0 || deepWatchpoints.length > 0) && (
                        <div className="grid gap-4 md:grid-cols-3">
                          {deepImplications.length > 0 && (
                            <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                              <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">影响分析</div>
                              <ul className="mt-3 space-y-2">
                                {deepImplications.map((item, index) => (
                                  <li key={index} className="flex gap-2 text-[13.5px] text-card-foreground dark:text-muted-foreground/70">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {deepRisks.length > 0 && (
                            <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                              <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">风险与争议</div>
                              <ul className="mt-3 space-y-2">
                                {deepRisks.map((item, index) => (
                                  <li key={index} className="flex gap-2 text-[13.5px] text-card-foreground dark:text-muted-foreground/70">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {deepWatchpoints.length > 0 && (
                            <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                              <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">后续观察点</div>
                              <ul className="mt-3 space-y-2">
                                {deepWatchpoints.map((item, index) => (
                                  <li key={index} className="flex gap-2 text-[13.5px] text-card-foreground dark:text-muted-foreground/70">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {timelineItems.length > 0 ? (
                        <div className="rounded-xl border border-border dark:border-slate-800 p-4 bg-card/70 dark:bg-slate-900/70">
                          <div className="text-[13px] font-bold text-card-foreground dark:text-slate-200">事件时间线</div>
                          <div className="mt-3 space-y-3">
                            {timelineItems.map((item, index) => (
                              <div key={`${item.time}-${index}`} className="flex gap-3">
                                <div className="flex flex-col items-center pt-1">
                                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                  {index < timelineItems.length - 1 && <span className="mt-1 h-full w-px bg-border dark:bg-slate-700" />}
                                </div>
                                <div className="pb-3">
                                  <div className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">{item.time}</div>
                                  <div className="mt-1 text-[13.5px] text-card-foreground dark:text-slate-200 leading-6">{item.event}</div>
                                  {item.source ? <div className="mt-1 text-[12px] text-muted-foreground dark:text-muted-foreground/70">来源：{item.source}</div> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {!deepOverview && deepBackground.length === 0 && stakeholders.length === 0 && deepImplications.length === 0 && deepRisks.length === 0 && deepWatchpoints.length === 0 && timelineItems.length === 0 && (
                        <div className="text-[13px] text-muted-foreground/70">暂无深度分析数据，点击右上角“更新解读”生成。</div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {subTab === "annotation" && (
                <section className="bg-card dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800">
                    <div className="text-[14.5px] font-bold text-card-foreground dark:text-slate-200">📝 AI 批注（伴读）</div>
                    <div className="mt-1 text-[12px] text-muted-foreground dark:text-muted-foreground/70">
                      在正文中选中文本 → 点击浮动菜单的“闪光”按钮，即可在这里得到解释与延展。
                    </div>
                  </div>
                  <div className="p-4 text-[13.5px] text-muted-foreground dark:text-muted-foreground/70 leading-relaxed">
                    你也可以直接在下方输入框继续追问，例如：这段话的前提假设是什么？作者可能遗漏了什么？
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Chat history */}
        {messages.length > 0 && (
          <div className="pt-2 flex items-center gap-2 text-[12px] font-bold text-muted-foreground/70 uppercase tracking-widest px-1">
            <MessageSquare className="h-3 w-3" />
            AI 追问
          </div>
        )}

        <div className="space-y-4 pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-2 max-w-[90%]",
                msg.role === "user" ? "ml-auto items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-[14.5px] leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-blue-600/90 text-white backdrop-blur-sm rounded-tr-none shadow-sm"
                    : "bg-card dark:bg-slate-900 border border-border dark:border-slate-700 text-popover-foreground dark:text-muted-foreground/50 rounded-tl-none shadow-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Footer input */}
      <div className="p-4 bg-card dark:bg-slate-900 border-t border-border dark:border-slate-800">
        <div className="relative group">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChat()}
            placeholder={contentType === "article" ? "对解读有疑问？继续追问 AI..." : "向 AI 追问更多细节..."}
            className="pr-12 h-11 rounded-xl bg-muted dark:bg-slate-800 border-border dark:border-slate-700 focus:bg-card dark:focus:bg-slate-900 focus:border-blue-300 dark:focus:border-blue-500 transition-all text-[14.5px] dark:text-slate-200 dark:placeholder-slate-500"
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "absolute right-1.5 top-1.5 h-8 w-8 rounded-lg transition-all",
              input.trim() ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30" : "text-muted-foreground/50 dark:text-card-foreground"
            )}
            onClick={() => handleChat()}
            disabled={!input.trim() || chatLoading}
          >
            {chatLoading ? (
              <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
