"use client";
import { useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";

export type MarkerKind = "important" | "question" | "todo";
export type MarkerTarget = "transcript" | "qa" | "speaker";

export interface Marker {
  id: string;
  user_id: string;
  note_id: string;
  marker_kind: MarkerKind;
  target_type: MarkerTarget;
  segment_idx: number | null;
  speaker_id: string | null;
  anchor_time: number | null;
  selection_start: number | null;
  selection_end: number | null;
  selection_text: string | null;
  created_at: string;
}

export interface CreateMarkerInput {
  marker_kind: MarkerKind;
  target_type: MarkerTarget;
  segment_idx?: number;
  speaker_id?: string;
  anchor_time?: number;
  selection_start?: number;
  selection_end?: number;
  selection_text?: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("failed");
    return r.json() as Promise<{ markers: Marker[] }>;
  });

export function useMarkers(noteId: string) {
  const key = noteId ? `/api/notes/${noteId}/markers` : null;
  const { data, mutate, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
  const markers = data?.markers ?? [];

  const createMarker = useCallback(
    async (input: CreateMarkerInput) => {
      if (!noteId) return null;
      // Optimistic：先把临时 marker 加进去再请求
      const tempId = `temp-${Date.now()}`;
      const optimistic: Marker = {
        id: tempId,
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
      mutate({ markers: [...markers, optimistic] }, { revalidate: false });

      try {
        const res = await fetch(`/api/notes/${noteId}/markers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "标记失败");
        }
        const json = (await res.json()) as { marker: Marker };
        // 用真实结果替换临时
        mutate(
          { markers: [...markers.filter((m) => m.id !== tempId), json.marker] },
          { revalidate: false },
        );
        return json.marker;
      } catch (err) {
        // 回滚
        mutate({ markers }, { revalidate: false });
        toast.error(err instanceof Error ? err.message : "标记失败");
        return null;
      }
    },
    [noteId, markers, mutate],
  );

  const deleteMarker = useCallback(
    async (markerId: string) => {
      if (!noteId) return false;
      const prev = markers;
      mutate({ markers: markers.filter((m) => m.id !== markerId) }, { revalidate: false });
      try {
        const res = await fetch(`/api/notes/${noteId}/markers/${markerId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("删除失败");
        return true;
      } catch (err) {
        mutate({ markers: prev }, { revalidate: false });
        toast.error(err instanceof Error ? err.message : "删除失败");
        return false;
      }
    },
    [noteId, markers, mutate],
  );

  /** 删除某锚点（targetType + idx [+ speakerId]）上的所有 marker（取消标记） */
  const clearMarkers = useCallback(
    async (params: {
      target_type: MarkerTarget;
      segment_idx?: number;
      speaker_id?: string;
    }) => {
      const matched = markers.filter(
        (m) =>
          m.target_type === params.target_type &&
          m.segment_idx === (params.segment_idx ?? null) &&
          m.speaker_id === (params.speaker_id ?? null) &&
          // 仅清整段标记，不动选段标记
          m.selection_start == null,
      );
      if (matched.length === 0) return;
      // 并行删除
      await Promise.all(matched.map((m) => deleteMarker(m.id)));
    },
    [markers, deleteMarker],
  );

  return {
    markers,
    isLoading,
    error,
    refetch: mutate,
    createMarker,
    deleteMarker,
    clearMarkers,
  };
}
