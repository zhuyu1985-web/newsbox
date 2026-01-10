"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  User,
  Building2,
  MapPin,
  Calendar,
  Cpu,
  Type,
  ExternalLink,
  Loader2,
  Link2,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { EntityType, SelectedLink } from "./types";
import type { DemoProfileData } from "./mock-data";

interface EntityProfilePanelProps {
  userId: string;
  entityId: string | null;
  selectedLink?: SelectedLink;
  demo?: DemoProfileData | null;
  demoMode?: boolean;
  onClose: () => void;
  onSelectEntity?: (id: string) => void;
}

function safeId(v: any): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.id;
}

function typeIcon(type: string) {
  switch (type) {
    case "PERSON":
      return <User className="h-4 w-4" />;
    case "ORG":
      return <Building2 className="h-4 w-4" />;
    case "GPE":
      return <MapPin className="h-4 w-4" />;
    case "EVENT":
      return <Calendar className="h-4 w-4" />;
    case "TECH":
      return <Cpu className="h-4 w-4" />;
    default:
      return <Type className="h-4 w-4" />;
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "PERSON":
      return "人物";
    case "ORG":
      return "组织";
    case "GPE":
      return "地点";
    case "EVENT":
      return "事件";
    case "TECH":
      return "技术";
    case "WORK_OF_ART":
      return "作品";
    default:
      return "实体";
  }
}

function predicateLabel(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "关联";
  if (/[\u4e00-\u9fa5]/.test(s)) return s;

  const lower = s.toLowerCase();
  const map: Record<string, string> = {
    founded: "创立",
    "co-founded": "共同创立",
    fired: "解雇",
    sued: "起诉",
    invested: "投资",
    "invested in": "投资",
    acquired: "收购",
    "acquired by": "被收购",
    "located in": "位于",
    "met with": "会面",
    partnered: "合作",
    "partnered with": "合作",
  };

  if (map[lower]) return map[lower];
  if (/^[\x00-\x7F]+$/.test(s)) return "关联";
  return s;
}

