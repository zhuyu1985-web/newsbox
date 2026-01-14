const DIRTY_ANNOTATION_NOTE_IDS_KEY = "newsbox_dirty_annotation_note_ids";
// 存储最近更新的 noteId，用于延迟刷新时能访问到
const LAST_DIRTY_NOTE_ID_KEY = "newsbox_last_dirty_note_id";
export const NOTE_ANNOTATIONS_CHANGED_EVENT = "newsbox:note-annotations-changed";

export function markNoteAnnotationsDirty(noteId: string) {
  if (typeof window === "undefined") return;
  if (!noteId) return;

  try {
    localStorage.setItem("newsbox:annotations_updated_at", String(Date.now()));
    // 同时保存最近更新的 noteId 到 localStorage，便于延迟刷新时使用
    localStorage.setItem(LAST_DIRTY_NOTE_ID_KEY, noteId);
  } catch {
    // ignore
  }

  try {
    const raw = sessionStorage.getItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.from(new Set([...ids, noteId]));
    sessionStorage.setItem(DIRTY_ANNOTATION_NOTE_IDS_KEY, JSON.stringify(next));
  } catch {
    sessionStorage.setItem(DIRTY_ANNOTATION_NOTE_IDS_KEY, JSON.stringify([noteId]));
  }

  window.dispatchEvent(
    new CustomEvent(NOTE_ANNOTATIONS_CHANGED_EVENT, { detail: { noteId } }),
  );
}

/**
 * 只读取脏数据，不清空 sessionStorage
 * 用于检查是否有需要刷新的数据
 */
export function peekDirtyAnnotationNoteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 清空指定的脏 noteIds
 * 只清空已处理的 IDs，保留其他未处理的
 */
export function clearDirtyAnnotationNoteIds(processedIds: string[]) {
  if (typeof window === "undefined") return;
  if (!processedIds.length) return;
  try {
    const raw = sessionStorage.getItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    const remaining = ids.filter((id) => !processedIds.includes(id));
    if (remaining.length > 0) {
      sessionStorage.setItem(DIRTY_ANNOTATION_NOTE_IDS_KEY, JSON.stringify(remaining));
    } else {
      sessionStorage.removeItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    }
  } catch {
    sessionStorage.removeItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
  }
}

/**
 * 获取最近更新的 noteId（从 localStorage）
 * 用于延迟刷新时，即使 sessionStorage 被清空也能获取到需要刷新的 noteId
 */
export function getLastDirtyNoteId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_DIRTY_NOTE_ID_KEY);
  } catch {
    return null;
  }
}

export function consumeDirtyAnnotationNoteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    if (!raw) return [];
    sessionStorage.removeItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    sessionStorage.removeItem(DIRTY_ANNOTATION_NOTE_IDS_KEY);
    return [];
  }
}
