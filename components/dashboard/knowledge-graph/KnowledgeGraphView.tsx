"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  User,
  Building2,
  MapPin,
  Calendar,
  Cpu,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { EntityProfilePanel } from "./EntityProfilePanel";
import { buildMockKnowledgeGraph } from "./mock-data";
import type { EntityType, GraphData, GraphLink, GraphNode } from "./types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  ),
});


interface KnowledgeGraphViewProps {
  userId: string;
}

const TYPE_COLORS: Record<EntityType, string> = {
  PERSON: "#3b82f6",
  ORG: "#f97316",
  GPE: "#22c55e",
  EVENT: "#eab308",
  TECH: "#a855f7",
  WORK_OF_ART: "#ec4899",
  DEFAULT: "#94a3b8",
};

function typeLabel(type: EntityType) {
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
      return "其他";
  }
}

function typeIcon(type: EntityType) {
  switch (type) {
    case "PERSON":
      return User;
    case "ORG":
      return Building2;
    case "GPE":
      return MapPin;
    case "EVENT":
      return Calendar;
    case "TECH":
      return Cpu;
    default:
      return Type;
  }
}

function safeId(v: any): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.id;
}

function predicateLabel(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "关联";
  // 如果已经包含中文，就原样返回
  if (/[\u4e00-\u9fa5]/.test(s)) return s;

  const lower = s.toLowerCase();
  const map: Record<string, string> = {
    founded: "创立",
    "co-founded": "共同创立",
    ceo: "担任 CEO",
    "led by": "由…领导",
    employed: "雇佣",
    "employed by": "就职于",
    fired: "解雇",
    "invested in": "投资",
    invested: "投资",
    acquired: "收购",
    "acquired by": "被收购",
    located: "位于",
    "located in": "位于",
    sued: "起诉",
    criticized: "批评",
    partnered: "合作",
    "partnered with": "合作",
    announced: "宣布",
    met: "会面",
    "met with": "会面",
    owned: "拥有",
    owner: "拥有者",
  };

  if (map[lower]) return map[lower];
  // 尽量避免纯英文直接上屏
  if (/^[\x00-\x7F]+$/.test(s)) return "关联";
  return s;
}

