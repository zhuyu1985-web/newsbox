import { useState, useEffect } from "react";
import { api } from "@shared/api";
import { logout, getCurrentUser } from "@shared/auth";
import { setTheme, getSystemTheme } from "@shared/theme";
import { getTheme } from "@shared/storage";
import { FolderPicker } from "./FolderPicker";
import { TagPicker } from "./TagPicker";
import type { ExtractedContent, Folder, Tag } from "@shared/types";

interface Props {
  onSuccess: (noteId: string) => void;
  onOpenSettings: () => void;
}

export function SaveView({ onSuccess, onOpenSettings }: Props) {
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">("system");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Load theme preference
    getTheme().then(setCurrentTheme);
    // Load user info
    getCurrentUser().then((u) => setUserEmail(u?.email || ""));
    // Extract content from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setError("无法获取当前标签页");
        setLoading(false);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONTENT" }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          // Content script might not be loaded, try injecting
          setError("无法提取页面内容，请刷新页面后重试");
          setLoading(false);
          return;
        }
        setContent(response.data);
        setLoading(false);
      });
    });
    // Load folders and tags
    api.getMeta().then((meta) => {
      setFolders(meta.folders);
      setTags(meta.tags);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.saveNote({
        source_url: content.url,
        title: content.title,
        excerpt: content.excerpt,
        content_html: content.contentHtml,
        content_text: content.contentText,
        cover_image_url: content.coverImageUrl || undefined,
        author: content.author || undefined,
        site_name: content.siteName || undefined,
        published_at: content.publishedAt || undefined,
        content_type: content.contentType,
        folder_id: selectedFolderId || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      onSuccess(result.noteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeToggle = async () => {
    const next = currentTheme === "light" ? "dark" : currentTheme === "dark" ? "system" : "light";
    setCurrentTheme(next);
    await setTheme(next);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[250px] gap-3">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">正在提取页面内容...</p>
      </div>
    );
  }

  const themeIcon = currentTheme === "dark" ? "\u{1F319}" : currentTheme === "light" ? "\u{2600}\u{FE0F}" : "\u{1F4BB}";

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={handleThemeToggle}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-sm transition-colors"
            title={`主题: ${currentTheme}`}
          >
            {themeIcon}
          </button>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            title={`${userEmail}\n点击登出`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content Preview */}
      {content && (
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden mb-4">
          {content.coverImageUrl && (
            <div className="h-[120px] overflow-hidden bg-secondary">
              <img
                src={content.coverImageUrl}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <div className="p-3">
            <h2 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
              {content.title}
            </h2>
            {content.excerpt && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {content.excerpt}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {content.siteName && <span>{content.siteName}</span>}
              {content.siteName && content.author && <span>&middot;</span>}
              {content.author && <span>{content.author}</span>}
              {content.contentType === "video" && (
                <span className="ml-auto px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  视频
                </span>
              )}
            </div>
          </div>
        </div>
      )}

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
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg mb-3">
          {error}
        </p>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !content}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium
                   hover:bg-primary/90 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            保存中...
          </span>
        ) : "保存到 NewsBox"}
      </button>

      {/* Shortcut hint */}
      <p className="text-[10px] text-center text-muted-foreground mt-3">
        快捷键: Ctrl+Shift+S (Mac: ⌘⇧S)
      </p>
    </div>
  );
}
