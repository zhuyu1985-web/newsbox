import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function DashboardAuthCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}

