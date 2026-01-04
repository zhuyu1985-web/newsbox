import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/tags - Fetch all tags for the current user
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeArchived = searchParams.get("include_archived") === "true";
    const includeCounts = searchParams.get("include_counts") !== "false"; // default true

    // Build query - Try with new columns first, fall back to basic columns if migration not run
    let query = supabase
      .from("tags")
      .select(
        includeCounts
          ? `
            id,
            user_id,
            name,
            color,
            icon,
            parent_id,
            position,
            archived_at,
            created_at,
            note_tags(count)
          `
          : `
            id,
            user_id,
            name,
            color,
            icon,
            parent_id,
            position,
            archived_at,
            created_at
          `
      )
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    // Filter archived tags unless explicitly requested
    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data: tagsData, error: tagsError } = await query;

    if (tagsError) {
      console.error("Error fetching tags (new schema):", tagsError);
      
      // Try fallback query with basic columns only (for backward compatibility)
      const fallbackQuery = supabase
        .from("tags")
        .select(
          includeCounts
            ? `id, user_id, name, color, created_at, note_tags(count)`
            : `id, user_id, name, color, created_at`
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      
      if (fallbackError) {
        console.error("Error fetching tags (fallback):", fallbackError);
        return NextResponse.json(
          { error: "Failed to fetch tags. Please run database migration 006_add_tag_management.sql" },
          { status: 500 }
        );
      }
      
      // Transform fallback data to match expected schema
      const transformedData = fallbackData?.map((tag: any) => ({
        id: tag.id,
        user_id: tag.user_id,
        name: tag.name,
        color: tag.color,
        icon: null,
        parent_id: null,
        position: 0,
        archived_at: null,
        created_at: tag.created_at,
        note_count: includeCounts ? (tag.note_tags?.[0]?.count || 0) : 0,
        children: [],
      }));
      
      return NextResponse.json({ tags: transformedData || [] });
    }

    // Transform data to include note_count
    const tags = tagsData?.map((tag: any) => ({
      id: tag.id,
      user_id: tag.user_id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      parent_id: tag.parent_id,
      position: tag.position,
      archived_at: tag.archived_at,
      created_at: tag.created_at,
      note_count: includeCounts ? (tag.note_tags?.[0]?.count || 0) : 0,
      children: [],
    }));

    return NextResponse.json({ tags: tags || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/tags:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tags - Create a new tag
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
    const { name, color, icon, parent_id } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // If parent_id is provided, validate it exists and belongs to user
    if (parent_id) {
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
    }

    // Check for duplicate name under same parent
    const { data: existingTags } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name.trim())
      .is("archived_at", null);

    if (existingTags && existingTags.length > 0) {
      // Check if any existing tag has the same parent
      for (const existing of existingTags) {
        const { data: existingTag } = await supabase
          .from("tags")
          .select("parent_id")
          .eq("id", existing.id)
          .single();

        if (existingTag) {
          const existingParentId = existingTag.parent_id;
          if (
            (existingParentId === null && parent_id === undefined) ||
            existingParentId === parent_id
          ) {
            return NextResponse.json(
              { error: "Tag name already exists under this parent" },
              { status: 409 }
            );
          }
        }
      }
    }

    // Get max position for siblings
    let maxPosition = 0;
    const { data: siblings } = await supabase
      .from("tags")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1);

    if (siblings && siblings.length > 0) {
      maxPosition = siblings[0].position || 0;
    }

    // Create new tag
    const { data: newTag, error: createError } = await supabase
      .from("tags")
      .insert({
        user_id: user.id,
        name: name.trim(),
        color: color || null,
        icon: icon || null,
        parent_id: parent_id || null,
        position: maxPosition + 1,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating tag:", createError);
      return NextResponse.json(
        { error: "Failed to create tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag: newTag }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/tags:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

