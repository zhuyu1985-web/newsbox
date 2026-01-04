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

type AISubTab = "overview" | "qa" | "deep" | "annotation";

function safeArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
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

  const fastRead = analysis?.journalist_view?.fast_read || null;
  const takeaways = safeArray(fastRead?.takeaways);

  const keyQuestions = useMemo(() => {
    const raw = analysis?.key_questions;
    return safeArray(raw);
  }, [analysis?.key_questions]);

  const keyQuestionsMissing = safeArray(analysis?.journalist_view?.key_questions_missing);

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

  const applyStreamEvent = (event: string, payload: any) => {
    if (event === "cached") {
      setAnalysis((prev) => ({
        summary: payload?.summary ?? prev?.summary ?? null,
        key_questions: payload?.key_questions ?? prev?.key_questions ?? [],
        journalist_view: payload?.journalist_view ?? prev?.journalist_view ?? null,
        timeline: prev?.timeline ?? null,
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

    if (event === "warn") {
      toast.message("AI 解读已生成（未能写入缓存）", { description: payload?.detail || payload?.message });
      return;
    }

    if (event === "error") {
      toast.error(payload?.message || "AI 解读生成失败");
      return;
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
            applyStreamEvent(parsed.event, payload);
          } catch {
            // ignore invalid chunks
          }
        }
      }

      toast.success("AI 解读生成完成");
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

      if (!response.ok) throw new Error("对话失败");

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
    return <div className="p-8 text-center text-sm text-slate-400">加载 AI 数据中...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/30 text-[15px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold text-slate-800">AI 智能解读</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-slate-600 hover:bg-slate-50 font-semibold px-3"
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
                  isActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-blue-500 hover:bg-white/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 bg-blue-500/10 border border-blue-500/10 rounded-xl"
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
          <div className="py-10 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-700 mb-2">把这篇文章变成你的外脑</h3>
            <p className="text-[13px] text-slate-400 mb-6 max-w-[260px] mx-auto leading-relaxed">
              先给你 30 秒快读 + 3 个关键问题，帮助你决定是否继续深读。
            </p>
            <Button
              onClick={() => handleGenerate()}
              disabled={generating}
              variant="glass"
              className="rounded-full shadow-md px-6 h-9 text-[13px] font-bold"
            >
              {generating ? "正在生成..." : "生成 AI 解读"}
            </Button>
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
                  <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50/80 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-[14px] font-bold text-slate-800">⚡ AI 快读</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-slate-400 font-bold">
                        <Clock className="h-3.5 w-3.5" />
                        {fastRead?.read_time_minutes ? `${fastRead.read_time_minutes} 分钟` : "-"}
                      </div>
                    </div>

                    <div className="px-4 py-4 space-y-3">
                      <div className="text-[14.5px] font-bold text-slate-800 leading-relaxed">
                        {fastRead?.hook || analysis.summary}
                      </div>

                      {takeaways.length > 0 && (
                        <ul className="space-y-1.5">
                          {takeaways.slice(0, 5).map((pt: any, i: number) => (
                            <li key={i} className="text-[14px] text-slate-600 flex gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                              {String(pt)}
                            </li>
                          ))}
                        </ul>
                      )}

                      {fastRead?.sentiment && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[12px] font-bold">
                            #{fastRead.sentiment}
                          </span>
                        </div>
                      )}

                      {(!fastRead?.hook || takeaways.length === 0) && (
                        <div className="text-[13px] text-slate-400">
                          当前仅有旧版解读数据，建议点击右上角“更新解读”生成新版快读。
                        </div>
                      )}
                    </div>
                  </section>

                  <button
                    type="button"
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] px-4 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => setSubTab("qa")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[14.5px] font-bold text-slate-800">❓ 进入关键问题</div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-1 text-[13px] text-slate-500">用 3 个问题带你把文章读“透”。</div>
                  </button>
                </div>
              )}

              {subTab === "qa" && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <div className="text-[14.5px] font-bold text-slate-800">❓ 关键问题</div>
                    <div className="mt-1 text-[13px] text-slate-500">每个问题都尽量用原文作答，并附带证据片段。</div>
                  </div>

                  <div className="p-4 space-y-4">
                    {keyQuestions.length === 0 ? (
                      <div className="text-[13px] text-slate-400">暂无关键问题数据，点击右上角“更新解读”生成。</div>
                    ) : (
                      keyQuestions.slice(0, 8).map((qa: any, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                          <div className="text-[13.5px] font-black text-slate-800">Q{i + 1}: {qa.q || qa.question}</div>
                          <div className="mt-2 text-[14px] text-slate-600 leading-relaxed">{qa.a || qa.answer}</div>
                          {(qa.evidence || qa.evidence_snippet) && (
                            <div className="mt-2 text-[12px] text-slate-400 border-l-2 border-slate-200 pl-2">
                              “{qa.evidence || qa.evidence_snippet}”
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {keyQuestionsMissing.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 text-[13.5px] font-bold text-slate-700 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          未解之谜 / 逻辑缺口
                        </div>
                        <ul className="space-y-1.5">
                          {keyQuestionsMissing.slice(0, 5).map((m: any, idx: number) => (
                            <li key={idx} className="text-[13.5px] text-slate-600 flex gap-2">
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
                  <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50">
                      <div className="text-[14.5px] font-bold text-slate-800">🧐 AI 精读（建设中）</div>
                      <div className="mt-1 text-[13px] text-slate-500">当前先复用旧版“深度透视/时间线”，后续会升级为结构大纲与利益相关方表格。</div>
                    </div>
                    <div className="p-4 space-y-4">
                      {analysis.journalist_view ? (
                        <pre className="text-[12px] text-slate-600 whitespace-pre-wrap break-words bg-slate-50 rounded-xl p-3 border border-slate-100">
                          {JSON.stringify(analysis.journalist_view, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-[13px] text-slate-400">暂无深度透视数据。</div>
                      )}

                      {analysis.timeline ? (
                        <pre className="text-[12px] text-slate-600 whitespace-pre-wrap break-words bg-slate-50 rounded-xl p-3 border border-slate-100">
                          {JSON.stringify(analysis.timeline, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}

              {subTab === "annotation" && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <div className="text-[14.5px] font-bold text-slate-800">📝 AI 批注（伴读）</div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      在正文中选中文本 → 点击浮动菜单的“闪光”按钮，即可在这里得到解释与延展。
                    </div>
                  </div>
                  <div className="p-4 text-[13.5px] text-slate-500 leading-relaxed">
                    你也可以直接在下方输入框继续追问，例如：这段话的前提假设是什么？作者可能遗漏了什么？
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Chat history */}
        {messages.length > 0 && (
          <div className="pt-2 flex items-center gap-2 text-[12px] font-bold text-slate-400 uppercase tracking-widest px-1">
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
                    : "bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm"
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
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative group">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChat()}
            placeholder={contentType === "article" ? "对解读有疑问？继续追问 AI..." : "向 AI 追问更多细节..."}
            className="pr-12 h-11 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:border-blue-300 transition-all text-[14.5px]"
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "absolute right-1.5 top-1.5 h-8 w-8 rounded-lg transition-all",
              input.trim() ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-slate-300"
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
