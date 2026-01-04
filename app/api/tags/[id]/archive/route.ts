import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/tags/:id/archive - Archive a tag
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tagId } = await context.params;

    // Verify tag exists and belongs to user
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("*")
      .eq("id", tagId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check if already archived
    if (existingTag.archived_at) {
      return NextResponse.json(
        { error: "Tag is already archived" },
        { status: 400 }
      );
    }

    // Archive the tag
    const { data: archivedTag, error: archiveError } = await supabase
      .from("tags")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", tagId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (archiveError) {
      console.error("Error archiving tag:", archiveError);
      return NextResponse.json(
        { error: "Failed to archive tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag: archivedTag });
  } catch (error) {
    console.error("Unexpected error in POST /api/tags/:id/archive:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

