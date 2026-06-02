import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AudioAnalysisResult, VisualFrameAnalysis } from "@/lib/ai-analysis/types";

interface VideoJobRow {
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
  frame_status?: string | null;
  size_bytes?: number | null;
  download_error?: string | null;
  audio_error?: string | null;
  visual_error?: string | null;
}

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
  user_id: string;
  video_job?: VideoJobRow | null;
  user_notes?: any;
  user_notes_updated_at?: string | null;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export async function NoteDetailAuthCheck({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 一次性获取笔记和文件夹数据，避免客户端重复查询，同时 join video_jobs 用于视频分析
  // notes 与 video_jobs 之间有两条 FK（forward + reverse），必须显式指定走 notes.video_job_id → video_jobs.id
  const { data: note, error } = await supabase
    .from("notes")
    .select(`
      *,
      folder:folders(id, name, parent_id),
      video_job:video_jobs!notes_video_job_id_fkey(
        id, audio_result, visual_result, frames, cover_url, cos_url, transcoded_url,
        download_status, probe_status, audio_status, visual_status, transcode_status,
        frame_status, size_bytes, download_error, audio_error, visual_error
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !note) {
    console.error("[NoteDetailAuthCheck] load note error", {
      id,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    redirect("/dashboard");
  }

  // 已删除的笔记不允许访问
  if (note.deleted_at) {
    redirect("/dashboard");
  }

  // 提取文件夹数据
  const folder = Array.isArray(note.folder)
    ? note.folder[0] as Folder | undefined
    : note.folder as Folder | undefined;

  // 将服务端获取的数据作为 props 传递给子组件
  return (
    <>
      {typeof children === 'function'
        ? children
        : children}
    </>
  );
}

