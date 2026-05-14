"use client";

import { Badge } from "@/components/ui/badge";

export interface FrameData {
  timestamp: number;
  url: string;
  sceneDescription?: string;
  entities?: string[];
  onScreenText?: string;
}

interface VisualFramesProps {
  frames: FrameData[];
  onSeek?: (time: number) => void;
}

export function VisualFrames({ frames, onSeek }: VisualFramesProps) {
  if (frames.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        画面理解暂不可用
      </div>
    );
  }

  const handleClick = (t: number) => {
    if (onSeek) {
      onSeek(t);
    } else {
      window.dispatchEvent(new CustomEvent("video:seek", { detail: { time: t } }));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {frames.map((f, i) => (
        <div
          key={i}
          className="space-y-1 cursor-pointer group"
          onClick={() => handleClick(f.timestamp)}
        >
          <div className="relative aspect-video rounded overflow-hidden bg-muted">
            <img
              src={f.url}
              alt=""
              className="w-full h-full object-cover group-hover:opacity-80 transition"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {Math.floor(f.timestamp / 60)}:{String(f.timestamp % 60).padStart(2, "0")}
            </div>
          </div>
          {f.sceneDescription && (
            <div className="text-xs line-clamp-2">{f.sceneDescription}</div>
          )}
          {f.entities && f.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {f.entities.slice(0, 5).map((e) => (
                <Badge key={e} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {e}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
