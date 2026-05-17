import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-extension-auth";

export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, supabase } = auth;

  try {
    // Fetch folders (non-archived, ordered by position)
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name, icon, color, parent_id, position")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("position", { ascending: true });

    // Fetch tags (non-archived, ordered by name)
    const { data: tags } = await supabase
      .from("tags")
      .select("id, name, color")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("name", { ascending: true });

    return NextResponse.json({
      folders: folders || [],
      tags: tags || [],
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[extension/meta] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
