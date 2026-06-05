import { describe, expect, it } from "vitest";
import {
  getLocalTranscriptMarkersStorageKey,
  parseLocalTranscriptMarkers,
  createLocalTranscriptMarker,
} from "@/lib/notes/local-transcript-markers";

describe("local transcript markers", () => {
  it("uses a note-scoped storage key", () => {
    expect(getLocalTranscriptMarkersStorageKey("note-1")).toBe(
      "newsbox:local-transcript-markers:note-1",
    );
  });

  it("parses only markers for the current note", () => {
    const raw = JSON.stringify([
      { id: "m1", note_id: "note-1", marker_kind: "important", target_type: "transcript" },
      { id: "m2", note_id: "note-2", marker_kind: "todo", target_type: "transcript" },
      { id: 123, note_id: "note-1", marker_kind: "question", target_type: "transcript" },
    ]);

    expect(parseLocalTranscriptMarkers(raw, "note-1")).toEqual([
      { id: "m1", note_id: "note-1", marker_kind: "important", target_type: "transcript" },
    ]);
  });

  it("builds a marker compatible with the transcript marker shape", () => {
    const marker = createLocalTranscriptMarker("note-1", {
      marker_kind: "question",
      target_type: "transcript",
      segment_idx: 2,
      anchor_time: 12.5,
    });

    expect(marker).toMatchObject({
      user_id: "",
      note_id: "note-1",
      marker_kind: "question",
      target_type: "transcript",
      segment_idx: 2,
      anchor_time: 12.5,
      selection_start: null,
      selection_end: null,
    });
    expect(marker.id).toMatch(/^local-/);
  });
});
