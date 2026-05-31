"use client";

import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

type VideoJsPlayer = ReturnType<typeof videojs>;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  Maximize, 
  Settings, 
  RotateCcw, 
  FastForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipForward
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnnotationDialog } from "../AnnotationDialog";

interface Note {
  id: string;
  title: string | null;
  media_url: string | null;
  media_duration: number | null;
  // 视频流水线可能产生 HEVC → H.264 转码版本，浏览器只能播放 H.264
  video_job?: {
    id?: string;
    transcoded_url: string | null;
    cos_url: string | null;
    transcode_status?: string;
    download_status?: string;
    probe_status?: string;
    audio_status?: string;
    visual_status?: string;
  } | null;
}

export function VideoPlayer({ note, embedded = false }: { note: Note; embedded?: boolean }) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoJsPlayer | null>(null);
  const [isVideoJs, setIsVideoJs] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [currentCapture, setCurrentCapture] = useState<{ time: number; dataUrl: string } | null>(null);
  const [playbackError, setPlaybackError] = useState<{ code?: number; message?: string } | null>(null);

  // 浏览器播放优先级：转码后的 H.264 → COS 原文件 → 来源 media_url
  // 注：原 media_url 可能是 HEVC（iOS 默认编码），Chrome/Firefox 不支持 → 触发下载行为
  const playableUrl =
    note.video_job?.transcoded_url ||
    note.video_job?.cos_url ||
    note.media_url;

  useEffect(() => {
    if (!playableUrl || !videoRef.current) return;

    // 抓取下来的视频一律走 Video.js 播放
    // 即便扩展名不在白名单里也尝试播放：Video.js 自带格式错误 UI，比 iframe / "去原始链接" 体验好
    setIsVideoJs(true);
    const videoElement = document.createElement("video-js");
    videoElement.classList.add("vjs-big-play-centered", "vjs-theme-city");
    videoRef.current.appendChild(videoElement);

    // 通过 pathname 判断 HLS（避免被签名 URL 的 query string 干扰）
    let isHls = false;
    try {
      const pathname = new URL(playableUrl).pathname.toLowerCase();
      isHls = pathname.endsWith(".m3u8");
    } catch {
      isHls = /\.m3u8($|\?)/i.test(playableUrl);
    }

    const player = (playerRef.current = videojs(
      videoElement,
      {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: true,
        preload: "metadata",
        // 注：不设 crossOrigin。设了会让浏览器 send CORS preflight，
        // COS 若没配 CORS 头会直接 fail。截图功能在跨域时会 taint canvas，
        // 这是已知 trade-off：要截图请在 COS 配 Access-Control-Allow-Origin。
        sources: [
          {
            src: playableUrl,
            type: isHls ? "application/x-mpegURL" : "video/mp4",
          },
        ],
        playbackRates: [0.5, 1, 1.5, 2],
        controlBar: {
          children: [
            "playToggle",
            "progressControl",
            "currentTimeDisplay",
            "timeDivider",
            "durationDisplay",
            "volumePanel",
            "playbackRateMenuButton",
            "fullscreenToggle",
          ],
        },
      },
      () => {
        console.log("Player is ready");
      }
    ));

    player.on("play", () => {
      setIsPlaying(true);
      window.dispatchEvent(
        new CustomEvent("video:state", { detail: { paused: false } })
      );
    });
    player.on("pause", () => {
      setIsPlaying(false);
      window.dispatchEvent(
        new CustomEvent("video:state", { detail: { paused: true } })
      );
    });

    // timeupdate：本地 state 立即同步；window 事件做 250ms 节流，避免每帧广播
    let lastTimeupdateDispatch = 0;
    player.on("timeupdate", () => {
      const time = player.currentTime() ?? 0;
      setCurrentTime(time);
      const now = Date.now();
      if (now - lastTimeupdateDispatch < 250) return;
      lastTimeupdateDispatch = now;
      window.dispatchEvent(
        new CustomEvent("video:timeupdate", { detail: { time } })
      );
    });

    player.on("loadedmetadata", () => setDuration(player.duration() ?? 0));
    player.on("error", () => {
      const err = player.error();
      console.error("[VideoPlayer] playback error", {
        code: err?.code,
        message: err?.message,
        src: playableUrl,
      });
      setPlaybackError({ code: err?.code, message: err?.message });
    });
    player.on("loadstart", () => setPlaybackError(null));

    // 统一事件契约：video:seek 支持 autoplay 模式
    //   - preserve（默认）：跳转后保持原播放状态（在播继续播，暂停仍暂停）
    //   - force：跳转后强制开始播放
    //   - none：跳转后强制暂停
    const handleGlobalSeek = (e: Event) => {
      const ce = e as CustomEvent<{
        time: number;
        autoplay?: "preserve" | "force" | "none";
      }>;
      const time = ce.detail?.time;
      if (typeof time !== "number") return;
      const wasPaused = player.paused();
      player.currentTime(time);
      const mode = ce.detail?.autoplay ?? "preserve";
      if (mode === "force" || (mode === "preserve" && !wasPaused)) {
        player.play();
      } else if (mode === "none" && !wasPaused) {
        player.pause();
      }
    };

    window.addEventListener("video:seek", handleGlobalSeek);

    return () => {
      window.removeEventListener("video:seek", handleGlobalSeek);
      if (player) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playableUrl]);

  // video:toggle-play：来自外部 mini player 等的播放/暂停切换请求
  useEffect(() => {
    const handler = () => {
      const p = playerRef.current;
      if (!p) return;
      if (p.paused()) {
        p.play();
      } else {
        p.pause();
      }
    };
    window.addEventListener("video:toggle-play", handler);
    return () => window.removeEventListener("video:toggle-play", handler);
  }, []);

  const handleCapture = async () => {
    if (!playerRef.current) {
      toast.error("播放器尚未就绪");
      return;
    }

    try {
      const video = videoRef.current?.querySelector("video");
      if (!video) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL("image/jpeg");
      
      setCurrentCapture({
        time: Math.floor(currentTime),
        dataUrl
      });
      setIsAnnotationOpen(true);
      
      // 触发事件，方便批注系统获取截图
      window.dispatchEvent(new CustomEvent("video:capture", {
        detail: {
          noteId: note.id,
          timecode: Math.floor(currentTime),
          dataUrl
        }
      }));
    } catch (error) {
      console.error("Capture failed:", error);
      toast.error("截图失败");
    }
  };

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      const current = playerRef.current.currentTime() ?? 0;
      const newTime = current + seconds;
      playerRef.current.currentTime(Math.max(0, Math.min(newTime, duration)));
    }
  };

  if (!playableUrl) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-2xl border-2 border-dashed border-border">
        <p className="text-muted-foreground/70">暂无视频内容</p>
      </div>
    );
  }

  // 转码尚未完成提示（HEVC 原片浏览器无法播放）
  const transcodeStatus = note.video_job?.transcode_status;
  const stillTranscoding =
    transcodeStatus &&
    transcodeStatus !== "completed" &&
    transcodeStatus !== "skipped" &&
    !note.video_job?.transcoded_url;

  return (
    <div
      className={embedded ? "w-full mx-auto" : "w-full max-w-[1000px] mx-auto py-8 px-4"}
      style={embedded ? { maxWidth: "min(100%, calc(60vh * 16 / 9))" } : undefined}
    >
      <Card className="overflow-hidden bg-black border-none shadow-2xl rounded-2xl relative group">
        {/* 始终用 Video.js 播放（错误由 Video.js 自身的 UI 展示） */}
        <div ref={videoRef} className="aspect-video" />

        {/* 转码进行中覆盖层：用 video_jobs.transcode_status 判定，覆盖在播放器上方 */}
        {stillTranscoding && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/85 text-slate-100 text-sm font-medium backdrop-blur-sm">
            <div className="text-center px-6">
              <div className="mb-2 text-base font-semibold">视频转码中</div>
              <div className="text-slate-300 text-xs leading-relaxed">
                原视频编码（HEVC）浏览器不支持，正在后台转为 H.264。<br />
                稍后刷新即可在线播放。
              </div>
            </div>
          </div>
        )}

        {/* 播放失败诊断面板 */}
        {playbackError && !stillTranscoding && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 text-slate-100 backdrop-blur-sm overflow-y-auto py-6">
            <div className="max-w-md px-6">
              <div className="mb-3 text-base font-semibold text-center">视频无法播放</div>
              <div className="text-xs text-slate-300 space-y-1.5 mb-4">
                <div>错误：<code className="font-mono">code={playbackError.code}</code></div>
                {note.video_job?.id ? (
                  <>
                    <div className="pt-1 text-slate-400">流水线状态：</div>
                    <ul className="font-mono text-[10px] space-y-0.5 pl-3 text-slate-300">
                      <li>download · {note.video_job.download_status ?? "—"}</li>
                      <li>probe · {note.video_job.probe_status ?? "—"}</li>
                      <li>transcode · {note.video_job.transcode_status ?? "—"}</li>
                      <li>audio · {note.video_job.audio_status ?? "—"}</li>
                      <li>visual · {note.video_job.visual_status ?? "—"}</li>
                    </ul>
                  </>
                ) : (
                  <div className="pt-1 px-2 py-1.5 rounded-md bg-amber-500/10 text-amber-200 text-[11px] leading-relaxed">
                    此视频<b>没有处理记录</b>（video_job 缺失）。文件已在 COS 上，但从未进入转码流水线。
                    点下方「提交转码任务」即可补建。
                  </div>
                )}
                <div className="pt-1 text-slate-400">当前 URL：</div>
                <div className="font-mono break-all text-[10px] text-slate-300 bg-black/40 p-2 rounded-md">
                  {playableUrl}
                </div>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {note.video_job?.id ? (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/ai/video/${note.video_job!.id}/retry`, {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "重试失败");
                        toast.success("已重新提交处理，请稍候刷新页面");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "重试失败");
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md transition-colors font-medium"
                  >
                    重新处理视频
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/ai/video/note/${note.id}/init-pipeline`, {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "补建失败");
                        toast.success(
                          data.mode === "created"
                            ? "已补建流水线，请稍候刷新页面"
                            : "已重置流水线，请稍候刷新页面"
                        );
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "补建失败");
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md transition-colors font-medium"
                  >
                    提交转码任务
                  </button>
                )}
                {playableUrl && (
                  <a
                    href={playableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                  >
                    新窗口打开
                  </a>
                )}
              </div>
              <div className="mt-4 text-[10px] text-slate-500 leading-relaxed">
                若 transcode = pending / 空 → 服务端转码未完成；done / skipped 仍失败 → 检查 COS Content-Type 或文件本身。
              </div>
            </div>
          </div>
        )}

        {/* 顶部悬浮控制栏 */}
        {!stillTranscoding && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-gradient-to-b from-black/60 to-transparent">
            <h2 className="text-white font-medium truncate max-w-[70%]">{note.title}</h2>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-card/20 rounded-full h-9 w-9"
                onClick={handleCapture}
                title="截取当前帧"
              >
                <Camera className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-card/20 rounded-full h-9 w-9"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

      </Card>

      {/* 视频元信息 */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold text-card-foreground mb-2">{note.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {note.media_duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Math.floor(note.media_duration / 60)}:{(note.media_duration % 60).toString().padStart(2, '0')}
            </span>
          )}
          {note.media_url && (
            <a
              href={note.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors underline underline-offset-4 dark:hover:text-blue-400"
            >
              原始链接
            </a>
          )}
        </div>
      </div>

      <AnnotationDialog
        open={isAnnotationOpen}
        onOpenChange={setIsAnnotationOpen}
        noteId={note.id}
        selectedText={`视频时间点: ${Math.floor((currentCapture?.time || 0) / 60)}:${((currentCapture?.time || 0) % 60).toString().padStart(2, '0')}`}
        timecode={currentCapture?.time}
        screenshotUrl={currentCapture?.dataUrl}
        onSuccess={() => {
          setCurrentCapture(null);
          toast.success("视频批注已保存");
        }}
      />
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
