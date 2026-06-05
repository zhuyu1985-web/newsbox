export const LOCAL_TRANSCRIPT_MARKERS_STORAGE_PREFIX =
  "newsbox:local-transcript-markers:";

export type LocalMarkerKind = "important" | "question" | "todo";
export type LocalMarkerTarget = "transcript" | "qa" | "speaker";

export interface LocalTranscriptMarker {
  id: string;
  user_id: string;
  note_id: string;
  marker_kind: LocalMarkerKind;
  target_type: LocalMarkerTarget;
  segment_idx: number | null;
  speaker_id: string | null;
  anchor_time: number | null;
  selection_start: number | null;
  selection_end: number | null;
  selection_text: string | null;
  created_at: string;
}

export interface LocalCreateMarkerInput {
  marker_kind: LocalMarkerKind;
  target_type: LocalMarkerTarget;
  segment_idx?: number;
  speaker_id?: string;
  anchor_time?: number;
  selection_start?: number;
  selection_end?: number;
  selection_text?: string;
}

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getLocalTranscriptMarkersStorageKey(noteId: string) {
  return `${LOCAL_TRANSCRIPT_MARKERS_STORAGE_PREFIX}${noteId}`;
}

export function parseLocalTranscriptMarkers(
  raw: string | null,
  noteId: string,
): LocalTranscriptMarker[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalTranscriptMarker =>
        typeof item?.id === "string" &&
        item.note_id === noteId &&
        typeof item.marker_kind === "string" &&
        typeof item.target_type === "string",
    );
  } catch {
    return [];
  }
}

export function readLocalTranscriptMarkers(noteId: string) {
  if (!storageAvailable()) return [];
  return parseLocalTranscriptMarkers(
    window.localStorage.getItem(getLocalTranscriptMarkersStorageKey(noteId)),
    noteId,
  );
}

export function writeLocalTranscriptMarkers(
  noteId: string,
  markers: LocalTranscriptMarker[],
) {
  if (!storageAvailable()) return;
  window.localStorage.setItem(
    getLocalTranscriptMarkersStorageKey(noteId),
    JSON.stringify(markers),
  );
}

export function createLocalTranscriptMarker(
  noteId: string,
  input: LocalCreateMarkerInput,
): LocalTranscriptMarker {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user_id: "",
    note_id: noteId,
    marker_kind: input.marker_kind,
    target_type: input.target_type,
    segment_idx: input.segment_idx ?? null,
    speaker_id: input.speaker_id ?? null,
    anchor_time: input.anchor_time ?? null,
    selection_start: input.selection_start ?? null,
    selection_end: input.selection_end ?? null,
    selection_text: input.selection_text ?? null,
    created_at: new Date().toISOString(),
  };
}
