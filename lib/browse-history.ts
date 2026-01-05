export type BrowseHistoryEntry = {
  noteId: string;
  title: string | null;
  siteName: string | null;
  sourceUrl: string | null;
  contentType: "article" | "video" | "audio" | null;
  visitedAt: string; // ISO string
};

const KEY_PREFIX = "newsbox:browseHistory:";
const MAX_ENTRIES = 500;

function getKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getBrowseHistory(userId: string): BrowseHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<BrowseHistoryEntry[]>(window.localStorage.getItem(getKey(userId)), []);
  return list
    .filter((x) => x && typeof x.noteId === "string" && typeof x.visitedAt === "string")
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
}

export function addBrowseHistoryEntry(
  userId: string,
  entry: Omit<BrowseHistoryEntry, "visitedAt"> & { visitedAt?: string }
) {
  if (typeof window === "undefined") return;
  const visitedAt = entry.visitedAt ?? new Date().toISOString();
  const prev = getBrowseHistory(userId);

  // 去重：同一篇笔记只保留最新一次访问
  const next = [
    {
      ...entry,
      visitedAt,
    },
    ...prev.filter((x) => x.noteId !== entry.noteId),
  ].slice(0, MAX_ENTRIES);

  window.localStorage.setItem(getKey(userId), JSON.stringify(next));
}

export function clearBrowseHistory(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getKey(userId));
}


