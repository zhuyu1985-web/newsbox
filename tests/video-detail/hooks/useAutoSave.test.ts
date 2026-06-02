// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const supabaseUpdate = vi.fn();
const supabaseUpdateEq = vi.fn();
const supabaseSelectSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: (...args: any[]) => {
        supabaseUpdate(...args);
        return { eq: supabaseUpdateEq };
      },
      select: (..._args: any[]) => ({
        eq: () => ({
          single: () => supabaseSelectSingle(),
        }),
      }),
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
    commands: { setContent: vi.fn() },
    _triggerUpdate: () => updateCallback?.(),
  } as any;
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    supabaseUpdate.mockReset();
    supabaseUpdateEq.mockReset();
    supabaseUpdateEq.mockResolvedValue({ error: null });
    supabaseSelectSingle.mockReset();
    // 默认远端没有更新，允许保存通过
    supabaseSelectSingle.mockResolvedValue({
      data: { user_notes_updated_at: null, user_notes: null },
      error: null,
    });
  });

  it("debounces save by 1500ms then writes to supabase", async () => {
    const editor = makeMockEditor();
    const { result } = renderHook(() => useAutoSave("note-1", editor));

    expect(result.current.state).toBe("idle");

    // Trigger an edit
    act(() => editor._triggerUpdate());
    expect(result.current.state).toBe("idle");
    expect(supabaseUpdateEq).not.toHaveBeenCalled();

    // Advance time past debounce — fire the debounced persist call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(supabaseUpdateEq).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("saved");
  });

  it("reports char count from editor", () => {
    const editor = makeMockEditor();
    const { result } = renderHook(() => useAutoSave("note-1", editor));
    expect(result.current.charCount).toBe(42);
  });

  it("detects conflict when remote user_notes_updated_at is newer than initialUpdatedAt", async () => {
    const editor = makeMockEditor();
    const base = "2025-01-01T00:00:00.000Z";
    const remoteNewer = "2025-06-01T00:00:00.000Z";
    supabaseSelectSingle.mockResolvedValue({
      data: {
        user_notes_updated_at: remoteNewer,
        user_notes: { type: "doc", content: [{ type: "paragraph" }] },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useAutoSave("note-1", editor, base),
    );

    // 触发编辑 → 1.5s 后会跑 persist → 检测到远端更新 → 进入 conflict
    act(() => editor._triggerUpdate());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.state).toBe("conflict");
    expect(result.current.conflict?.remoteUpdatedAt).toBe(remoteNewer);
    // 冲突时不应该执行 update
    expect(supabaseUpdateEq).not.toHaveBeenCalled();
  });
});
