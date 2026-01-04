import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // 验证笔记属于当前用户
  const { data: note, error } = await supabase
    .from("notes")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !note) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

