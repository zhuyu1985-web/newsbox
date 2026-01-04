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
      return true; // Circular reference detected
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

// PATCH /api/tags/:id - Update a tag
export async function PATCH(
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

    // Parse request body
    const body = await request.json();
    const { name, color, icon, parent_id } = body;

    const updates: any = {};

    // Validate and update name
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Tag name cannot be empty" },
          { status: 400 }
        );
      }

      // Check for duplicate name under target parent
      const targetParentId = parent_id !== undefined ? parent_id : existingTag.parent_id;
      
      const { data: duplicates } = await supabase
        .from("tags")
        .select("id, parent_id")
        .eq("user_id", user.id)
        .eq("name", name.trim())
        .neq("id", tagId)
        .is("archived_at", null);

      if (duplicates && duplicates.length > 0) {
        for (const dup of duplicates) {
          if (
            (dup.parent_id === null && targetParentId === null) ||
            dup.parent_id === targetParentId
          ) {
            return NextResponse.json(
              { error: "Tag name already exists under this parent" },
              { status: 409 }
            );
          }
        }
      }

      updates.name = name.trim();
    }

    // Update color
    if (color !== undefined) {
      updates.color = color;
    }

    // Update icon
    if (icon !== undefined) {
      updates.icon = icon;
    }

    // Validate and update parent_id
    if (parent_id !== undefined) {
      if (parent_id !== null) {
        // Verify parent exists and belongs to user
        const { data: parentTag, error: parentError } = await supabase
          .from("tags")
          .select("id, user_id")
          .eq("id", parent_id)
          .eq("user_id", user.id)
          .single();

        if (parentError || !parentTag) {
          return NextResponse.json(
            { error: "Invalid parent tag" },
            { status: 400 }
          );
        }

        // Check for circular reference
        const isCircular = await hasCircularReference(supabase, tagId, parent_id);
        if (isCircular) {
          return NextResponse.json(
            { error: "Cannot move tag to its own descendant" },
            { status: 400 }
          );
        }
      }

      updates.parent_id = parent_id;
    }

    // Perform update
    const { data: updatedTag, error: updateError } = await supabase
      .from("tags")
      .update(updates)
      .eq("id", tagId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating tag:", updateError);
      return NextResponse.json(
        { error: "Failed to update tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/tags/:id:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tags/:id - Delete a tag
export async function DELETE(
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
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";

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

    // Check for child tags
    const { data: children, error: childrenError } = await supabase
      .from("tags")
      .select("id")
      .eq("parent_id", tagId);

    if (childrenError) {
      console.error("Error checking for child tags:", childrenError);
      return NextResponse.json(
        { error: "Failed to check for child tags" },
        { status: 500 }
      );
    }

    if (children && children.length > 0 && !force) {
      return NextResponse.json(
        { error: "Cannot delete tag with children. Use force=true to delete anyway." },
        { status: 400 }
      );
    }

    // Check for associated notes
    const { data: noteAssociations, error: notesError } = await supabase
      .from("note_tags")
      .select("note_id")
      .eq("tag_id", tagId);

    if (notesError) {
      console.error("Error checking for note associations:", notesError);
      return NextResponse.json(
        { error: "Failed to check for note associations" },
        { status: 500 }
      );
    }

    if (noteAssociations && noteAssociations.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `Cannot delete tag with ${noteAssociations.length} associated notes. Use force=true to delete anyway.`,
          note_count: noteAssociations.length,
        },
        { status: 400 }
      );
    }

    // If force=true, delete note associations first
    if (force && noteAssociations && noteAssociations.length > 0) {
      const { error: deleteAssocError } = await supabase
        .from("note_tags")
        .delete()
        .eq("tag_id", tagId);

      if (deleteAssocError) {
        console.error("Error deleting note associations:", deleteAssocError);
        return NextResponse.json(
          { error: "Failed to delete note associations" },
          { status: 500 }
        );
      }
    }

    // Delete the tag (CASCADE will handle child tags if any)
    const { error: deleteError } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting tag:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/tags/:id:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

