"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Graph } from "@antv/g6";
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
  return s;
}

export function KnowledgeGraphView({ userId }: KnowledgeGraphViewProps) {
  const supabase = createClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });

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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; type: EntityType }>>([]);

  const expandedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setGraphData({ nodes: [], links: [] });
  }, [userId]);

  // Search suggestions
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
    const nodes = graphData.nodes.filter((n) => activeTypes[n.type] !== false);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.links.filter((l) => nodeIds.has(safeId(l.source)) && nodeIds.has(safeId(l.target)));
    return { nodes, links };
  }, [graphData, activeTypes]);

  // Initialize G6 Graph
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 如果已有实例，先销毁（支持热重载和配置更新）
    if (graphRef.current) {
      graphRef.current.destroy();
      graphRef.current = null;
    }

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      data: { nodes: [], edges: [] },
      layout: {
        type: "d3-force",
        preventOverlap: true,
        nodeSize: 40, // 物理碰撞半径（设大一点，让节点散开）
        linkDistance: 250, // 增加连线长度
        nodeStrength: -5000, // 强斥力，防止缩成一团
        edgeStrength: 0.8,
        collide: {
          strength: 1,
        },
        alphaDecay: 0.03,
        animated: true,
      },
      behaviors: [
        "drag-canvas",
        "zoom-canvas",
        "drag-element",
        {
          type: "activate-relations",
          trigger: "pointerenter",
          activeState: "active",
          inactiveState: "inactive",
          resetSelected: true,
        },
        {
          type: "click-select",
          multiple: false,
          trigger: "click",
        }
      ],
      node: {
        style: {
          // 调小视觉半径：12 ~ 28px 之间
          size: (d) => Math.max(12, ((d.data as any).val || 5) * 0.8 + 4),
          fill: "#ffffff",
          stroke: (d) => (d.data as any).color,
          lineWidth: 2,
          labelText: (d) => (d.data as any).name,
          labelPlacement: "bottom",
          labelBackground: true,
          labelBackgroundFill: "#ffffff",
          labelBackgroundStroke: "#e2e8f0",
          labelBackgroundLineWidth: 1,
          labelBackgroundRadius: 4,
          labelFill: "#1e293b",
          labelFontSize: 10,
          labelFontWeight: 600,
          cursor: "pointer",
        },
        state: {
          active: {
            lineWidth: 3,
            strokeOpacity: 1,
            shadowColor: (d) => (d.data as any).color,
            shadowBlur: 12,
          },
          inactive: {
            opacity: 0.1,
            labelOpacity: 0,
          },
          selected: {
            lineWidth: 3,
            stroke: "#3b82f6",
            shadowColor: "#3b82f6",
            shadowBlur: 16,
          }
        },
      },
      edge: {
        style: {
          stroke: "#94a3b8",
          lineWidth: 1,
          opacity: 0.5,
          endArrow: true,
          labelText: (d) => (d.data as any).label,
          labelBackground: true,
          labelBackgroundFill: "#ffffff",
          labelBackgroundStroke: "#e2e8f0",
          labelBackgroundRadius: 2,
          labelFontSize: 9,
          labelFill: "#64748b",
        },
        state: {
          active: {
            stroke: "#3b82f6",
            lineWidth: 2,
            opacity: 1,
          },
          inactive: {
            opacity: 0.05,
            labelOpacity: 0,
          }
        }
      },
    });

    graph.render();
    graphRef.current = graph;

    // Event listeners
    graph.on("node:click", (e) => {
      const id = e.target.id;
      const nodeData = graphData.nodes.find(n => n.id === id);
      if (nodeData) {
        handleNodeClick(nodeData);
      }
    });

    graph.on("edge:click", (e) => {
      const id = e.target.id;
      const edgeData = graphData.links.find(l => l.id === id);
      if (edgeData) {
        handleLinkClick(edgeData);
      }
    });

    graph.on("canvas:click", () => {
      setSelectedNodeId(null);
      setSelectedLink(null);
    });

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGraph.nodes.length > 0]); // Re-run when data availability changes

  // Update Data
  useEffect(() => {
    if (!graphRef.current) return;

    const data = {
      nodes: filteredGraph.nodes.map((n) => ({
        id: n.id,
        data: { 
          ...n,
          color: n.color || TYPE_COLORS[n.type] || TYPE_COLORS.DEFAULT,
        },
      })),
      edges: filteredGraph.links.map((l) => ({
        id: l.id,
        source: typeof l.source === 'object' ? (l.source as any).id : l.source,
        target: typeof l.target === 'object' ? (l.target as any).id : l.target,
        data: { ...l },
      })),
    };

    graphRef.current.setData(data);
    graphRef.current.render();
  }, [filteredGraph]);

  // Data Loading Logic (Same as before, adapted for G6 state)
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
        for (const n of graphData.nodes) nodesById.set(n.id, n);
        for (const l of graphData.links) linksById.set(l.id, l);
      }

      const seed = fullNodesById.get(seedId);
      if (!seed) {
        setGraphData({ nodes: [], links: [] });
        setSelectedNodeId(null);
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

      const newNodes = Array.from(nodesById.values());
      const newLinks = Array.from(linksById.values());
      
      setGraphData({ nodes: newNodes, links: newLinks });
      setSelectedNodeId(seedNode.id);
      setSelectedLink(null);
      
      // Zoom to new data
      setTimeout(() => {
        graphRef.current?.fitView();
      }, 100);

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
      const { data: seed, error: seedErr } = await supabase
        .from("knowledge_entities")
        .select("id, name, type, metadata")
        .eq("id", seedId)
        .single();
      if (seedErr) throw seedErr;

      const nodesById = new Map<string, GraphNode>();
      const linksById = new Map<string, GraphLink>();

      if (append) {
        for (const n of graphData.nodes) nodesById.set(n.id, n);
        for (const l of graphData.links) linksById.set(l.id, l);
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

      const newNodes = Array.from(nodesById.values());
      const newLinks = Array.from(linksById.values());

      setGraphData({ nodes: newNodes, links: newLinks });
      setSelectedNodeId(seedNode.id);
      setSelectedLink(null);

      setTimeout(() => {
        graphRef.current?.fitView();
      }, 100);

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

  const handleNodeClick = (node: GraphNode) => {
    const now = Date.now();
    const prev = lastClickRef.current;
    const nodeId = node.id;

    // Double click to expand
    if (prev && prev.id === nodeId && now - prev.t < 320) {
      lastClickRef.current = null;
      if (!expandedRef.current.has(nodeId)) {
        expandedRef.current.add(nodeId);
        loadNeighborhood(nodeId, { depth: 1, append: true });
      }
      return;
    }

    lastClickRef.current = { id: nodeId, t: now };
    setSelectedNodeId(nodeId);
    setSelectedLink(null);
    
    // Zoom focus
    graphRef.current?.focusElement(nodeId, true);
  };

  const handleLinkClick = (link: GraphLink) => {
    setSelectedLink(link);
    const sid = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tid = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const anchor = graphData.nodes.find((n) => n.id === sid) || graphData.nodes.find((n) => n.id === tid);
    if (anchor) setSelectedNodeId(anchor.id);
  };

  const handleZoomIn = () => graphRef.current?.zoom(1.2);
  const handleZoomOut = () => graphRef.current?.zoom(0.8);
  const handleReset = () => {
    graphRef.current?.fitView();
    setSelectedLink(null);
  };

  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#F8FAFC]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at:1px_1px,rgba(148,163,184,0.15)_1px,transparent_0)] bg-[size:24px_24px]" />

      {/* Left Sidebar: Types */}
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

      {/* Top Search */}
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

        {/* Top Right Controls */}
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
                setGraphData({ nodes: [], links: [] });
                setSelectedNodeId(null);
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

      {/* Main Canvas */}
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
                  if (graphRef.current) graphRef.current.fitView();
                }}
              >
                我知道了
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">演示数据仅用于界面展示，不会写入你的数据库。</p>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full min-h-[600px]" />
        )}
      </div>

      <EntityProfilePanel
        userId={userId}
        entityId={selectedNodeId}
        selectedLink={selectedLink || undefined}
        demo={demoMode ? demoBundle.profile : null}
        demoMode={demoMode}
        onClose={() => {
          setSelectedLink(null);
          setSelectedNodeId(null);
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