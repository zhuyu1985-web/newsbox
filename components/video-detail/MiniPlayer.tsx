"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, AudioLines } from "lucide-react";
import { useVideoDetailStore } from "./store";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVEFORM_BARS = 64;

/**
 * 生成一组确定性的"伪波形"高度（0-1）
 * 用 note id 当种子，不同视频展示形状不同但同一视频始终一致
 */
function makeWaveform(seed: string, count = WAVEFORM_BARS): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const r = (h & 0xffff) / 0xffff;
    // 让中段更高、两端低一些，看起来像真实波形
    const bias = Math.sin((i / count) * Math.PI);
    out.push(0.25 + r * 0.55 * (0.5 + bias * 0.5));
  }
  return out;
}

/**
 * MiniPlayer
 * - 视频滚出视口后底部出现的音频风格迷你播放器
 * - 波形进度条 + 跳过 ±15s + 播放/暂停 + 倍速
 * - 同时控制原 video.js 实例（通过 window 事件总线）
 */
export function MiniPlayer({
  title,
  duration,
  seed,
}: {
  title: string;
  duration: number;
  seed?: string;
}) {
  const visible = useVideoDetailStore((s) => s.miniPlayerVisible);
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const isPlaying = useVideoDetailStore((s) => s.isPlaying);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedBtnRef = useRef<HTMLButtonElement>(null);

  const waveform = useMemo(
    () => makeWaveform(seed ?? title ?? "default"),
    [seed, title],
  );

  // 点击外部关闭倍速菜单
  useEffect(() => {
    if (!speedOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!speedBtnRef.current?.contains(e.target as Node)) setSpeedOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [speedOpen]);

  if (!visible) return null;

  const togglePlay = () =>
    window.dispatchEvent(new CustomEvent("video:toggle-play"));

  const seek = (time: number) => {
    window.dispatchEvent(
      new CustomEvent("video:seek", {
        detail: { time: Math.max(0, Math.min(time, duration)), autoplay: "preserve" },
      }),
    );
  };

  const skipBack = () => seek(currentTime - 15);
  const skipForward = () => seek(currentTime + 15);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (duration > 0) seek(ratio * duration);
  };

  const applySpeed = (s: number) => {
    setSpeed(s);
    setSpeedOpen(false);
    window.dispatchEvent(
      new CustomEvent("video:set-rate", { detail: { rate: s } }),
    );
  };

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playedBars = Math.round((percent / 100) * WAVEFORM_BARS);

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-[56px] lg:right-[420px] 2xl:left-[64px] 2xl:right-[480px] h-20 bg-background/85 backdrop-blur-xl border-t border-border/50 z-40 flex items-center px-4 gap-4">
      {/* 跳过 -15s */}
      <button
        onClick={skipBack}
        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative"
        title="后退 15 秒"
      >
        <RotateCcw size={18} />
        <span className="absolute text-[8px] font-bold mt-0.5">15</span>
      </button>

      {/* 播放/暂停 */}
      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 shrink-0"
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
      </button>

      {/* 跳过 +15s */}
      <button
        onClick={skipForward}
        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative"
        title="快进 15 秒"
      >
        <RotateCw size={18} />
        <span className="absolute text-[8px] font-bold mt-0.5">15</span>
      </button>

      {/* 波形 + 时间 */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          onClick={handleWaveformClick}
          className="h-9 flex items-center gap-[2px] cursor-pointer select-none"
        >
          {waveform.map((h, i) => {
            const played = i <= playedBars;
            return (
              <div
                key={i}
                className={
                  played
                    ? "flex-1 rounded-full bg-blue-500 dark:bg-blue-400 transition-colors"
                    : "flex-1 rounded-full bg-muted-foreground/30 transition-colors"
                }
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 倍速 */}
      <div className="relative shrink-0">
        <button
          ref={speedBtnRef}
          onClick={() => setSpeedOpen((v) => !v)}
          className="px-2 h-7 rounded text-xs text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40"
        >
          倍速 {speed}x
        </button>
        {speedOpen && (
          <div className="absolute bottom-9 right-0 bg-popover border border-border rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => applySpeed(s)}
                className={
                  s === speed
                    ? "w-full text-left px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40"
                    : "w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
                }
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 音频标识 */}
      <button
        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 shrink-0"
        title="音频模式"
      >
        <AudioLines size={15} />
      </button>
    </div>
  );
}
