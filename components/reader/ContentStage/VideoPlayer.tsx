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
}

export function VideoPlayer({ note }: { note: Note }) {
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

  useEffect(() => {
    if (!note.media_url) return;

    // 判断是否为 direct video URL
    const isDirectVideo = 
      note.media_url.endsWith(".mp4") || 
      note.media_url.endsWith(".m3u8") || 
      note.media_url.includes("storage.googleapis.com") || // 常见存储
      note.media_url.includes("supabase.co/storage");    // 本项目存储

    if (isDirectVideo && videoRef.current) {
      setIsVideoJs(true);
      const videoElement = document.createElement("video-js");
      videoElement.classList.add("vjs-big-play-centered", "vjs-theme-city");
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{
          src: note.media_url,
          type: note.media_url.endsWith(".m3u8") ? "application/x-mpegURL" : "video/mp4"
        }],
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
          ]
        }
      }, () => {
        console.log("Player is ready");
      });

      player.on("play", () => setIsPlaying(true));
      player.on("pause", () => setIsPlaying(false));
      player.on("timeupdate", () => setCurrentTime(player.currentTime() ?? 0));
      player.on("loadedmetadata", () => setDuration(player.duration() ?? 0));

      const handleGlobalSeek = (e: any) => {
        const time = e.detail?.time;
        if (typeof time === "number") {
          player.currentTime(time);
          player.play();
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
    } else {
      setIsVideoJs(false);
    }
  }, [note.media_url]);

  const handleCapture = async () => {
    if (!playerRef.current || !isVideoJs) {
      toast.error("当前播放模式不支持截图");
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

  if (!note.media_url) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
        <p className="text-slate-400">暂无视频内容</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1000px] mx-auto py-8 px-4">
      <Card className="overflow-hidden bg-black border-none shadow-2xl rounded-2xl relative group">
        {isVideoJs ? (
          <div ref={videoRef} className="aspect-video" />
        ) : (
          <div className="aspect-video">
            <iframe
              src={note.media_url}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={note.title || "Video"}
            />
          </div>
        )}

        {/* 顶部悬浮控制栏 (仅在 video.js 模式显示) */}
        {isVideoJs && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-gradient-to-b from-black/60 to-transparent">
            <h2 className="text-white font-medium truncate max-w-[70%]">{note.title}</h2>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20 rounded-full h-9 w-9"
                onClick={handleCapture}
                title="截取当前帧"
              >
                <Camera className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20 rounded-full h-9 w-9"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* 底部功能提示 (当为 iframe 模式时) */}
        {!isVideoJs && (
          <div className="bg-slate-900/80 backdrop-blur-sm p-3 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              当前为嵌入播放模式。部分高级功能（如一键截帧、播放器内批注）仅支持直接视频链接。
            </p>
          </div>
        )}
      </Card>

      {/* 视频元信息 */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{note.title}</h1>
        <div className="flex items-center gap-4 text-sm text-slate-500">
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
              className="hover:text-blue-500 transition-colors underline underline-offset-4"
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
