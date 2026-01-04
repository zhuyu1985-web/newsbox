import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Helper function to check for circular references
async function hasCircularReference(
  supabase: any,
  tagId: string,
  newParentId: string
): Promise<boolean> {
  let currentId: string | null = newParentId;

  while (currentId) {
    if (currentId === tagId) {
      return true;
    }

    const res = await supabase
      .from("tags")
      .select("parent_id")
      .eq("id", currentId)
      .single();

    const parent = (res?.data ?? null) as { parent_id: string | null } | null;
    currentId = parent?.parent_id || null;
  }

  return false;
}

// POST /api/tags/reorder - Reorder tags
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { tag_id, new_position, new_parent_id } = body;

    // Validate required fields
    if (!tag_id || new_position === undefined) {
      return NextResponse.json(
        { error: "tag_id and new_position are required" },
        { status: 400 }
      );
    }

    // Verify tag exists and belongs to user
    const { data: tag, error: fetchError } = await supabase
      .from("tags")
      .select("*")
      .eq("id", tag_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // If new_parent_id is provided, validate it
    if (new_parent_id !== undefined && new_parent_id !== null) {
      const { data: parentTag, error: parentError } = await supabase
        .from("tags")
        .select("id, user_id")
        .eq("id", new_parent_id)
        .eq("user_id", user.id)
        .single();

      if (parentError || !parentTag) {
        return NextResponse.json(
          { error: "Invalid parent tag" },
          { status: 400 }
        );
      }

      // Check for circular reference
      const isCircular = await hasCircularReference(supabase, tag_id, new_parent_id);
      if (isCircular) {
        return NextResponse.json(
          { error: "Cannot move tag to its own descendant" },
          { status: 400 }
        );
      }
    }

    const targetParentId = new_parent_id !== undefined ? new_parent_id : tag.parent_id;

    // Get all siblings (tags with the same parent)
    const { data: siblings, error: siblingsError } = await supabase
      .from("tags")
      .select("id, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (siblingsError) {
      console.error("Error fetching siblings:", siblingsError);
      return NextResponse.json(
        { error: "Failed to fetch siblings" },
        { status: 500 }
      );
    }

    // Filter siblings by parent
    const sameLevelSiblings = siblings?.filter((s: any) => {
      const sParentId = s.parent_id === undefined ? null : s.parent_id;
      const tParentId = targetParentId === null ? null : targetParentId;
      return sParentId === tParentId;
    }) || [];

    // Update positions
    const updates: Array<{ id: string; position: number }> = [];

    // Remove the tag from its current position
    const currentSiblings = sameLevelSiblings.filter((s: any) => s.id !== tag_id);

    // Insert at new position
    currentSiblings.splice(new_position, 0, { id: tag_id, position: new_position });

    // Reassign positions
    currentSiblings.forEach((sibling: any, index: number) => {
      updates.push({ id: sibling.id, position: index });
    });

    // Execute updates in a transaction-like manner
    for (const update of updates) {
      const updateData: any = { position: update.position };
      
      // If this is the dragged tag and parent changed, update parent too
      if (update.id === tag_id && new_parent_id !== undefined) {
        updateData.parent_id = new_parent_id;
      }

      const { error: updateError } = await supabase
        .from("tags")
        .update(updateData)
        .eq("id", update.id)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating tag position:", updateError);
        return NextResponse.json(
          { error: "Failed to update tag positions" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in POST /api/tags/reorder:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

