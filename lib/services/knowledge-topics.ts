import { createHash } from "node:crypto";

export type KnowledgeTopicConfig = {
  k: number;
  embeddingModel: string;
  embeddingBaseUrl: string;
  namingModel: string;
  builtAt: string;
};

export type NoteEmbeddingInput = {
  id: string;
  title: string | null;
  excerpt: string | null;
  content_text: string | null;
};

export function buildEmbeddingText(note: NoteEmbeddingInput) {
  const parts = [note.title, note.excerpt, note.content_text].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  const text = parts.join("\n\n").trim();
  // 控制长度，避免 embedding 端 token 过高；允许通过 env 调整
  const raw = (process.env.KNOWLEDGE_EMBEDDING_MAX_CHARS || "").trim();
  const parsed = raw ? Number(raw) : NaN;
  const maxChars = Number.isFinite(parsed) ? Math.floor(parsed) : 8000;
  const safeMax = Math.max(256, Math.min(12000, maxChars));
  return text.slice(0, safeMax);
}

export function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function computeNoteContentHash(inputText: string) {
  return sha256Hex(inputText);
}

function normalizeVector(v: number[]) {
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

function cosineSimilarity(a: number[], b: number[]) {
  return dot(a, b);
}

function pickRandomDistinctIndices(n: number, k: number) {
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, k);
}

export function kmeansCosine(vectorsRaw: number[][], k: number, maxIter = 24) {
  const vectors = vectorsRaw.map(normalizeVector);
  const n = vectors.length;

  if (n === 0) return { assignments: [] as number[], centroids: [] as number[][] };
  if (k <= 1 || n === 1) return { assignments: Array(n).fill(0), centroids: [vectors[0]] };

  const kk = Math.min(k, n);
  const initIdx = pickRandomDistinctIndices(n, kk);
  const centroids = initIdx.map((idx) => vectors[idx]);

  const assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0;

    // assign
    for (let i = 0; i < n; i++) {
      const v = vectors[i];
      let best = 0;
      let bestScore = -Infinity;
      for (let c = 0; c < kk; c++) {
        const score = cosineSimilarity(v, centroids[c]);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed++;
      }
    }

    // update centroids
    const sums: number[][] = Array.from({ length: kk }, () => Array(centroids[0].length).fill(0));
    const counts = Array.from({ length: kk }, () => 0);

    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c] += 1;
      const v = vectors[i];
      for (let d = 0; d < v.length; d++) sums[c][d] += v[d];
    }

    for (let c = 0; c < kk; c++) {
      if (counts[c] === 0) {
        // empty cluster: re-seed
        const idx = Math.floor(Math.random() * n);
        centroids[c] = vectors[idx];
        continue;
      }
      const mean = sums[c].map((x) => x / counts[c]);
      centroids[c] = normalizeVector(mean);
    }

    if (changed === 0) break;
  }

  return { assignments, centroids };
}

export function chooseHeuristicK(n: number) {
  if (n <= 0) return 0;
  if (n <= 6) return 1;
  // 启发式：随规模增长缓慢增加 K
  const k = Math.round(Math.sqrt(n / 2));
  return Math.max(2, Math.min(10, k));
}

export type DbscanConfig = {
  eps?: number;
  minSamples?: number;
  sampleLimit?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * 基于“最近邻距离分位数”的粗略 eps 估计。
 * - 这是一个工程折中：避免每个用户都手动调参。
 * - 适用规模：~400 条以内（当前 API 限制）。
 */
export function estimateDbscanEps(vectorsRaw: number[][], opts?: DbscanConfig) {
  const vectors = vectorsRaw.map(normalizeVector);
  const n = vectors.length;
  if (n < 3) return 0.18;

  const sampleLimit = typeof opts?.sampleLimit === "number" && opts.sampleLimit > 0 ? Math.min(opts.sampleLimit, n) : Math.min(200, n);
  const idxs = sampleLimit === n ? Array.from({ length: n }, (_, i) => i) : pickRandomDistinctIndices(n, sampleLimit);

  const dists: number[] = [];
  for (const i of idxs) {
    let best = -Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim > best) best = sim;
    }
    if (Number.isFinite(best)) {
      const dist = 1 - best;
      if (Number.isFinite(dist)) dists.push(dist);
    }
  }

  if (dists.length === 0) return 0.18;
  dists.sort((a, b) => a - b);

  const q = 0.25;
  const pos = Math.floor((dists.length - 1) * q);
  const base = dists[pos] ?? dists[0];

  // 稍微放宽一点，降低噪声比
  return clamp(base * 1.15, 0.06, 0.35);
}

/**
 * 简化版 DBSCAN（cosine distance）。
 * 返回 labels：-1 表示 noise，其余为 cluster id (0..k-1)。
 */
export function dbscanCosine(vectorsRaw: number[][], eps: number, minSamples: number) {
  const vectors = vectorsRaw.map(normalizeVector);
  const n = vectors.length;
  const UNVISITED = -99;
  const labels = new Array<number>(n).fill(UNVISITED);

  const regionQuery = (i: number) => {
    const out: number[] = [];
    const vi = vectors[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = 1 - cosineSimilarity(vi, vectors[j]);
      if (dist <= eps) out.push(j);
    }
    return out;
  };

  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== UNVISITED) continue;

    const neighbors = regionQuery(i);
    if (neighbors.length + 1 < minSamples) {
      labels[i] = -1;
      continue;
    }

    labels[i] = clusterId;
    const seed = neighbors.slice();

    while (seed.length > 0) {
      const j = seed.pop()!;

      if (labels[j] === -1) labels[j] = clusterId;
      if (labels[j] !== UNVISITED) continue;

      labels[j] = clusterId;
      const n2 = regionQuery(j);
      if (n2.length + 1 >= minSamples) {
        for (const x of n2) {
          if (labels[x] === UNVISITED || labels[x] === -1) seed.push(x);
        }
      }
    }

    clusterId++;
  }

  return labels.map((x) => (x === UNVISITED ? -1 : x));
}

