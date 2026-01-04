import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { rebuildTopicsForUser } from "../rebuild/route";

type NightlyRefreshBody = {
  hours?: number;
  maxUsers?: number;
  algorithm?: "dbscan" | "kmeans";
};

function getCronSecretFromRequest(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return (req.headers.get("x-cron-secret") || "").trim();
}

export async function POST(request: NextRequest) {
  const cronSecret = (process.env.KNOWLEDGE_CRON_SECRET || "").trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "KNOWLEDGE_CRON_SECRET is not configured" }, { status: 500 });
  }

  const token = getCronSecretFromRequest(request);
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL is not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as NightlyRefreshBody;
  const hours = typeof body?.hours === "number" && body.hours > 0 ? Math.min(body.hours, 24 * 7) : 24;
  const maxUsers = typeof body?.maxUsers === "number" && body.maxUsers > 0 ? Math.min(Math.floor(body.maxUsers), 200) : 25;
  const algorithm: "dbscan" | "kmeans" = body?.algorithm === "kmeans" ? "kmeans" : "dbscan";

  const markSinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) 找到“近期有变更”的用户（按 notes.updated_at 窗口粗筛）
  const recentRes = await supabaseAdmin
    .from("notes")
    .select("user_id, updated_at")
    .gte("updated_at", markSinceIso)
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (recentRes.error) {
    return NextResponse.json(
      { error: "Failed to load recent notes", details: recentRes.error },
      { status: 500 },
    );
  }

  const userIds: string[] = [];
  const seen = new Set<string>();
  for (const row of (recentRes.data ?? []) as Array<{ user_id: string | null }>) {
    const uid = (row.user_id || "").trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    userIds.push(uid);
    if (userIds.length >= maxUsers) break;
  }

  // 2) 逐个用户做“增量窗口标记”的刷新
  const results: Array<{ userId: string; ok: boolean; details?: unknown }> = [];
  let refreshedUsers = 0;
  let refreshedTopics = 0;

  for (const userId of userIds) {
    try {
      const res = await rebuildTopicsForUser({
        supabase: supabaseAdmin,
        userId,
        body: { algorithm },
        markIngestedSinceIso: markSinceIso,
      });

      refreshedUsers += 1;
      if (Array.isArray((res as any)?.topics)) refreshedTopics += (res as any).topics.length;
      results.push({ userId, ok: true });

      // 3) 生命周期：30 天无新增 & 未置顶 → 自动归档（best-effort）
      const archiveBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("knowledge_topics")
        .update({ archived: true, archived_at: nowIso })
        .eq("user_id", userId)
        .eq("pinned", false)
        .eq("archived", false)
        .or(`last_ingested_at.is.null,last_ingested_at.lt.${archiveBefore}`);
    } catch (e) {
      results.push({ userId, ok: false, details: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    markSinceIso,
    maxUsers,
    candidates: userIds.length,
    refreshedUsers,
    refreshedTopics,
    results,
  });
}
