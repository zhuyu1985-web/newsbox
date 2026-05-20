const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

function toPlainText(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value.map(toPlainText).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(toPlainText)
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export function estimateTokenCount(text: string): number {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return 0;

  const cjkCount = compact.match(CJK_RE)?.length ?? 0;
  const nonCjkText = compact.replace(CJK_RE, "");
  const nonCjkChars = nonCjkText.replace(/\s+/g, "").length;

  return Math.max(1, Math.ceil(cjkCount * 1.1 + nonCjkChars / 4));
}

export function estimateTokensFromPayload(payload: unknown): number {
  return estimateTokenCount(toPlainText(payload));
}
