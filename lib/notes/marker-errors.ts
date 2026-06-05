export const TRANSCRIPT_MARKERS_UNAVAILABLE_MESSAGE =
  "标记功能暂未启用，请先完成数据库迁移";

type MarkerDatabaseError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

export function isTranscriptMarkersTableMissing(error: MarkerDatabaseError | null | undefined) {
  if (!error) return false;

  const code = String(error.code ?? "").toUpperCase();
  const text = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");

  if (!text.includes("transcript_markers")) return false;
  if (code === "PGRST205" || code === "42P01") return true;

  return (
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}
