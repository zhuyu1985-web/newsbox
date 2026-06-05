import { describe, expect, it } from "vitest";
import {
  isTranscriptMarkersTableMissing,
  TRANSCRIPT_MARKERS_UNAVAILABLE_MESSAGE,
} from "@/lib/notes/marker-errors";

describe("marker database errors", () => {
  it("detects the missing transcript_markers schema-cache error", () => {
    expect(
      isTranscriptMarkersTableMissing({
        code: "PGRST205",
        message:
          "Could not find the table 'public.transcript_markers' in the schema cache",
      }),
    ).toBe(true);
  });

  it("detects missing transcript_markers relation errors", () => {
    expect(
      isTranscriptMarkersTableMissing({
        code: "42P01",
        message: 'relation "public.transcript_markers" does not exist',
      }),
    ).toBe(true);
  });

  it("does not treat unrelated database errors as feature unavailability", () => {
    expect(
      isTranscriptMarkersTableMissing({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe(false);
  });

  it("uses user-facing Chinese copy for unavailable marker actions", () => {
    expect(TRANSCRIPT_MARKERS_UNAVAILABLE_MESSAGE).toBe(
      "标记功能暂未启用，请先完成数据库迁移",
    );
  });
});
