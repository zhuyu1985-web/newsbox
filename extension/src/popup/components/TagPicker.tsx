import { useState, useRef, useEffect } from "react";
import type { Tag } from "@shared/types";

interface Props {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagPicker({ tags, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleTag = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id]
    );
  };

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setOpen(!open); if (open) setSearch(""); }}
        className="w-full flex items-center gap-2 min-h-[36px] px-3 rounded-xl
                   bg-secondary/50 border border-border text-sm
                   hover:bg-secondary transition-colors text-left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-muted-foreground shrink-0">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="7" cy="7" r="1" fill="currentColor"/>
        </svg>
        <span className="flex-1 flex flex-wrap gap-1">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-md
                           bg-primary/10 text-primary text-xs font-medium"
              >
                {tag.name}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">添加标签</span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 bottom-full mb-1 left-0 right-0
                        bg-card border border-border rounded-xl shadow-lg
                        max-h-[220px] overflow-hidden flex flex-col">
          {/* Tag list */}
          <div className="max-h-[150px] overflow-y-auto py-1 flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {search ? "未找到标签" : "暂无标签"}
              </p>
            ) : (
              filtered.map((tag) => {
                const selected = selectedIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm
                                hover:bg-secondary transition-colors text-left
                                ${selected ? "text-primary" : "text-foreground"}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                                      ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {tag.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    )}
                    <span className="flex-1 truncate">{tag.name}</span>
                  </button>
                );
              })
            )}
          </div>
          {/* Search */}
          <div className="p-2 border-t border-border">
            <input
              type="text"
              placeholder="搜索标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 rounded-lg bg-secondary/50 border-none
                         text-xs text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-1 focus:ring-ring/50"
              autoFocus
            />
          </div>
          {/* Confirm button */}
          <div className="px-2 pb-2">
            <button
              onClick={() => { setOpen(false); setSearch(""); }}
              className="w-full h-7 rounded-lg bg-primary text-primary-foreground text-xs font-medium
                         hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              确定{selectedIds.length > 0 ? `（已选 ${selectedIds.length} 个）` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
