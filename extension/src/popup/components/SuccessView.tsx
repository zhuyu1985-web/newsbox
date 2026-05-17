import { useEffect } from "react";
import { NEWSBOX_API_URL } from "@shared/constants";

interface Props {
  noteId: string;
  onSaveAnother: () => void;
}

export function SuccessView({ noteId, onSaveAnother }: Props) {
  useEffect(() => {
    // Auto-close popup after 3 seconds
    const timer = setTimeout(() => window.close(), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleViewNote = () => {
    chrome.tabs.create({ url: `${NEWSBOX_API_URL}/notes/${noteId}` });
    window.close();
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[250px]">
      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4
                      animate-[scale-in_0.3s_ease-out]">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-green-500">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 className="text-base font-semibold text-foreground mb-1">
        已保存到 NewsBox
      </h2>
      <p className="text-xs text-muted-foreground mb-6">
        3 秒后自动关闭
      </p>

      <div className="flex gap-2 w-full max-w-[240px]">
        <button
          onClick={handleViewNote}
          className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium
                     hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          查看笔记
        </button>
        <button
          onClick={onSaveAnother}
          className="flex-1 h-9 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium
                     hover:bg-secondary/80 active:scale-[0.98] transition-all"
        >
          继续保存
        </button>
      </div>
    </div>
  );
}
