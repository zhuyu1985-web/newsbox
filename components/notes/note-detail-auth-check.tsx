import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // 一次性获取笔记和文件夹数据，避免客户端重复查询
  const { data: note, error } = await supabase
    .from("notes")
    .select(`
      *,
      folder:folders(id, name, parent_id)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !note) {
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

