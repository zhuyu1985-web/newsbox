import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildEmbeddingText,
  buildEventFingerprint,
  chooseHeuristicK,
  computeNoteContentHash,
  createEmbeddings,
  dbscanCosine,
  estimateDbscanEps,
  extractEventTimeIso,
  kmeansCosine,
  nameTopicAndReport,
  type EmbeddingProviderConfig,
  type TopicNamingConfig,
} from "@/lib/services/knowledge-topics";

type RebuildBody = {
  recentDays?: number;
  k?: number;
  algorithm?: "dbscan" | "kmeans";
  eps?: number;
  minSamples?: number;
};

type NoteRow = {
  id: string;
  title: string | null;
  excerpt: string | null;
  content_text: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type EmbeddingRow = {
  note_id: string;
  model: string;
  content_hash: string;
  embedding: unknown;
};

export type TopicRow = {
  id: string;
  title: string | null;
  keywords: string[] | null;
  summary_markdown: string | null;
  member_count: number | null;
  updated_at: string;
  created_at: string;
  pinned?: boolean | null;
  pinned_at?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
};

type TopicMemberRow = {
  topic_id: string;
  note_id: string;
  source?: string | null;
  manual_state?: string | null;
};

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((x): x is number => Number.isFinite(x));
  return out.length > 0 ? out : null;
}

function isoDayKey(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTopicMatchThreshold() {
  const raw = (process.env.KNOWLEDGE_TOPIC_MATCH_THRESHOLD || "").trim();
  const n = raw ? Number(raw) : NaN;
  const v = Number.isFinite(n) ? n : 0.85;
  return Math.max(0, Math.min(1, v));
}

function normalizeVec(v: number[]) {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (!Number.isFinite(norm) || norm <= 0) return v.slice();
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function meanAndNormalize(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0]?.length ?? 0;
  if (dim <= 0) return null;

  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i] ?? 0;
  }

  const mean = sum.map((x) => x / vectors.length);
  return normalizeVec(mean);
}

function getEmbeddingCfg(): EmbeddingProviderConfig {
  const apiKey = (
    process.env.KNOWLEDGE_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || ""
  ).trim();
  const baseUrl = (
    process.env.KNOWLEDGE_EMBEDDING_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    "https://api.openai.com/v1"
  ).trim();
  const model = (process.env.KNOWLEDGE_EMBEDDING_MODEL || "text-embedding-3-small").trim();

  // Dev-friendly option: allow local embeddings for demo/testing.
  if (baseUrl.toLowerCase() === "local") {
    return { apiKey: apiKey || "local", baseUrl: "local", model: model || "local" };
  }

  if (!apiKey) throw new Error("KNOWLEDGE_EMBEDDING_API_KEY is not configured");
  return { apiKey, baseUrl, model };
}

function getNamingCfg(): TopicNamingConfig {
  const apiKey = (
    process.env.KNOWLEDGE_TOPIC_NAMING_API_KEY || process.env.OPENAI_API_KEY || ""
  ).trim();
  const baseUrl = (
    process.env.KNOWLEDGE_TOPIC_NAMING_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    "https://api.openai.com/v1"
  ).trim();
  const model = (
    process.env.KNOWLEDGE_TOPIC_NAMING_MODEL || process.env.OPENAI_MODEL || "gpt-4o"
  ).trim();
  if (!apiKey) throw new Error("KNOWLEDGE_TOPIC_NAMING_API_KEY is not configured");
  return { apiKey, baseUrl, model };
}

