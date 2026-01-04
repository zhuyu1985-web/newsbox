import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function domainFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // join days: prefer profiles.created_at
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .maybeSingle();

  const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date();
  const joinedDays = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
  );

  // counts (include archived + deleted)
  const [
    notesRes,
    foldersRes,
    tagsRes,
    annotationsRes,
    visitsRes,
    notesMinimalRes,
    visitsMinimalRes,
  ] = await Promise.all([
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("tags").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("annotations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("note_visit_events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    // for distribution + top saved domains (minimal columns)
    supabase
      .from("notes")
      .select("content_type, source_url, content_text")
      .eq("user_id", user.id),
    // for top visited domains
    supabase
      .from("note_visit_events")
      .select("source_domain")
      .eq("user_id", user.id),
  ]);

  const notesRows = (notesMinimalRes.data ?? []) as Array<{
    content_type: string | null;
    source_url: string | null;
    content_text: string | null;
  }>;

  const contentType: Record<string, number> = {};
  const savedDomainCounts = new Map<string, number>();
  let wordsCount = 0;
  const smartDomainSet = new Set<string>();

  for (const r of notesRows) {
    const t = r.content_type || "unknown";
    contentType[t] = (contentType[t] ?? 0) + 1;

    if (r.content_text) wordsCount += r.content_text.length;

    const d = domainFromUrl(r.source_url);
    if (d) {
      smartDomainSet.add(d);
      savedDomainCounts.set(d, (savedDomainCounts.get(d) ?? 0) + 1);
    }
  }

  const visitsRows = (visitsMinimalRes.data ?? []) as Array<{ source_domain: string | null }>;
  const visitedDomainCounts = new Map<string, number>();
  for (const r of visitsRows) {
    const d = r.source_domain || "unknown";
    visitedDomainCounts.set(d, (visitedDomainCounts.get(d) ?? 0) + 1);
  }

  const topSavedDomains = Array.from(savedDomainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  const topVisitedDomains = Array.from(visitedDomainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return NextResponse.json({
    joinedDays,
    notesCount: notesRes.count ?? 0,
    foldersCount: foldersRes.count ?? 0,
    // 当前系统没有独立 smart_list 表，这里用“唯一域名数”作为可解释的智能列表数量
    smartListsCount: smartDomainSet.size,
    tagsCount: tagsRes.count ?? 0,
    annotationsCount: annotationsRes.count ?? 0,
    wordsCount,
    visitsCount: visitsRes.count ?? 0,
    contentType,
    topSavedDomains,
    topVisitedDomains,
  });
}


