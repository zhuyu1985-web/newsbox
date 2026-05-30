"use client";

import { useVideoDetailStore } from "./store";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

/**
 * MiniPlayer
 * - 视频滚出视口后底部出现的迷你播放控制条
 * - 通过 window 'video:toggle-play' 事件控制 VideoPlayer 的播放/暂停
 * - 位置：fixed 在底部，避开左侧 64px 工具栏与右侧 480px 面板
 */
export function MiniPlayer({
  title,
  duration,
}: {
  title: string;
  duration: number;
}) {
  const visible = useVideoDetailStore((s) => s.miniPlayerVisible);
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const isPlaying = useVideoDetailStore((s) => s.isPlaying);

  if (!visible) return null;

  const togglePlay = () => {
    window.dispatchEvent(new CustomEvent("video:toggle-play"));
  };
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-[64px] right-[480px] h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 flex items-center gap-3 z-40">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700"
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <div className="text-xs min-w-0 flex-shrink-0">
        <div className="font-medium truncate max-w-[200px]">{title}</div>
        <div className="text-slate-400 text-[10px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
