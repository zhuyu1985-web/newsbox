"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Video as VideoIcon,
} from "lucide-react";
import { useVideoDetailStore } from "../store";

/**
 * AudioStrip
 * - 音频模式下替代视频卡的「就地」音频条
 * - 仅 UI；播放控制全部走全局事件总线（VideoPlayer 实例仍在 DOM 里继续工作）
 * - 与 MiniPlayer 同款波形 + ±15s + 倍速，但在主区域而非 fixed 底部
 */

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVEFORM_BARS = 80;

function makeWaveform(seed: string, count = WAVEFORM_BARS): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const r = (h & 0xffff) / 0xffff;
    const bias = Math.sin((i / count) * Math.PI);
    out.push(0.25 + r * 0.55 * (0.5 + bias * 0.5));
  }
  return out;
}

export function AudioStrip({
  title,
  duration,
  seed,
}: {
  title: string;
  duration: number;
  seed?: string;
}) {
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const isPlaying = useVideoDetailStore((s) => s.isPlaying);
  const setAudioMode = useVideoDetailStore((s) => s.setAudioMode);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedBtnRef = useRef<HTMLButtonElement>(null);

  const waveform = useMemo(
    () => makeWaveform(seed ?? title ?? "default"),
    [seed, title],
  );

  useEffect(() => {
    if (!speedOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!speedBtnRef.current?.contains(e.target as Node)) setSpeedOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [speedOpen]);

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
    <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl p-5 flex items-center gap-4">
      <button
        onClick={skipBack}
        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative shrink-0"
        title="后退 15 秒"
      >
        <RotateCcw size={20} />
        <span className="absolute text-[8px] font-bold mt-0.5">15</span>
      </button>

      <button
        onClick={togglePlay}
        className="w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 shrink-0"
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
      </button>

      <button
        onClick={skipForward}
        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative shrink-0"
        title="快进 15 秒"
      >
        <RotateCw size={20} />
        <span className="absolute text-[8px] font-bold mt-0.5">15</span>
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          onClick={handleWaveformClick}
          className="h-12 flex items-center gap-[2px] cursor-pointer select-none"
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

      <div className="relative shrink-0">
        <button
          ref={speedBtnRef}
          onClick={() => setSpeedOpen((v) => !v)}
          className="px-2 h-8 rounded text-xs text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40"
        >
          倍速 {speed}x
        </button>
        {speedOpen && (
          <div className="absolute top-9 right-0 bg-popover border border-border rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
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

      <button
        onClick={() => setAudioMode(false)}
        className="w-9 h-9 rounded flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 shrink-0"
        title="切回视频模式"
      >
        <VideoIcon size={16} />
      </button>
    </div>
  );
}
