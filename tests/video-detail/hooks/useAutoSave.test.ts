// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const supabaseUpdate = vi.fn();
const supabaseEq = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: (...args: any[]) => {
        supabaseUpdate(...args);
        return { eq: supabaseEq };
      },
    }),
  }),
}));

import { useAutoSave } from "@/components/video-detail/hooks/useAutoSave";

function makeMockEditor() {
  let updateCallback: (() => void) | null = null;
  return {
    on: vi.fn((event: string, cb: () => void) => {
      if (event === "update") updateCallback = cb;
    }),
    off: vi.fn(),
    getJSON: () => ({ type: "doc", content: [] }),
    storage: { characterCount: { characters: () => 42 } },
    _triggerUpdate: () => updateCallback?.(),
  } as any;
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    supabaseUpdate.mockReset();
    supabaseEq.mockReset();
    supabaseEq.mockResolvedValue({ error: null });
  });

  it("debounces save by 1500ms then writes to supabase", async () => {
    const editor = makeMockEditor();
    const { result } = renderHook(() => useAutoSave("note-1", editor));

    expect(result.current.state).toBe("idle");

    // Trigger an edit
    act(() => editor._triggerUpdate());
    expect(result.current.state).toBe("idle");
    expect(supabaseEq).not.toHaveBeenCalled();

    // Advance time past debounce — fire the debounced persist call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(supabaseEq).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("saved");
  });

  it("reports char count from editor", () => {
    const editor = makeMockEditor();
    const { result } = renderHook(() => useAutoSave("note-1", editor));
    expect(result.current.charCount).toBe(42);
  });
});
