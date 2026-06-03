"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, AudioLines, Video as VideoIcon } from "lucide-react";
import { useVideoDetailStore } from "./store";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVEFORM_BARS = 56;

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

/**
 * 顶部固定音频条 — 同时覆盖两种触发场景：
 *   1. audioMode = true：用户主动从 TopBar "折叠为音频" 按钮触发
 *   2. miniPlayerVisible = true：视频卡滚出视口
 *
 * 两种场景下样式/位置/进度条完全一致，避免出现"顶部一个 + 底部一个"的视觉割裂。
 * 控制全部走 window 事件总线（与原 VideoPlayer 实例联动）。
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
  const miniPlayerVisible = useVideoDetailStore((s) => s.miniPlayerVisible);
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const isPlaying = useVideoDetailStore((s) => s.isPlaying);
  const audioMode = useVideoDetailStore((s) => s.audioMode);
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

  const visible = audioMode || miniPlayerVisible;
  if (!visible) return null;

  const togglePlay = () => window.dispatchEvent(new CustomEvent("video:toggle-play"));

  const seek = (time: number) => {
    window.dispatchEvent(
      new CustomEvent("video:seek", {
        detail: { time: Math.max(0, Math.min(time, duration)), autoplay: "preserve" },
      }),
    );
  };

  const skipBack = () => seek(currentTime - 15);
  const skipForward = () => seek(currentTime + 15);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (duration > 0) seek(ratio * duration);
  };

  const applySpeed = (s: number) => {
    setSpeed(s);
    setSpeedOpen(false);
    window.dispatchEvent(new CustomEvent("video:set-rate", { detail: { rate: s } }));
  };

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playedBars = Math.round((percent / 100) * WAVEFORM_BARS);

  return (
    <div
      className="fixed top-14 left-0 right-0 lg:left-[56px] lg:right-[420px] 2xl:left-[64px] 2xl:right-[480px] z-40 bg-card/70 dark:bg-card/40 backdrop-blur-xl border-b border-border/50 shadow-sm"
    >
      {/* 细线性进度条 — 可点击 seek */}
      <div
        onClick={handleProgressClick}
        className="h-1 w-full bg-blue-100/40 dark:bg-blue-950/30 cursor-pointer group relative"
        title="点击跳转"
      >
        <div
          className="h-full bg-blue-500 dark:bg-blue-400 group-hover:bg-blue-600 dark:group-hover:bg-blue-300 transition-colors"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-background opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${percent}% - 5px)` }}
        />
      </div>

      <div className="h-16 flex items-center px-4 gap-3">
        {/* ±15s + 播放 */}
        <button
          onClick={skipBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative shrink-0"
          title="后退 15 秒"
        >
          <RotateCcw size={18} />
          <span className="absolute text-[8px] font-bold mt-0.5">15</span>
        </button>

        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 shrink-0"
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
        </button>

        <button
          onClick={skipForward}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 relative shrink-0"
          title="快进 15 秒"
        >
          <RotateCw size={18} />
          <span className="absolute text-[8px] font-bold mt-0.5">15</span>
        </button>

        {/* 波形装饰 + 时间 */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="h-7 flex items-center gap-[2px] select-none">
            {waveform.map((h, i) => {
              const played = i <= playedBars;
              return (
                <div
                  key={i}
                  className={
                    played
                      ? "flex-1 rounded-full bg-blue-500/85 dark:bg-blue-400/80 transition-colors"
                      : "flex-1 rounded-full bg-blue-300/30 dark:bg-blue-300/15 transition-colors"
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

        {/* 音频 / 视频模式切换 */}
        <button
          onClick={() => setAudioMode(!audioMode)}
          className={
            audioMode
              ? "w-7 h-7 rounded bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"
              : "w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40 shrink-0"
          }
          title={audioMode ? "切回视频模式" : "切到音频模式"}
        >
          {audioMode ? <VideoIcon size={15} /> : <AudioLines size={15} />}
        </button>
      </div>
    </div>
  );
}