function parseIsoDateFromText(text: string) {
  // 2025-01-03 / 2025/01/03
  let m = text.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, mo - 1, d)).toISOString();
    }
  }

  // 2025年1月3日
  m = text.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, mo - 1, d)).toISOString();
    }
  }

  return null;
}

/**
 * P2: “事件发生时间”抽取（当前先做低成本规则/兜底）。
 * 优先级：published_at > title/excerpt 规则日期 > created_at
 */
export function extractEventTimeIso(note: {
  published_at?: string | null;
  created_at?: string | null;
  title?: string | null;
  excerpt?: string | null;
}) {
  const pub = typeof note.published_at === "string" ? note.published_at : null;
  if (pub) {
    const d = new Date(pub);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }

  const text = `${note.title || ""}\n${note.excerpt || ""}`.trim();
  if (text) {
    const parsed = parseIsoDateFromText(text);
    if (parsed) return parsed;
  }

  const created = typeof note.created_at === "string" ? note.created_at : null;
  if (created) {
    const d = new Date(created);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }

  return null;
}

export function buildEventFingerprint(payload: { topicId?: string; dayKey: string; title: string }) {
  const normTitle = String(payload.title || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\s\u3000]+/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .trim()
    .slice(0, 48);

  return sha256Hex(`${payload.topicId || ""}|${payload.dayKey}|${normTitle}`);
}

export type EmbeddingProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function tokenizeForLocalEmbedding(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/[\s\u3000]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4096);
}

function localHashEmbedding(text: string, dim = 384) {
  const v = new Array<number>(dim).fill(0);
  const tokens = tokenizeForLocalEmbedding(text);

  for (const tok of tokens) {
    const h = createHash("sha256").update(tok).digest();
    const n = h.readUInt32BE(0);
    const idx = n % dim;
    const sign = (n & 1) === 0 ? 1 : -1;
    v[idx] += sign;
  }

  // normalize
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (!Number.isFinite(norm) || norm <= 0) return v;
  return v.map((x) => x / norm);
}

export async function createEmbeddings(cfg: EmbeddingProviderConfig, inputs: string[]) {
  const base = (cfg.baseUrl || "").trim();
  if (base.toLowerCase() === "local") {
    return inputs.map((t) => localHashEmbedding(t, 384));
  }

  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");
  const endpoint = baseUrl.toLowerCase().endsWith("/embeddings") ? baseUrl : `${baseUrl}/embeddings`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, input: inputs }),
  });

  if (!resp.ok) {
    // Dev fallback: some OpenAI-compatible chat providers do NOT implement /embeddings.
    // In dev, fall back to local embeddings so the Smart Topics UI can still work.
    if (resp.status === 404 && process.env.NODE_ENV !== "production") {
      const warn = await resp.text().catch(() => "");
      console.warn("Embedding endpoint 404, falling back to local embeddings (dev only)", warn.slice(0, 300));
      return inputs.map((t) => localHashEmbedding(t, 384));
    }

    const err = await resp.json().catch(() => null);
    throw new Error(`Embedding API failed (${resp.status}): ${JSON.stringify(err)}`);
  }

  const data = await resp.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  const vectors: number[][] = [];
  for (const item of list) {
    const emb = item?.embedding;
    if (!Array.isArray(emb)) {
      vectors.push([]);
      continue;
    }
    vectors.push(
      emb
        .map((x: unknown) => (typeof x === "number" ? x : Number(x)))
        .filter((x: number) => Number.isFinite(x)),
    );
  }

  if (vectors.length !== inputs.length) {
    throw new Error(`Embedding API returned ${vectors.length} items for ${inputs.length} inputs`);
  }

  return vectors;
}

export type TopicNamingConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export async function nameTopicAndReport(
  cfg: TopicNamingConfig,
  payload: {
    notes: Array<{ id: string; title: string | null; excerpt: string | null; content_text: string | null }>;
  },
): Promise<{ title: string; keywords: string[]; report_markdown: string }> {
  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");

  const system = `你是知识库的专题编辑。你必须只基于给定的笔记片段输出结果，禁止编造。

请输出 JSON（不要包含多余文字），字段：
- title: 专题标题（中文，<=16字）
- keywords: 关键词数组（中文短词，最多6个）
- report_markdown: 专题报告（Markdown，结构化：概述/要点/时间线提示/延伸问题）。

引用规则：当陈述来自某条笔记的事实/观点时，必须在句末附上引用标记 [note:<id>]。`;

  const notesText = payload.notes
    .slice(0, 8)
    .map((n, i) => {
      const snippet = [n.excerpt, n.content_text].find((x) => typeof x === "string" && x.trim()) || "";
      return `[#${i + 1}] [note:${n.id}] title=${JSON.stringify(n.title || "") }\n${String(snippet).slice(0, 800)}`;
    })
    .join("\n\n---\n\n");

  const user = `请基于以下笔记片段生成专题标题/关键词/专题报告：\n\n${notesText}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      // OpenAI-compatible providers may ignore this; we still parse JSON from content.
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => null);
    throw new Error(`Naming API failed (${resp.status}): ${JSON.stringify(err)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Naming API returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 尝试兜底：截取第一个 {..} 块
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Failed to parse naming JSON");
    parsed = JSON.parse(m[0]);
  }

  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

  const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "未命名专题";
  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 6)
    : [];
  const report_markdown = typeof obj.report_markdown === "string" && obj.report_markdown.trim() ? obj.report_markdown.trim() : "";

  return { title, keywords, report_markdown };
}
