import { useEffect, useState } from "react";
import { api } from "@shared/api";
import { logout, getCurrentUser } from "@shared/auth";
import { setTheme } from "@shared/theme";
import { getTheme } from "@shared/storage";
import { FolderPicker } from "./FolderPicker";
import { TagPicker } from "./TagPicker";
import type { Folder, Tag } from "@shared/types";
import type { VideoCapture } from "../../content/video-extractors/base";

interface Props {
  tabUrl: string;
  capture: VideoCapture;
  onOpenSettings: () => void;
}

type Status = "idle" | "saving" | "done" | "error";

export function VideoSaveView({ tabUrl: _tabUrl, capture, onOpenSettings }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [noteId, setNoteId] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">("system");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // 与 SaveView 一致：拉用户的 folders / tags 给选择器用
    api.getMeta()
      .then((meta) => {
        setFolders(meta.folders);
        setTags(meta.tags);
      })
      .catch(() => {});
    getTheme().then(setCurrentTheme);
    getCurrentUser().then((u) => setUserEmail(u?.email || ""));
  }, []);

  const handleThemeToggle = async () => {
    const next = currentTheme === "light" ? "dark" : currentTheme === "dark" ? "system" : "light";
    setCurrentTheme(next);
    await setTheme(next);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const handleSave = async () => {
    setStatus("saving");
    setError("");

    const organize = {
      folder_id: selectedFolderId || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    };

    try {
      if (capture.recommendedStrategy === "server") {
        // A path: server downloads the video
        const result = await api.saveVideo({ capture, ...organize });
        setNoteId(result.noteId);
        setStatus("done");
      } else {
        // B path: browser uploads directly, delegate to background service worker
        // Derive file extension from videoUrl
        const pickExt = (rawUrl: string, fallback: string) => {
          const p = new URL(rawUrl).pathname;
          return p.split(".").pop()?.split("?")[0] || fallback;
        };
        const ext = pickExt(capture.videoUrl, "mp4");
        const contentType = ext === "m3u8" ? "application/vnd.apple.mpegurl" : "video/mp4";

        // DASH 分轨：音频与视频独立流，请求时一并要 audio cred
        let audioExt: string | undefined;
        let audioContentType: string | undefined;
        if (capture.audioUrl) {
          audioExt = pickExt(capture.audioUrl, "m4s");
          audioContentType = "audio/mp4";
        }

        const cred = await api.requestUploadCred({
          capture,
          ext,
          contentType,
          audioExt,
          audioContentType,
          ...organize,
        });
        setNoteId(cred.noteId);

        // Hand off upload to background service worker so popup can close
        chrome.runtime.sendMessage({
          type: "video:browser-upload",
          capture,
          cred,
        });

        setStatus("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试");
      setStatus("error");
    }
  };

  const platformLabels: Record<string, string> = {
    bilibili: "哔哩哔哩",
    douyin: "抖音",
    kuaishou: "快手",
    weibo: "微博",
    "weixin-channel": "微信视频号",
  };

  const platformLabel = platformLabels[capture.platform] ?? capture.platform;

  if (status === "done") {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-4 min-h-[220px]">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-600 dark:text-green-400">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground mb-1">已加入笔记库</p>
          <p className="text-xs text-muted-foreground">视频正在后台处理中</p>
          {noteId && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">笔记 ID: {noteId}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground">NewsBox</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            title="设置"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={handleThemeToggle}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-sm transition-colors"
            title={`主题: ${currentTheme}`}
          >
            {currentTheme === "dark" ? "\u{1F319}" : currentTheme === "light" ? "\u{2600}\u{FE0F}" : "\u{1F4BB}"}
          </button>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            title={`${userEmail}\n点击登出`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video Preview Card */}
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden mb-4">
        {capture.meta.coverUrl && (
          <div className="h-[120px] overflow-hidden bg-secondary relative">
            <img
              src={capture.meta.coverUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Video play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          </div>
        )}
        <div className="p-3">
          <h2 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
            {capture.meta.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
              {platformLabel}
            </span>
            {capture.meta.authorName && (
              <span className="truncate">{capture.meta.authorName}</span>
            )}
            {capture.meta.durationSec != null && (
              <>
                <span>&middot;</span>
                <span>{formatDuration(capture.meta.durationSec)}</span>
              </>
            )}
            <span className="ml-auto text-[10px] opacity-60">
              {capture.recommendedStrategy === "server" ? "服务器下载" : "浏览器上传"}
            </span>
          </div>
        </div>
      </div>

      {/* Folder Picker */}
      <div className="mb-3">
        <FolderPicker
          folders={folders}
          selectedId={selectedFolderId}
          onChange={setSelectedFolderId}
        />
      </div>

      {/* Tag Picker */}
      <div className="mb-4">
        <TagPicker
          tags={tags}
          selectedIds={selectedTagIds}
          onChange={setSelectedTagIds}
        />
      </div>

      {/* Error */}
      {status === "error" && error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg mb-3">
          {error}
        </p>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium
                   hover:bg-primary/90 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all"
      >
        {status === "saving" ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            保存中...
          </span>
        ) : (
          "保存视频到 NewsBox"
        )}
      </button>

      <p className="text-[10px] text-center text-muted-foreground mt-3">
        视频将在后台处理，完成后可在笔记库中查看
      </p>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
