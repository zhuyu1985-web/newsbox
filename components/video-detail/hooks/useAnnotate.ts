"use client";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useVideoDetailStore } from "../store";

export interface AnnotatePayload {
  noteId: string;
  text: string;
  videoTime: number;
}

export function useAnnotate() {
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const editor = useVideoDetailStore((s) => s.notesEditor);

  return useCallback(
    async (payload: AnnotatePayload): Promise<boolean> => {
      if (!editor) {
        toast.error("编辑器未就绪");
        return false;
      }
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("请先登录");
          return false;
        }
        const { data, error } = await supabase
          .from("annotations")
          .insert({
            user_id: user.id,
            note_id: payload.noteId,
            content: payload.text,
            timecode: Math.round(payload.videoTime),
            is_floating: true,
          })
          .select("id")
          .single();
        if (error || !data) throw error;

        setActiveTab("notes");
        setTimeout(() => {
          editor.commands.focus("end");
          editor.commands.insertContent({
            type: "annotationReference",
            attrs: { annotationId: data.id },
          });
          editor.commands.createParagraphNear();

          requestAnimationFrame(() => {
            const nodes = document.querySelectorAll(
              '[data-type="annotation-reference"]',
            );
            const last = nodes[nodes.length - 1] as HTMLElement | null;
            if (last) {
              last.classList.add("animate-excerpt-pulse-once");
              setTimeout(
                () => last.classList.remove("animate-excerpt-pulse-once"),
                1500,
              );
            }
          });
        }, 50);

        toast.success("已标记并加入笔记");
        return true;
      } catch (e) {
        console.error("[useAnnotate] failed", e);
        toast.error("标记失败");
        return false;
      }
    },
    [editor, setActiveTab],
  );
}