export function EntityProfilePanel({ userId, entityId, selectedLink, demo, demoMode, onClose, onSelectEntity }: EntityProfilePanelProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<any>(null);

  const [mentions, setMentions] = useState<any[]>([]);
  const [mentionCount, setMentionCount] = useState<number>(0);

  const [relationships, setRelationships] = useState<any[]>([]);
  const [relationshipCount, setRelationshipCount] = useState<number>(0);

  const [trendPct, setTrendPct] = useState<number | null>(null);

  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);

  const hasPanel = Boolean(entityId);

  useEffect(() => {
    if (!entityId) {
      setEntity(null);
      setMentions([]);
      setRelationships([]);
      setEvidenceList([]);
      setMentionCount(0);
      setRelationshipCount(0);
      setTrendPct(null);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        if (demo) {
          const ent = demo.entityById[entityId];
          setEntity(ent || null);

          const mentData = demo.mentionsByEntityId[entityId] || [];
          setMentions(mentData);
          const total = (mentData || []).reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);
          setMentionCount(total);

          // Trend: last 7 days vs previous 7 days
          const now = Date.now();
          const day = 24 * 60 * 60 * 1000;
          const t7 = now - 7 * day;
          const t14 = now - 14 * day;

          const last7 = (mentData || []).filter((m: any) => new Date(m.created_at).getTime() >= t7);
          const prev7 = (mentData || []).filter((m: any) => {
            const t = new Date(m.created_at).getTime();
            return t >= t14 && t < t7;
          });

          const last7Count = last7.reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);
          const prev7Count = prev7.reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);

          if (prev7Count === 0 && last7Count === 0) setTrendPct(0);
          else if (prev7Count === 0) setTrendPct(100);
          else setTrendPct(Math.round(((last7Count - prev7Count) / prev7Count) * 100));

          const allRels = demo.relationshipsByEntityId[entityId] || [];
          setRelationships(allRels.slice(0, 12));
          setRelationshipCount(allRels.length);
          return;
        }

        const { data: entData, error: entError } = await supabase
          .from("knowledge_entities")
          .select("*")
          .eq("id", entityId)
          .single();
        if (entError) throw entError;
        setEntity(entData);

        // Mentions (recent)
        const { data: mentData, error: mentError } = await supabase
          .from("knowledge_note_entities")
          .select(
            `mention_count, created_at,
             notes:note_id (id, title, excerpt, published_at, created_at)`
          )
          .eq("entity_id", entityId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!mentError) {
          setMentions(mentData || []);
          const total = (mentData || []).reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);
          setMentionCount(total);

          // Trend: last 7 days vs previous 7 days, by mention rows
          const now = Date.now();
          const day = 24 * 60 * 60 * 1000;
          const t7 = now - 7 * day;
          const t14 = now - 14 * day;

          const last7 = (mentData || []).filter((m: any) => new Date(m.created_at).getTime() >= t7);
          const prev7 = (mentData || []).filter((m: any) => {
            const t = new Date(m.created_at).getTime();
            return t >= t14 && t < t7;
          });

          const last7Count = last7.reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);
          const prev7Count = prev7.reduce((acc: number, m: any) => acc + (m.mention_count || 1), 0);

          if (prev7Count === 0 && last7Count === 0) setTrendPct(0);
          else if (prev7Count === 0) setTrendPct(100);
          else setTrendPct(Math.round(((last7Count - prev7Count) / prev7Count) * 100));
        }

        // Relationships (recent)
        const { data: relData, error: relError } = await supabase
          .from("knowledge_relationships")
          .select(
            `id, relation, source_entity_id, target_entity_id,
             source:source_entity_id (id, name, type),
             target:target_entity_id (id, name, type)`
          )
          .eq("user_id", userId)
          .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
          .order("created_at", { ascending: false })
          .limit(12);
        if (!relError) {
          setRelationships(relData || []);
          setRelationshipCount((relData || []).length);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [demo, entityId, supabase, userId]);

  // Evidence chain for selected link
  useEffect(() => {
    if (!selectedLink) {
      setEvidenceList([]);
      return;
    }

    const sourceId = safeId(selectedLink.source);
    const targetId = safeId(selectedLink.target);
    if (!sourceId || !targetId) {
      setEvidenceList([]);
      return;
    }

    const run = async () => {
      setEvidenceLoading(true);
      try {
        if (demo && selectedLink?.id) {
          const list = demo.evidenceByLinkId[selectedLink.id] || [];
          if (list.length > 0) setEvidenceList(list);
          else if (selectedLink.evidenceSnippet) {
            setEvidenceList([
              {
                id: `${selectedLink.id}_ev_demo`,
                relation: selectedLink.rawRelation || selectedLink.label,
                evidence_snippet: selectedLink.evidenceSnippet,
                confidence_score: 0.66,
                source_note_id: null,
                notes: { id: null, title: "演示材料：关系证据片段", excerpt: null, created_at: new Date().toISOString() },
                created_at: new Date().toISOString(),
              },
            ]);
          } else {
            setEvidenceList([]);
          }
          return;
        }

        const { data, error } = await supabase
          .from("knowledge_relationships")
          .select(
            `id, relation, evidence_snippet, confidence_score, source_note_id,
             notes:source_note_id (id, title, excerpt, published_at, created_at)`
          )
          .eq("user_id", userId)
          .or(
            `and(source_entity_id.eq.${sourceId},target_entity_id.eq.${targetId}),and(source_entity_id.eq.${targetId},target_entity_id.eq.${sourceId})`
          )
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        setEvidenceList(data || []);
      } catch (e) {
        console.error(e);
        setEvidenceList([]);
      } finally {
        setEvidenceLoading(false);
      }
    };

    run();
  }, [demo, selectedLink, supabase, userId]);

  if (!hasPanel) return null;

  const headerType = (entity?.type || "DEFAULT") as EntityType;

  return (
    <div
      className={cn(
        "absolute top-0 right-0 bottom-0 w-[320px] bg-white border-l border-slate-200 shadow-2xl z-30 transform transition-transform duration-300 ease-out flex flex-col",
        hasPanel ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold">
              {typeLabel(headerType)}
            </Badge>
            <span className="text-[11px] font-bold text-slate-400">实体档案</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900 truncate">{entity?.name || ""}</h2>
          {entity?.aliases?.length ? (
            <p className="mt-1 text-xs text-slate-500 line-clamp-1">别名：{entity.aliases.join("，")}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-500">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-bold text-slate-500">加载中...</p>
          </div>
        ) : entity ? (
          <div className="p-6 space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-black text-slate-400 tracking-wider">提及</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{mentionCount}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-black text-slate-400 tracking-wider">关系</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{relationshipCount}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-black text-slate-400 tracking-wider">趋势</div>
                <div className={cn("mt-1 text-2xl font-black", (trendPct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {trendPct === null ? "—" : `${trendPct >= 0 ? "+" : ""}${trendPct}%`}
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-black text-slate-500 tracking-wider">简介摘要</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {entity.description || "暂无简介。后续会基于你的收藏库自动生成更准确的实体摘要。"}
                </p>
              </div>
            </div>

            {/* Evidence chain (when edge selected) */}
            {selectedLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-black text-slate-500 tracking-wider">关系证据</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-[11px] font-bold text-slate-500 leading-relaxed">
                    <span className="font-black text-slate-700">{typeof (selectedLink as any)?.source === "object" ? (selectedLink as any).source.name : ""}</span>
                    <span className="mx-2 text-slate-300">—</span>
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-black text-[10px]">
                      {(selectedLink as any)?.label || "关联"}
                    </span>
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="font-black text-slate-700">{typeof (selectedLink as any)?.target === "object" ? (selectedLink as any).target.name : ""}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {demoMode ? "演示模式：证据用于展示，原文笔记不可打开。" : "点击右侧证据条目可跳转到原文笔记。"}
                  </p>
                </div>

                {evidenceLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">加载证据中...</span>
                  </div>
                ) : evidenceList.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    暂无可展示的证据片段。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evidenceList.map((ev: any) => (
                      <div key={ev.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Badge className="bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold">
                            {predicateLabel(ev.relation)}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400">
                            {ev.notes?.published_at
                              ? new Date(ev.notes.published_at).toLocaleDateString()
                              : ev.notes?.created_at
                                ? new Date(ev.notes.created_at).toLocaleDateString()
                                : ""}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                          {ev.evidence_snippet || "（缺少证据片段）"}
                        </p>
                        {ev.notes?.id ? (
                          <button
                            type="button"
                            className="mt-3 w-full flex items-center justify-between gap-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 text-left"
                            onClick={() => window.open(`/notes/${ev.notes.id}`, "_blank")}
                          >
                            <span className="text-xs font-bold text-slate-700 line-clamp-1">{ev.notes.title || "打开原文"}</span>
                            <ExternalLink className="h-4 w-4 text-slate-400" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Relationships */}
            {relationships.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-black text-slate-500 tracking-wider">关联关系</span>
                </div>
                <div className="space-y-2">
                  {relationships.map((rel: any) => {
                    const other = rel.source_entity_id === entity.id ? rel.target : rel.source;
                    return (
                      <button
                        key={rel.id}
                        type="button"
                        className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors p-4 text-left"
                        onClick={() => onSelectEntity?.(other.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600">
                              {typeIcon(other.type)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-900 truncate">{other.name}</div>
                              <div className="text-[11px] font-bold text-slate-400">{predicateLabel(rel.relation)}</div>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-slate-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Mentions */}
            {mentions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-black text-slate-500 tracking-wider">提及来源</span>
                </div>
                <div className="space-y-2">
                  {mentions.map((m: any, idx: number) => {
                    const note = m.notes;
                    if (!note) return null;
                    return (
                      <button
                        key={note.id || idx}
                        type="button"
                        disabled={Boolean(demoMode) || !note.id}
                        className={cn(
                          "w-full rounded-2xl border border-slate-200 bg-white transition-colors p-4 text-left",
                          Boolean(demoMode) || !note.id ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"
                        )}
                        onClick={() => {
                          if (demoMode || !note.id) return;
                          window.open(`/notes/${note.id}`, "_blank");
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black text-slate-400 tracking-wider">
                            {note.published_at
                              ? new Date(note.published_at).toLocaleDateString()
                              : note.created_at
                                ? new Date(note.created_at).toLocaleDateString()
                                : ""}
                          </span>
                          <ExternalLink className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="mt-2 text-sm font-black text-slate-900 line-clamp-2">{note.title}</div>
                        {note.excerpt ? (
                          <div className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{note.excerpt}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">无法加载该实体信息。</p>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-6 border-t border-slate-200 bg-white">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-black shadow-lg shadow-blue-200 transition-all active:scale-95">
          深度追溯此实体
        </Button>
      </div>
    </div>
  );
}
