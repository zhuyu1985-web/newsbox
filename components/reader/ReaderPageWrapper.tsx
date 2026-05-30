"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ReaderLayout } from "./ReaderLayout";
import { ReaderSkeleton } from "./ReaderSkeleton";
import { VideoDetailLayout } from "@/components/video-detail/VideoDetailLayout";
import { addBrowseHistoryEntry } from "@/lib/browse-history";
import { motion, AnimatePresence } from "framer-motion";
import type { AudioAnalysisResult, VisualFrameAnalysis } from "@/lib/ai-analysis/types";

export interface VideoJobRow {
  id: string;
  audio_result: AudioAnalysisResult | null;
  visual_result: VisualFrameAnalysis[] | null;
  frames: Array<{ timestamp: number; key: string; url: string }> | null;
  cover_url: string | null;
  cos_url: string | null;
  transcoded_url: string | null;
  download_status: string;
  audio_status: string;
  visual_status: string;
  transcode_status: string;
}

export interface Note {
  id: string;
  source_url: string;
  content_type: "article" | "video" | "audio";
  title: string | null;
  author: string | null;
  site_name: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  content_html: string | null;
  content_text: string | null;
  media_url: string | null;
  media_duration: number | null;
  status: "unread" | "reading" | "archived";
  created_at: string | null;
  published_at: string | null;
  reading_position?: number;
  read_percentage?: number;
  estimated_read_time?: number;
  reader_preferences?: any;
  folder_id?: string | null;
  deleted_at?: string | null;
  is_starred?: boolean;
  video_job?: VideoJobRow | null;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export function ReaderPageWrapper({
  params,
  initialNote,
  initialFolder,
  userId,
}: {
  params?: Promise<{ id: string }>;
  initialNote?: Note;
  initialFolder?: Folder | null;
  userId?: string;
}) {
  const [note, setNote] = useState<Note | null>(initialNote || null);
  const [folder, setFolder] = useState<Folder | null>(initialFolder || null);
  const [loading, setLoading] = useState(!initialNote);
  const [isContentReady, setIsContentReady] = useState(false);
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | null>(initialNote?.id || null);

  useEffect(() => {
    if (params) {
      params.then((p) => setNoteId(p.id));
    }
  }, [params]);

  useEffect(() => {
    if (noteId && !initialNote) {
      loadNote();
    } else if (initialNote) {
      // 如果有初始数据，在后台执行非关键操作
      performBackgroundTasks(initialNote, userId);
      // 延迟一帧以确保平滑过渡
      requestAnimationFrame(() => setIsContentReady(true));
    }

    const handleRefresh = () => {
      loadNote();
    };

    window.addEventListener("reader:refresh-content", handleRefresh);
    return () => window.removeEventListener("reader:refresh-content", handleRefresh);
  }, [noteId, initialNote]);

  /**
   * 后台执行非关键任务（不阻塞页面渲染）
   * 包括：更新访问时间、记录浏览历史、记录访问事件
   */
  const performBackgroundTasks = async (noteData: Note, currentUserId?: string) => {
    const supabase = createClient();

    // 获取用户信息（如果没有提供）
    let user_id = currentUserId;
    if (!user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id;
    }

    if (!user_id) return;

    // 并行执行所有后台任务，不阻塞 UI 渲染
    Promise.all([
      // 更新访问时间
      supabase
        .from("notes")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", noteData.id)
        .then(() => {}),

      // 记录访问事件
      supabase.from("note_visit_events").insert({
        user_id,
        note_id: noteData.id,
        source: "reader",
        source_url: noteData.source_url ?? null,
        source_domain: getDomain(noteData.source_url),
        site_name: noteData.site_name ?? null,
        content_type: noteData.content_type ?? null,
      }).then(() => {}),
    ]).catch((error) => {
      // 静默失败，不影响用户体验
      console.error("Background tasks error:", error);
    });

    // 记录本地浏览历史（同步操作，很快）
    addBrowseHistoryEntry(user_id, {
      noteId: noteData.id,
      title: noteData.title ?? null,
      siteName: noteData.site_name ?? null,
      sourceUrl: noteData.source_url ?? null,
      contentType: noteData.content_type ?? null,
    });
  };

  /**
   * 获取 URL 的域名
   */
  const getDomain = (url?: string | null) => {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  /**
   * 加载笔记数据（用于刷新或初始加载）
   */
  const loadNote = async () => {
    if (!noteId) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // 一次性获取笔记和文件夹数据（使用 JOIN 减少往返），同时 join video_jobs 用于视频分析
    // notes ↔ video_jobs 之间有两条 FK，显式指定走 notes.video_job_id → video_jobs.id
    const { data: noteData, error: noteError } = await supabase
      .from("notes")
      .select(`
        *,
        folder:folders(id, name, parent_id),
        video_job:video_jobs!notes_video_job_id_fkey(
          id, audio_result, visual_result, frames, cover_url, cos_url, transcoded_url,
          download_status, probe_status, audio_status, visual_status, transcode_status
        )
      `)
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !noteData) {
      console.error("[ReaderPageWrapper] load note error", {
        noteId,
        message: noteError?.message,
        code: noteError?.code,
        details: noteError?.details,
        hint: noteError?.hint,
      });
      router.push("/dashboard");
      return;
    }

    // 已删除笔记不允许进入阅读页
    if (noteData.deleted_at) {
      router.push("/dashboard");
      return;
    }

    // 提取文件夹数据
    const folderData = noteData.folder
      ? (Array.isArray(noteData.folder) ? noteData.folder[0] : noteData.folder) as Folder | null
      : null;

    setNote(noteData as unknown as Note);
    setFolder(folderData);

    // 在后台执行非关键任务
    performBackgroundTasks(noteData as unknown as Note, user.id);

    setLoading(false);
    setIsContentReady(true);
  };

  // 显示骨架屏
  if (loading) {
    return <ReaderSkeleton />;
  }

  // 笔记不存在
  if (!note) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center min-h-screen bg-background"
      >
        <div className="text-center space-y-4">
          <div className="text-6xl">📄</div>
          <div className="text-muted-foreground">笔记不存在</div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-primary hover:underline"
          >
            返回工作台
          </button>
        </div>
      </motion.div>
    );
  }

  // video 类型分流到 VideoDetailLayout（必须在 AnimatePresence 外层做，避免切换笔记时 Tiptap 实例被卸载）
  // audio 类型继续走 ReaderLayout，等 audio pipeline 也接入 video_jobs 后再切换
  if (note.content_type === 'video') {
    return <VideoDetailLayout note={note} videoJob={note.video_job ?? null} />;
  }

  // 渲染阅读器布局，添加渐入动画
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={note.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{
          duration: 0.3,
          ease: [0.22, 1, 0.36, 1], // easeOutExpo
        }}
      >
        <ReaderLayout note={note} folder={folder} />
      </motion.div>
    </AnimatePresence>
  );
}

