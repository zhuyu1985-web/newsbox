"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ReaderLayout } from "./ReaderLayout";
import { addBrowseHistoryEntry } from "@/lib/browse-history";

interface Note {
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
  created_at: string;
  published_at: string | null;
  reading_position?: number;
  read_percentage?: number;
  estimated_read_time?: number;
  reader_preferences?: any;
  folder_id?: string | null;
  deleted_at?: string | null;
  is_starred?: boolean;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export function ReaderPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setNoteId(p.id));
  }, [params]);

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
    
    const handleRefresh = () => {
      loadNote();
    };
    
    window.addEventListener("reader:refresh-content", handleRefresh);
    return () => window.removeEventListener("reader:refresh-content", handleRefresh);
  }, [noteId]);

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

    // 获取笔记数据
    const { data: noteData, error: noteError } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !noteData) {
      router.push("/dashboard");
      return;
    }

    // 已删除笔记不允许进入阅读页（从回收站恢复后可再次打开）
    if (noteData.deleted_at) {
      router.push("/dashboard");
      return;
    }

    setNote(noteData);

    // 更新访问时间
    await supabase
      .from("notes")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", noteId);

    // 记录本地浏览历史（用于“浏览历史”弹窗）
    addBrowseHistoryEntry(user.id, {
      noteId: noteData.id,
      title: noteData.title ?? null,
      siteName: noteData.site_name ?? null,
      sourceUrl: noteData.source_url ?? null,
      contentType: noteData.content_type ?? null,
    });

    // 记录访问事件（用于“用量统计”的累计访问次数与来源 TOP）
    const getDomain = (url?: string | null) => {
      if (!url) return null;
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    };

    await supabase.from("note_visit_events").insert({
      user_id: user.id,
      note_id: noteData.id,
      source: "reader",
      source_url: noteData.source_url ?? null,
      source_domain: getDomain(noteData.source_url),
      site_name: noteData.site_name ?? null,
      content_type: noteData.content_type ?? null,
    });

    // 如果笔记有文件夹，获取文件夹信息
    if (noteData.folder_id) {
      const { data: folderData } = await supabase
        .from("folders")
        .select("*")
        .eq("id", noteData.folder_id)
        .single();

      if (folderData) {
        setFolder(folderData);
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">笔记不存在</div>
      </div>
    );
  }

  return <ReaderLayout note={note} folder={folder} />;
}