export async function rebuildTopicsForUser(args: {
  supabase: any;
  userId: string;
  body: RebuildBody;
  /**
   * 若提供，则只有当本次 topic 内包含“窗口内新增/变更”的 note 时，才会更新 topic 的 last_ingested_at。
   * 主要用于定时增量刷新，避免每日跑一遍导致所有 topic 都被标成 New。
   */
  markIngestedSinceIso?: string | null;
}) {
  const { supabase, userId } = args;
  const body = args.body ?? {};

  const recentDays =
    typeof body?.recentDays === "number" && body.recentDays > 0
      ? Math.min(body.recentDays, 365)
      : null;
  const requestedK =
    typeof body?.k === "number" && body.k > 0 ? Math.min(Math.floor(body.k), 12) : null;
  const algorithm: "dbscan" | "kmeans" = body?.algorithm === "kmeans" ? "kmeans" : "dbscan";

  // 1) Load notes
  let notesQuery = supabase
    .from("notes")
    .select("id, title, excerpt, content_text, published_at, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(400);

  if (recentDays) {
    const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
    notesQuery = notesQuery.gte("updated_at", since);
  }

  const notesRes = await notesQuery;
  if (notesRes.error) {
    throw new ApiError("Failed to load notes", 500, notesRes.error);
  }

  const notes = (notesRes.data ?? []) as NoteRow[];
  if (notes.length === 0) {
    return { topics: [], message: "当前没有可用于生成专题的笔记" };
  }

  const embedCfg = getEmbeddingCfg();
  const namingCfg = getNamingCfg();

  // 2) Prepare embedding inputs
  const noteInputs = notes.map((n) => {
    const text = buildEmbeddingText({
      id: n.id,
      title: n.title,
      excerpt: n.excerpt,
      content_text: n.content_text,
    });
    const hash = computeNoteContentHash(text);
    return { noteId: n.id as string, text, hash, note: n };
  });

  const noteIds = noteInputs.map((x) => x.noteId);

  const existingRes = await supabase
    .from("knowledge_note_embeddings")
    .select("note_id, model, content_hash, embedding")
    .eq("user_id", userId)
    .in("note_id", noteIds);

  if (existingRes.error) {
    throw new ApiError("Failed to load embeddings", 500, existingRes.error);
  }

  const existingMap = new Map<string, { model: string; content_hash: string; embedding: unknown }>();
  for (const row of (existingRes.data ?? []) as EmbeddingRow[]) {
    existingMap.set(row.note_id, {
      model: row.model,
      content_hash: row.content_hash,
      embedding: row.embedding,
    });
  }

  const needEmbedding = noteInputs.filter((x) => {
    const cur = existingMap.get(x.noteId);
    return !cur || cur.model !== embedCfg.model || cur.content_hash !== x.hash;
  });

  // 3) Generate embeddings (batch)
  const getBatchSize = () => {
    const raw = (process.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE || "").trim();
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.min(64, Math.floor(n)));

    const base = (embedCfg.baseUrl || "").toLowerCase();
    const model = (embedCfg.model || "").toLowerCase();
    if (base.includes("open.bigmodel.cn") || model.includes("embedding-3")) return 8;
    return 64;
  };

  const isEntityTooLarge = (msg: string) =>
    msg.toLowerCase().includes("request entity too large") ||
    msg.toLowerCase().includes("entity too large") ||
    msg.includes("1210");

  const baseBatchSize = getBatchSize();
  const queue = needEmbedding.slice();

  while (queue.length > 0) {
    const batch = queue.splice(0, baseBatchSize);

    let vectors: number[][] = [];
    try {
      vectors = await createEmbeddings(
        embedCfg,
        batch.map((x) => x.text),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      if (isEntityTooLarge(msg)) {
        // Adaptive retry: split the batch to reduce payload size.
        if (batch.length > 1) {
          const mid = Math.max(1, Math.floor(batch.length / 2));
          queue.unshift(...batch.slice(mid));
          queue.unshift(...batch.slice(0, mid));
          continue;
        }

        const hint =
          "Embedding 请求体过大：请降低 KNOWLEDGE_EMBEDDING_BATCH_SIZE（例如 8/4）并设置 KNOWLEDGE_EMBEDDING_MAX_CHARS（例如 2500/1500）。";
        throw new ApiError("Embedding request entity too large", 400, {
          baseUrl: embedCfg.baseUrl,
          model: embedCfg.model,
          hint,
          raw: msg,
          sampleTextChars: batch[0]?.text?.length ?? null,
        });
      }

      const is404 = msg.includes("Embedding API failed (404)");
      const hint =
        "请检查 embedding provider 配置：建议在 .env.local 设置 KNOWLEDGE_EMBEDDING_BASE_URL/KNOWLEDGE_EMBEDDING_API_KEY/KNOWLEDGE_EMBEDDING_MODEL（不要复用仅支持 chat 的 base url）。";

      throw new ApiError(
        "Embedding provider is misconfigured",
        is404 ? 400 : 500,
        {
          baseUrl: embedCfg.baseUrl,
          model: embedCfg.model,
          hint,
          raw: msg,
        },
      );
    }

    const rows = batch.map((x, idx) => ({
      note_id: x.noteId,
      user_id: userId,
      model: embedCfg.model,
      content_hash: x.hash,
      embedding: vectors[idx],
    }));

    const upsertRes = await supabase.from("knowledge_note_embeddings").upsert(rows, {
      onConflict: "note_id",
    });
    if (upsertRes.error) {
      throw new ApiError("Failed to persist embeddings", 500, upsertRes.error);
    }

    for (let j = 0; j < batch.length; j++) {
      existingMap.set(batch[j].noteId, {
        model: embedCfg.model,
        content_hash: batch[j].hash,
        embedding: vectors[j],
      });
    }
  }

  // 4) Build vector matrix
  const usable: Array<{ note: NoteRow; vec: number[] }> = [];
  for (const x of noteInputs) {
    const cur = existingMap.get(x.noteId);
    const vec = toNumberArray(cur?.embedding);
    if (vec) usable.push({ note: x.note, vec });
  }

  if (usable.length < 2) {
    throw new ApiError("Not enough embeddings to cluster", 400, { usable: usable.length });
  }

  // 5) Clustering
  type ClusterItem = {
    note: NoteRow;
    score: number;
    event_time: string | null;
    event_fingerprint: string | null;
  };

  let clusters = new Map<number, ClusterItem[]>();
  let clusterMeta: Record<string, unknown> = {};

  if (algorithm === "dbscan") {
    const eps =
      typeof body?.eps === "number" && body.eps > 0
        ? body.eps
        : estimateDbscanEps(usable.map((u) => u.vec));
    const minSamples =
      typeof body?.minSamples === "number" && body.minSamples > 0
        ? Math.min(Math.floor(body.minSamples), 12)
        : 3;
    const labels = dbscanCosine(usable.map((u) => u.vec), eps, minSamples);

    for (let i = 0; i < usable.length; i++) {
      const label = labels[i] ?? -1;
      if (label < 0) continue; // noise dropped
      const list = clusters.get(label) ?? [];
      list.push({ note: usable[i].note, score: 0, event_time: null, event_fingerprint: null });
      clusters.set(label, list);
    }

    clusterMeta = { algorithm: "dbscan", eps, minSamples };

    // fallback: if everything becomes noise, use kmeans
    if (clusters.size === 0) {
      clusters = new Map<number, ClusterItem[]>();
    }
  }

  if (clusters.size === 0) {
    const k = requestedK ?? chooseHeuristicK(usable.length);
    const { assignments, centroids } = kmeansCosine(usable.map((u) => u.vec), k);

    for (let i = 0; i < usable.length; i++) {
      const c = assignments[i] ?? 0;
      const centroid = centroids[c];
      const score = centroid
        ? centroid.reduce((s, v, idx) => s + v * (usable[i].vec[idx] ?? 0), 0)
        : 0;
      const list = clusters.get(c) ?? [];
      list.push({ note: usable[i].note, score, event_time: null, event_fingerprint: null });
      clusters.set(c, list);
    }

    clusterMeta = { algorithm: "kmeans", k };
  }

  const clusterList = Array.from(clusters.entries())
    .map(([idx, items]) => ({ idx, items }))
    .filter((c) => c.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);

  // 6) Load existing topics (to preserve pinned/archived/manual edits as much as possible)
  const loadTopicsOrdered = async (withPin: boolean) => {
    const base = supabase
      .from("knowledge_topics")
      .select(
        "id, title, pinned, pinned_at, archived, archived_at, last_ingested_at, updated_at, created_at",
      )
      .eq("user_id", userId);

    if (withPin) {
      return await base
        .order("pinned", { ascending: false })
        .order("pinned_at", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50);
    }

    return await base.order("updated_at", { ascending: false }).limit(50);
  };

  let existingTopics: TopicRow[] = [];
  {
    let res: { data: unknown[] | null; error: any } = await loadTopicsOrdered(true);
    if (
      res.error &&
      typeof res.error.message === "string" &&
      (res.error.message.includes("pinned") ||
        res.error.message.includes("archived") ||
        res.error.message.includes("last_ingested_at"))
    ) {
      // 兼容旧库：还没跑到迁移时不阻断
      res = await supabase
        .from("knowledge_topics")
        .select("id, title, updated_at, created_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);
    }
    if (!res.error) existingTopics = (res.data ?? []) as TopicRow[];
  }

  // 6.1) Incremental matching: map each cluster to an existing topic only when similarity >= threshold
  const topicMatchThreshold = getTopicMatchThreshold();

  const existingTopicById = new Map<string, TopicRow>();
  for (const t of existingTopics) {
    if (t?.id) existingTopicById.set(t.id, t);
  }

  // Archived topics should not be “revived” by auto rebuild.
  const matchableTopics = existingTopics.filter((t) => !t?.archived);

  const normalizedVecByNoteId = new Map<string, number[]>();
  for (const u of usable) {
    normalizedVecByNoteId.set(u.note.id, normalizeVec(u.vec));
  }

  const clusterCentroidByLabel = new Map<number, number[]>();
  for (const c of clusterList) {
    const vectors = c.items
      .map((m) => normalizedVecByNoteId.get(m.note.id))
      .filter((v): v is number[] => Array.isArray(v) && v.length > 0);
    const centroid = meanAndNormalize(vectors);
    if (centroid) clusterCentroidByLabel.set(c.idx, centroid);
  }

  const topicCentroidById = new Map<string, number[]>();
  if (matchableTopics.length > 0) {
    const topicIds = matchableTopics.map((t) => t.id);

    let membersRes = await supabase
      .from("knowledge_topic_members")
      .select("topic_id, note_id, manual_state, source")
      .eq("user_id", userId)
      .in("topic_id", topicIds);

    if (
      membersRes.error &&
      typeof membersRes.error.message === "string" &&
      (membersRes.error.message.includes("manual_state") || membersRes.error.message.includes("source"))
    ) {
      // 兼容旧库：没有 manual_state/source 字段
      membersRes = await supabase
        .from("knowledge_topic_members")
        .select("topic_id, note_id")
        .eq("user_id", userId)
        .in("topic_id", topicIds);
    }

    if (!membersRes.error) {
      const topicToNoteIds = new Map<string, string[]>();
      for (const row of (membersRes.data ?? []) as TopicMemberRow[]) {
        const topicId = row.topic_id;
        const noteId = row.note_id;
        if (!topicId || !noteId) continue;

        const manualState = typeof row.manual_state === "string" ? row.manual_state : null;
        if (manualState === "excluded") continue;

        const list = topicToNoteIds.get(topicId) ?? [];
        list.push(noteId);
        topicToNoteIds.set(topicId, list);
      }

      for (const t of matchableTopics) {
        const ids = topicToNoteIds.get(t.id) ?? [];
        const vectors = ids
          .map((id) => normalizedVecByNoteId.get(id))
          .filter((v): v is number[] => Array.isArray(v) && v.length > 0);

        const centroid = meanAndNormalize(vectors);
        if (centroid) topicCentroidById.set(t.id, centroid);
      }
    }
  }

  const clusterMatchByLabel = new Map<number, { topicId: string; sim: number }>();
  const usedTopics = new Set<string>();
  const usedClusters = new Set<number>();

  const candidatePairs: Array<{ clusterLabel: number; topicId: string; sim: number; pinned: boolean; clusterSize: number }> = [];
  for (const c of clusterList) {
    const cc = clusterCentroidByLabel.get(c.idx);
    if (!cc) continue;

    for (const t of matchableTopics) {
      const tc = topicCentroidById.get(t.id);
      if (!tc) continue;

      const sim = dot(cc, tc);
      if (Number.isFinite(sim) && sim >= topicMatchThreshold) {
        candidatePairs.push({
          clusterLabel: c.idx,
          topicId: t.id,
          sim,
          pinned: Boolean(t.pinned),
          clusterSize: c.items.length,
        });
      }
    }
  }

  candidatePairs.sort((a, b) => {
    if (b.sim !== a.sim) return b.sim - a.sim;
    if (b.pinned !== a.pinned) return Number(b.pinned) - Number(a.pinned);
    return b.clusterSize - a.clusterSize;
  });

  for (const p of candidatePairs) {
    if (usedClusters.has(p.clusterLabel)) continue;
    if (usedTopics.has(p.topicId)) continue;

    usedClusters.add(p.clusterLabel);
    usedTopics.add(p.topicId);
    clusterMatchByLabel.set(p.clusterLabel, { topicId: p.topicId, sim: p.sim });
  }

  const builtAt = new Date().toISOString();
  const nowIso = builtAt;
  const markSince = (args.markIngestedSinceIso ?? "").trim();
  const markSinceMs = markSince ? new Date(markSince).getTime() : NaN;

  const createdOrUpdated: Array<{
    id: string;
    title: string | null;
    keywords: string[] | null;
    summary_markdown: string | null;
    member_count: number | null;
    updated_at: string;
    created_at: string;
  }> = [];

  let updatedTopics = 0;
  let createdTopics = 0;

  // 7) Create/update topics + members + events
  for (let ti = 0; ti < clusterList.length; ti++) {
    const c = clusterList[ti];

    // representative notes: pick by updated time as stable proxy
    const membersSorted = c.items
      .slice()
      .sort(
        (a, b) =>
          new Date(b.note.updated_at || b.note.created_at).getTime() -
          new Date(a.note.updated_at || a.note.created_at).getTime(),
      );

    const reps = membersSorted.slice(0, 8).map((m) => ({
      id: m.note.id,
      title: m.note.title,
      excerpt: m.note.excerpt,
      content_text: m.note.content_text,
    }));

    let title = `专题 ${ti + 1}`;
    let keywords: string[] = [];
    let report = "";
    try {
      const named = await nameTopicAndReport(namingCfg, { notes: reps });
      title = named.title;
      keywords = named.keywords;
      report = named.report_markdown;
    } catch (e) {
      console.warn("nameTopicAndReport failed", e);
    }

    const match = clusterMatchByLabel.get(c.idx) ?? null;
    const existing = match?.topicId ? existingTopicById.get(match.topicId) ?? null : null;

    const config = {
      embeddingModel: embedCfg.model,
      embeddingBaseUrl: embedCfg.baseUrl,
      namingModel: namingCfg.model,
      builtAt,
      topicMatchThreshold,
      topicMatchSim: match?.sim ?? null,
      ...clusterMeta,
    };

    const hasNewInWindow = Number.isFinite(markSinceMs)
      ? membersSorted.some(
          (m) => new Date(m.note.updated_at || m.note.created_at).getTime() >= markSinceMs,
        )
      : true;

    let topicId = "";
    if (existing?.id) {
      updatedTopics += 1;
      const patch: Record<string, unknown> = {
        title,
        keywords,
        summary_markdown: report,
        member_count: c.items.length,
        config,
      };

      if (hasNewInWindow) {
        patch.last_ingested_at = nowIso;
      }

      const upd = await supabase
        .from("knowledge_topics")
        .update(patch)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id, title, keywords, summary_markdown, member_count, updated_at, created_at")
        .single();

      if (upd.error || !upd.data) {
        throw new ApiError("Failed to update topic", 500, upd.error);
      }

      topicId = upd.data.id;
      createdOrUpdated.push(upd.data);
    } else {
      createdTopics += 1;
      const ins = await supabase
        .from("knowledge_topics")
        .insert({
          user_id: userId,
          title,
          keywords,
          summary_markdown: report,
          member_count: c.items.length,
          config,
          last_ingested_at: nowIso,
          archived: false,
          pinned: false,
        })
        .select("id, title, keywords, summary_markdown, member_count, updated_at, created_at")
        .single();

      if (ins.error || !ins.data) {
        throw new ApiError("Failed to create topic", 500, ins.error);
      }

      topicId = ins.data.id;
      createdOrUpdated.push(ins.data);
    }

    // 7.1 delete auto members (preserve manual members if schema supports)
    let delAuto = await supabase
      .from("knowledge_topic_members")
      .delete()
      .eq("topic_id", topicId)
      .eq("user_id", userId)
      .eq("source", "auto");

    if (delAuto.error && typeof delAuto.error.message === "string" && delAuto.error.message.includes("source")) {
      // 兼容旧库：没有 source 字段时只能全删
      delAuto = await supabase.from("knowledge_topic_members").delete().eq("topic_id", topicId).eq("user_id", userId);
    }

    if (delAuto.error) {
      throw new ApiError("Failed to clear old topic members", 500, delAuto.error);
    }

    // 7.2 build members with event fields
    // 先按 fingerprint 分组，计算 evidence_rank
    const memberDrafts = c.items.map((m) => {
      const eventTime = extractEventTimeIso(m.note);
      const dayKey = eventTime ? isoDayKey(eventTime) : "";
      const fp = dayKey
        ? buildEventFingerprint({ topicId, dayKey, title: m.note.title || m.note.excerpt || "" })
        : null;
      return { note: m.note, score: m.score, event_time: eventTime, event_fingerprint: fp };
    });

    const fpGroups = new Map<string, typeof memberDrafts>();
    for (const md of memberDrafts) {
      if (!md.event_fingerprint) continue;
      const list = fpGroups.get(md.event_fingerprint) ?? [];
      list.push(md);
      fpGroups.set(md.event_fingerprint, list);
    }

    const evidenceRankMap = new Map<string, Map<string, number>>();
    for (const [fp, list] of fpGroups.entries()) {
      const sorted = list.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const m = new Map<string, number>();
      for (let i = 0; i < sorted.length; i++) m.set(sorted[i].note.id, i + 1);
      evidenceRankMap.set(fp, m);
    }

    const rows = memberDrafts.map((md) => ({
      topic_id: topicId,
      note_id: md.note.id,
      user_id: userId,
      score: md.score,
      source: "auto",
      event_time: md.event_time,
      event_fingerprint: md.event_fingerprint,
      evidence_rank: md.event_fingerprint
        ? evidenceRankMap.get(md.event_fingerprint)?.get(md.note.id) ?? null
        : null,
    }));

    // chunk upsert to avoid payload size
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const up = await supabase.from("knowledge_topic_members").upsert(chunk, {
        onConflict: "topic_id,note_id",
      });
      if (up.error) {
        throw new ApiError("Failed to upsert topic members", 500, up.error);
      }
    }

    // 7.3 rebuild events (best-effort)
    // 如果数据库还没迁移到 events 表，这里会失败，但不阻断整个 rebuild。
    try {
      const delEvents = await supabase
        .from("knowledge_topic_events")
        .delete()
        .eq("topic_id", topicId)
        .eq("user_id", userId);
      if (!delEvents.error) {
        const eventRows: Array<{
          user_id: string;
          topic_id: string;
          event_time: string;
          title: string | null;
          fingerprint: string;
          importance: number;
          source: any;
        }> = [];

        for (const [fp, list] of fpGroups.entries()) {
          const times = list
            .map((x) => x.event_time)
            .filter((t): t is string => typeof t === "string" && t.length > 0);
          if (times.length === 0) continue;
          const event_time = times.slice().sort()[0];
          const titleBest =
            list.find((x) => x.note.title && x.note.title.trim())?.note.title ||
            list[0]?.note.title ||
            null;
          eventRows.push({
            user_id: userId,
            topic_id: topicId,
            event_time,
            fingerprint: fp,
            title: titleBest,
            importance: Math.log1p(list.length),
            source: { note_ids: list.map((x) => x.note.id), count: list.length },
          });
        }

        if (eventRows.length > 0) {
          const insEvents = await supabase.from("knowledge_topic_events").insert(eventRows);
          if (insEvents.error) {
            console.warn("Failed to insert knowledge_topic_events", insEvents.error);
          }
        }
      }
    } catch (e) {
      console.warn("Rebuild topic events failed", e);
    }
  }

  return {
    topics: createdOrUpdated,
    builtAt,
    algorithm: clusterMeta,
    topicMatching: {
      threshold: topicMatchThreshold,
      clusters: clusterList.length,
      matchableTopics: matchableTopics.length,
      matchedClusters: clusterMatchByLabel.size,
      createdTopics,
      updatedTopics,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RebuildBody;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await rebuildTopicsForUser({ supabase, userId: user.id, body, markIngestedSinceIso: null });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const details = error instanceof ApiError ? error.details : undefined;
    console.error("API Error in /api/knowledge/topics/rebuild:", error);
    return NextResponse.json(
      {
        error: "Server error",
        details: details ?? (error instanceof Error ? error.message : String(error)),
      },
      { status },
    );
  }
}
