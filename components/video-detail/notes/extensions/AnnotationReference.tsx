import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import useSWR from "swr";
import { Sparkles, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AnnotationRow {
  id: string;
  content: string;
  timecode: number | null;
  created_at: string;
  updated_at: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

const annotationFetcher = async (
  key: string,
): Promise<AnnotationRow | null> => {
  const id = key.split(":")[1];
  if (!id) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("annotations")
    .select("id, content, timecode, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as AnnotationRow | null) ?? null;
};

function AnnotationReferenceComponent({
  node,
  deleteNode,
}: ReactNodeViewProps) {
  const annotationId = node.attrs.annotationId as string | undefined;
  const { data, error, isLoading } = useSWR<AnnotationRow | null>(
    annotationId ? `annotation:${annotationId}` : null,
    annotationFetcher,
    { revalidateOnFocus: true },
  );

  const seek = (time: number) => {
    window.dispatchEvent(
      new CustomEvent("video:seek", {
        detail: { time, autoplay: "preserve" },
      }),
    );
  };

  if (!annotationId) {
    return (
      <NodeViewWrapper className="my-3">
        <div className="px-3 py-2 rounded border border-border/50 bg-muted/30 text-xs text-muted-foreground italic">
          无效引用
        </div>
      </NodeViewWrapper>
    );
  }

  if (isLoading) {
    return (
      <NodeViewWrapper className="my-3">
        <div className="px-3 py-2 rounded border border-border/50 bg-card/40 backdrop-blur-md text-xs text-muted-foreground">
          加载批注中…
        </div>
      </NodeViewWrapper>
    );
  }

  if (error || !data) {
    return (
      <NodeViewWrapper className="my-3">
        <div className="flex items-center justify-between px-3 py-2 rounded border border-border/50 bg-muted/30 text-xs text-muted-foreground italic">
          <span>该批注已删除</span>
          <button
            onClick={() => deleteNode()}
            className="text-rose-500 dark:text-rose-400 hover:underline"
          >
            移除引用
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-3">
      <div className="border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 pl-3 pr-2 py-2 rounded-r">
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 mb-1">
          <Sparkles size={12} />
          <span className="font-medium">标记</span>
          {typeof data.timecode === "number" && (
            <button
              type="button"
              onClick={() => seek(data.timecode!)}
              className="ml-1 font-mono hover:underline flex items-center gap-0.5"
            >
              <Clock size={10} />
              {formatTime(data.timecode)}
            </button>
          )}
          <span className="text-muted-foreground text-[10px] ml-auto">
            {new Date(data.updated_at).toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-foreground italic leading-relaxed">
          &ldquo;{data.content}&rdquo;
        </p>
      </div>
    </NodeViewWrapper>
  );
}

export const AnnotationReference = Node.create({
  name: "annotationReference",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      annotationId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="annotation-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "annotation-reference",
        "data-annotation-id": String(HTMLAttributes.annotationId ?? ""),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnnotationReferenceComponent);
  },
});