export function KnowledgeGraphView({ userId }: KnowledgeGraphViewProps) {
  const supabase = createClient();
  const fgRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });

  const demoBundle = useMemo(() => buildMockKnowledgeGraph(), []);
  const [demoMode, setDemoMode] = useState(false);

  const [activeTypes, setActiveTypes] = useState<Record<EntityType, boolean>>({
    PERSON: true,
    ORG: true,
    GPE: true,
    EVENT: true,
    TECH: true,
    WORK_OF_ART: true,
    DEFAULT: true,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);

  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverLinkId, setHoverLinkId] = useState<string | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; type: EntityType }>>([]);

  const expandedRef = useRef<Set<string>>(new Set());
  const lastClickRef = useRef<{ id: string; t: number } | null>(null);

  useEffect(() => {
    // 首次进入默认不拉全量，避免“毛线团”
    setGraph({ nodes: [], links: [] });
  }, [userId]);

  // 搜索联想
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        if (demoMode) {
          const list = Object.values(demoBundle.profile.entityById)
            .filter((x) => x.name.includes(q) || (x.aliases || []).some((a) => a.includes(q)))
            .slice(0, 8);
          setSearchResults(list.map((x) => ({ id: x.id, name: x.name, type: x.type })));
          setSearchOpen(true);
          return;
        }

        const { data, error } = await supabase
          .from("knowledge_entities")
          .select("id, name, type")
          .eq("user_id", userId)
          .ilike("name", `%${q}%`)
          .order("updated_at", { ascending: false })
          .limit(8);
        if (error) throw error;
        setSearchResults(
          (data || []).map((x: any) => ({
            id: x.id,
            name: x.name,
            type: (x.type || "DEFAULT") as EntityType,
          }))
        );
        setSearchOpen(true);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
        setSearchOpen(false);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => clearTimeout(handle);
  }, [demoBundle, demoMode, searchQuery, supabase, userId]);

  const filteredGraph = useMemo(() => {
    const nodes = graph.nodes.filter((n) => activeTypes[n.type] !== false);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => nodeIds.has(safeId(l.source)) && nodeIds.has(safeId(l.target)));
    return { nodes, links };
  }, [graph, activeTypes]);

  const pulseTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    if (filteredGraph.nodes.length === 0) return;

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 48) return; // ~20fps，足够做轻微脉冲
      last = t;
      pulseTimeRef.current = Date.now();
      fgRef.current?.refresh?.();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [filteredGraph.nodes.length]);

  const loadDemoNeighborhood = async (seedId: string, opts?: { depth?: 1 | 2; append?: boolean }) => {
    const depth = opts?.depth ?? 1;
    const append = opts?.append ?? false;

    setLoading(true);
    try {
      const full = demoBundle.fullGraph;
      const fullNodesById = new Map<string, GraphNode>(full.nodes.map((x) => [x.id, x]));

      const nodesById = new Map<string, GraphNode>();
      const linksById = new Map<string, GraphLink>();

      if (append) {
        for (const n of graph.nodes) nodesById.set(n.id, n);
        for (const l of graph.links) linksById.set(l.id, l);
      }

      const seed = fullNodesById.get(seedId);
      if (!seed) {
        setGraph({ nodes: [], links: [] });
        setSelectedNode(null);
        setSelectedLink(null);
        return;
      }

      const seedNode: GraphNode = { ...seed, val: Math.max(seed.val || 12, 24) };
      nodesById.set(seedNode.id, seedNode);

      let frontier = [seedNode.id];
      const visited = new Set<string>([seedNode.id]);

      for (let d = 0; d < depth; d++) {
        if (frontier.length === 0) break;
        const nextFrontier = new Set<string>();

        for (const rel of full.links) {
          const s = rel.source as string;
          const t = rel.target as string;
          if (!frontier.includes(s) && !frontier.includes(t)) continue;

          linksById.set(rel.id, rel);

          const sn = fullNodesById.get(s);
          const tn = fullNodesById.get(t);
          if (sn && !nodesById.has(sn.id)) nodesById.set(sn.id, sn);
          if (tn && !nodesById.has(tn.id)) nodesById.set(tn.id, tn);

          if (frontier.includes(s) && !visited.has(t)) nextFrontier.add(t);
          if (frontier.includes(t) && !visited.has(s)) nextFrontier.add(s);
        }

        frontier = Array.from(nextFrontier);
        frontier.forEach((x) => visited.add(x));
      }

      setGraph({
        nodes: Array.from(nodesById.values()),
        links: Array.from(linksById.values()),
      });
      setSelectedNode(seedNode);
      setSelectedLink(null);

      setTimeout(() => {
        fgRef.current?.zoomToFit?.(500, 60);
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const loadNeighborhood = async (seedId: string, opts?: { depth?: 1 | 2; append?: boolean }) => {
    if (demoMode) {
      await loadDemoNeighborhood(seedId, opts);
      return;
    }

    const depth = opts?.depth ?? 1;
    const append = opts?.append ?? false;

    setLoading(true);
    try {
      // 先拿 seed 实体
      const { data: seed, error: seedErr } = await supabase
        .from("knowledge_entities")
        .select("id, name, type, metadata")
        .eq("id", seedId)
        .single();
      if (seedErr) throw seedErr;

      const nodesById = new Map<string, GraphNode>();
      const linksById = new Map<string, GraphLink>();

      if (append) {
        for (const n of graph.nodes) nodesById.set(n.id, n);
        for (const l of graph.links) linksById.set(l.id, l);
      }

      const seedNode: GraphNode = {
        id: seed.id,
        name: seed.name,
        type: (seed.type || "DEFAULT") as EntityType,
        val: 18 + (seed.metadata?.importance || 0),
        color: TYPE_COLORS[(seed.type || "DEFAULT") as EntityType] || TYPE_COLORS.DEFAULT,
      };
      nodesById.set(seedNode.id, seedNode);

      let frontier = [seedNode.id];
      const visited = new Set<string>([seedNode.id]);

      for (let d = 0; d < depth; d++) {
        if (frontier.length === 0) break;

        const inList = frontier.join(",");
        const { data: rels, error: relErr } = await supabase
          .from("knowledge_relationships")
          .select(
            `id, relation, evidence_snippet, source_note_id, source_entity_id, target_entity_id,
             source:source_entity_id (id, name, type, metadata),
             target:target_entity_id (id, name, type, metadata)`
          )
          .eq("user_id", userId)
          .or(`source_entity_id.in.(${inList}),target_entity_id.in.(${inList})`)
          .limit(120);

        if (relErr) throw relErr;

        const nextFrontierSet = new Set<string>();

        for (const rel of rels || []) {
          const s = Array.isArray((rel as any).source) ? (rel as any).source[0] : (rel as any).source;
          const t = Array.isArray((rel as any).target) ? (rel as any).target[0] : (rel as any).target;
          if (!s || !t) continue;

          const sType = ((s.type || "DEFAULT") as EntityType);
          const tType = ((t.type || "DEFAULT") as EntityType);

          if (!nodesById.has(s.id)) {
            nodesById.set(s.id, {
              id: s.id,
              name: s.name,
              type: sType,
              val: 12 + (s.metadata?.importance || 0),
              color: TYPE_COLORS[sType] || TYPE_COLORS.DEFAULT,
            });
          }
          if (!nodesById.has(t.id)) {
            nodesById.set(t.id, {
              id: t.id,
              name: t.name,
              type: tType,
              val: 12 + (t.metadata?.importance || 0),
              color: TYPE_COLORS[tType] || TYPE_COLORS.DEFAULT,
            });
          }

          linksById.set(rel.id, {
            id: rel.id,
            source: rel.source_entity_id,
            target: rel.target_entity_id,
            rawRelation: rel.relation,
            label: predicateLabel(rel.relation),
            evidenceSnippet: rel.evidence_snippet,
            sourceNoteId: rel.source_note_id,
          });

          const sid = rel.source_entity_id;
          const tid = rel.target_entity_id;
          if (frontier.includes(sid) && !visited.has(tid)) nextFrontierSet.add(tid);
          if (frontier.includes(tid) && !visited.has(sid)) nextFrontierSet.add(sid);
        }

        frontier = Array.from(nextFrontierSet);
        frontier.forEach((x) => visited.add(x));
      }

      setGraph({
        nodes: Array.from(nodesById.values()),
        links: Array.from(linksById.values()),
      });

      setSelectedNode(seedNode);
      setSelectedLink(null);

      // 视图聚焦
      setTimeout(() => {
        if (!fgRef.current) return;
        fgRef.current.zoomToFit(500, 60);
      }, 80);
    } catch (e) {
      console.error("Failed to load neighborhood", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickEntity = async (id: string) => {
    setSearchOpen(false);
    await loadNeighborhood(id, { depth: 1, append: false });
  };

  const toggleType = (t: EntityType) => {
    setActiveTypes((prev) => ({ ...prev, [t]: !prev[t] }));
  };

  const handleNodeClick = (node: any) => {
    const now = Date.now();
    const prev = lastClickRef.current;
    const nodeId = node?.id as string;

    // 双击展开
    if (prev && prev.id === nodeId && now - prev.t < 320) {
      lastClickRef.current = null;
      if (!expandedRef.current.has(nodeId)) {
        expandedRef.current.add(nodeId);
        loadNeighborhood(nodeId, { depth: 1, append: true });
      }
      return;
    }

    lastClickRef.current = { id: nodeId, t: now };

    setSelectedNode(node);
    setSelectedLink(null);

    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 350);
      fgRef.current.zoom(2.1, 350);
    }
  };

  const handleLinkClick = (link: any) => {
    setSelectedLink(link as GraphLink);
    const sid = safeId(link.source);
    const tid = safeId(link.target);

    // 默认把面板锚到 source 节点（便于看“某实体的关系证据”）
    const anchor = graph.nodes.find((n) => n.id === sid) || graph.nodes.find((n) => n.id === tid) || null;
    if (anchor) setSelectedNode(anchor);
  };

  const computeHighlight = (node: any) => {
    if (!node) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const nid = node.id as string;
    const hn = new Set<string>([nid]);
    const hl = new Set<string>();

    for (const l of filteredGraph.links) {
      const s = safeId(l.source);
      const t = safeId(l.target);
      if (s === nid || t === nid) {
        hl.add(l.id);
        hn.add(s);
        hn.add(t);
      }
    }

    setHighlightNodes(hn);
    setHighlightLinks(hl);
  };

  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.15, 250);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() * 0.85, 250);
  const handleReset = () => {
    fgRef.current?.zoomToFit(450, 60);
    setSelectedLink(null);
  };

  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#F8FAFC]">
      {/* 画布背景：点阵网格 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at:1px_1px,rgba(148,163,184,0.15)_1px,transparent_0)] bg-[size:24px_24px]" />

      {/* 左侧：实体类型筛选 */}
      <div className="absolute top-6 left-6 z-20 w-[220px] rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200/70">
          <div className="text-[11px] font-black text-slate-500 tracking-wider">实体类型</div>
        </div>
        <div className="p-3 space-y-1">
          {([
            "PERSON",
            "ORG",
            "GPE",
            "EVENT",
            "TECH",
            "WORK_OF_ART",
          ] as EntityType[]).map((t) => {
            const Icon = typeIcon(t);
            const on = activeTypes[t] !== false;
            return (
              <button
                key={t}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors",
                  on ? "bg-slate-50 hover:bg-slate-100" : "bg-transparent hover:bg-slate-50"
                )}
                onClick={() => toggleType(t)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
                    <span className="text-sm font-bold text-slate-700">{typeLabel(t)}</span>
                  </div>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 rounded-full border transition-all relative",
                    on ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                      on ? "left-4" : "left-0.5 bg-slate-200"
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 顶部：搜索 */}
      <div className="absolute top-6 left-[260px] right-6 z-20 flex items-start justify-between gap-4">
        <div className="relative w-[520px]">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-sm px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (searchResults[0]) handlePickEntity(searchResults[0].id);
                }
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="搜索实体（人物 / 组织 / 地点）"
              className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 h-10 text-sm"
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (searchResults[0]) handlePickEntity(searchResults[0].id);
              }}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute mt-2 w-full rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handlePickEntity(r.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[r.type] || TYPE_COLORS.DEFAULT }}
                    />
                    <span className="text-sm font-bold text-slate-800 truncate">{r.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{typeLabel(r.type)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右上：缩放控制 */}
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-sm p-2">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600">
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              if (demoMode) {
                setDemoMode(false);
                expandedRef.current = new Set();
                setGraph({ nodes: [], links: [] });
                setSelectedNode(null);
                setSelectedLink(null);
                setSearchQuery("");
                setSearchOpen(false);
              } else {
                setDemoMode(true);
                expandedRef.current = new Set([demoBundle.seedEntityId]);
                loadDemoNeighborhood(demoBundle.seedEntityId, { depth: 1, append: false });
              }
            }}
            className="h-10 px-3 rounded-xl hover:bg-slate-100 text-slate-700 font-black"
          >
            {demoMode ? "退出演示" : "演示数据"}
          </Button>

          <div className="w-px h-6 bg-slate-200" />
          <Button variant="ghost" size="icon" onClick={handleReset} className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 画布 */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/90 border border-slate-200 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-bold text-slate-600">正在加载关系网络...</span>
            </div>
          </div>
        ) : null}

        {filteredGraph.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <Search className="h-7 w-7 text-slate-300" />
            </div>
            <h3 className="mt-6 text-xl font-black text-slate-900">从一个实体开始</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
              在上方输入人物、组织或地点名称，系统会按需加载 1 度关系；双击节点可继续展开下一层。
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Button
                className="h-11 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200"
                onClick={() => {
                  setDemoMode(true);
                  expandedRef.current = new Set([demoBundle.seedEntityId]);
                  loadDemoNeighborhood(demoBundle.seedEntityId, { depth: 1, append: false });
                }}
              >
                加载演示数据
              </Button>
              <Button
                variant="ghost"
                className="h-11 px-5 rounded-2xl border border-slate-200 bg-white/80 hover:bg-white text-slate-700 font-black"
                onClick={() => {
                  fgRef.current?.zoomToFit?.(450, 60);
                }}
              >
                我知道了
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">演示数据仅用于界面展示，不会写入你的数据库。</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredGraph}
            backgroundColor="rgba(0,0,0,0)"
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, Math.max(8, node.val / 2 + 6), 0, 2 * Math.PI, false);
              ctx.fill();
            }}
            nodeRelSize={6}
            nodeVal={(n) => (n as GraphNode).val}
            linkDirectionalArrowLength={4.2}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.18}
            linkLabel={(l) => (l as GraphLink).label}
            linkColor={(l) => {
              const id = (l as any).id as string;
              if (hoverLinkId && hoverLinkId === id) return "rgba(37,99,235,0.95)";
              if (highlightLinks.size > 0) {
                return highlightLinks.has(id) ? "rgba(37,99,235,0.85)" : "rgba(148,163,184,0.12)";
              }
              return "rgba(148,163,184,0.42)";
            }}
            linkWidth={(l) => {
              const id = (l as any).id as string;
              if (hoverLinkId && hoverLinkId === id) return 2.6;
              if (highlightLinks.size > 0) return highlightLinks.has(id) ? 2.2 : 0.8;
              return 1.4;
            }}
            linkDirectionalParticles={(l) => {
              const id = (l as any).id as string;
              if (hoverLinkId && hoverLinkId === id) return 10;
              if (selectedLink?.id && selectedLink.id === id) return 12;
              if (highlightLinks.size > 0) return highlightLinks.has(id) ? 8 : 1;
              return demoMode ? 4 : 1;
            }}
            linkDirectionalParticleWidth={(l) => {
              const id = (l as any).id as string;
              if (hoverLinkId && hoverLinkId === id) return 2.2;
              if (selectedLink?.id && selectedLink.id === id) return 2.4;
              return 1.4;
            }}
            linkDirectionalParticleSpeed={(l) => {
              const id = (l as any).id as string;
              if (highlightLinks.size > 0 && highlightLinks.has(id)) return 0.014;
              return demoMode ? 0.012 : 0.01;
            }}
            linkDirectionalParticleColor={(l) => {
              const id = (l as any).id as string;
              if (hoverLinkId && hoverLinkId === id) return "rgba(37,99,235,0.75)";
              if (selectedLink?.id && selectedLink.id === id) return "rgba(37,99,235,0.70)";
              return "rgba(37,99,235,0.55)";
            }}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(link: any, ctx: any, globalScale: number) => {
              const id = (link as any).id as string;
              const isHigh =
                (hoverLinkId && hoverLinkId === id) ||
                (selectedLink?.id && selectedLink.id === id) ||
                (highlightLinks.size > 0 && highlightLinks.has(id));

              // 在足够大的缩放比例下，或者处于高亮状态时显示标签
              const shouldShowLabel = isHigh || globalScale > 1.8;
              if (!shouldShowLabel) return;

              const s = link.source;
              const t = link.target;
              const sx = typeof s === "object" ? s.x : undefined;
              const sy = typeof s === "object" ? s.y : undefined;
              const tx = typeof t === "object" ? t.x : undefined;
              const ty = typeof t === "object" ? t.y : undefined;
              if (sx == null || sy == null || tx == null || ty == null) return;

              const label = (link.label || "关联") as string;
              const fontSize = 11 / globalScale;
              if (fontSize < 2.5) return;

              ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
              const textWidth = ctx.measureText(label).width;
              const padX = 8 / globalScale;
              const padY = 5 / globalScale;
              const w = textWidth + padX * 2;
              const h = fontSize + padY * 2;
              const mx = (sx + tx) / 2;
              const my = (sy + ty) / 2;

              const x = mx - w / 2;
              const y = my - h / 2;
              const radius = 8 / globalScale;

              ctx.shadowColor = "rgba(0,0,0,0.05)";
              ctx.shadowBlur = 4 / globalScale;
              ctx.fillStyle = isHigh ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)";
              ctx.strokeStyle = isHigh ? "rgba(37,99,235,0.45)" : "rgba(226,232,240,0.8)";
              ctx.lineWidth = 1 / globalScale;

              ctx.beginPath();
              ctx.moveTo(x + radius, y);
              ctx.arcTo(x + w, y, x + w, y + h, radius);
              ctx.arcTo(x + w, y + h, x, y + h, radius);
              ctx.arcTo(x, y + h, x, y, radius);
              ctx.arcTo(x, y, x + w, y, radius);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // 重置阴影避免影响文字
              ctx.shadowBlur = 0;

              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = isHigh ? "rgba(37,99,235,1)" : "rgba(100,116,139,0.9)";
              ctx.fillText(label, mx, my);
            }}
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            onNodeHover={(node: any) => {
              setHoverNodeId(node ? (node.id as string) : null);
              computeHighlight(node);
            }}
            onLinkHover={(link: any) => {
              setHoverLinkId(link ? (link.id as string) : null);
            }}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const n = node as GraphNode;
              const isSelected = selectedNode?.id === n.id;
              const isHovered = hoverNodeId === n.id;
              const isDim = highlightNodes.size > 0 && !highlightNodes.has(n.id);

              const r = Math.max(10, (n.val || 12) / 2 + 6);

              // 外圈
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
              ctx.fillStyle = isDim ? "rgba(226,232,240,0.55)" : "rgba(255,255,255,0.96)";
              ctx.fill();
              ctx.lineWidth = (isSelected ? 2.6 : 1.6) / globalScale;
              ctx.strokeStyle = isDim ? "rgba(203,213,225,0.6)" : (n.color || TYPE_COLORS.DEFAULT);
              ctx.stroke();

              // 内点
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, 3.2 / globalScale, 0, 2 * Math.PI);
              ctx.fillStyle = isDim ? "rgba(148,163,184,0.6)" : (n.color || TYPE_COLORS.DEFAULT);
              ctx.fill();

              // 选中光晕（带轻微脉冲）
              if (isSelected || isHovered) {
                const t = pulseTimeRef.current;
                const pulse = (Math.sin(t / 220) + 1) / 2; // 0~1
                const extra = ((isSelected ? 10 : 7) * (0.35 + 0.65 * pulse)) / globalScale;

                ctx.beginPath();
                ctx.arc(n.x!, n.y!, r + 6 / globalScale + extra, 0, 2 * Math.PI);
                ctx.strokeStyle = isSelected ? "rgba(37,99,235,0.32)" : "rgba(37,99,235,0.18)";
                ctx.lineWidth = (6 + 2 * pulse) / globalScale;
                ctx.stroke();
              }

              // 标签（缩放过小时隐藏）
              const showLabel = globalScale < 2.6 || isSelected || isHovered;
              if (!showLabel) return;

              const label = n.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
              const textWidth = ctx.measureText(label).width;
              const padX = 10 / globalScale;
              const padY = 6 / globalScale;
              const w = textWidth + padX * 2;
              const h = fontSize + padY * 2;
              const x = n.x! - w / 2;
              const y = n.y! + r + 10 / globalScale;

              // pill
              ctx.fillStyle = isDim ? "rgba(248,250,252,0.75)" : "rgba(255,255,255,0.95)";
              ctx.strokeStyle = "rgba(226,232,240,0.9)";
              ctx.lineWidth = 1 / globalScale;

              const radius = 10 / globalScale;
              ctx.beginPath();
              ctx.moveTo(x + radius, y);
              ctx.arcTo(x + w, y, x + w, y + h, radius);
              ctx.arcTo(x + w, y + h, x, y + h, radius);
              ctx.arcTo(x, y + h, x, y, radius);
              ctx.arcTo(x, y, x + w, y, radius);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = isDim ? "rgba(100,116,139,0.6)" : "rgba(15,23,42,0.85)";
              ctx.fillText(label, n.x!, y + h / 2);
            }}
          />
        )}
      </div>

      {/* 右侧实体档案 */}
      <EntityProfilePanel
        userId={userId}
        entityId={selectedNode?.id || null}
        selectedLink={selectedLink}
        demo={demoMode ? demoBundle.profile : null}
        demoMode={demoMode}
        onClose={() => {
          setSelectedLink(null);
          setSelectedNode(null);
        }}
        onSelectEntity={(id) => {
          setSearchQuery("");
          setSearchOpen(false);
          loadNeighborhood(id, { depth: 1, append: false });
        }}
      />
    </div>
  );
}
