import { useState, useRef, useEffect } from "react";
import type { Folder } from "@shared/types";

interface Props {
  folders: Folder[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function FolderPicker({ folders, selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedFolder = folders.find((f) => f.id === selectedId);

  const topLevel = folders.filter((f) => !f.parent_id);
  const getChildren = (parentId: string) => folders.filter((f) => f.parent_id === parentId);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-xl
                   bg-secondary/50 border border-border text-sm
                   hover:bg-secondary transition-colors text-left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-muted-foreground shrink-0">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="flex-1 truncate text-foreground">
          {selectedFolder ? (
            <span>{selectedFolder.icon ? `${selectedFolder.icon} ` : ""}{selectedFolder.name}</span>
          ) : (
            <span className="text-muted-foreground">未分类</span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 bottom-full mb-1 left-0 right-0
                        bg-card border border-border rounded-xl shadow-lg
                        max-h-[180px] overflow-y-auto py-1">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors
                        ${!selectedId ? "text-primary font-medium" : "text-foreground"}`}
          >
            未分类
          </button>
          {topLevel.map((folder) => (
            <div key={folder.id}>
              <button
                onClick={() => { onChange(folder.id); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors
                            ${selectedId === folder.id ? "text-primary font-medium" : "text-foreground"}`}
              >
                {folder.icon ? `${folder.icon} ` : "\u{1F4C1} "}{folder.name}
              </button>
              {getChildren(folder.id).map((child) => (
                <button
                  key={child.id}
                  onClick={() => { onChange(child.id); setOpen(false); }}
                  className={`w-full text-left pl-8 pr-3 py-1.5 text-sm hover:bg-secondary transition-colors
                              ${selectedId === child.id ? "text-primary font-medium" : "text-foreground"}`}
                >
                  {child.icon ? `${child.icon} ` : ""}{child.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
