"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagManagerProps {
  noteId: string;
  className?: string;
}

export function TagManager({ noteId, className }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // 加载笔记的标签
  useEffect(() => {
    loadNoteTags();
    loadAllTags();
  }, [noteId]);

  const loadNoteTags = async () => {
    try {
      const { data, error } = await supabase
        .from("note_tags")
        .select("tag:tags(id, name, color)")
        .eq("note_id", noteId);

      if (error) throw error;

      const noteTags = data
        ?.map((item: any) => item.tag)
        .filter(Boolean) as Tag[];
      setTags(noteTags || []);
    } catch (error) {
      console.error("Failed to load note tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTags = async () => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .order("name");

      if (error) throw error;
      setAllTags(data || []);
    } catch (error) {
      console.error("Failed to load all tags:", error);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    try {
      // 检查标签是否已存在
      let tagId = allTags.find(
        (t) => t.name.toLowerCase() === newTagName.toLowerCase()
      )?.id;

      // 如果标签不存在，创建新标签
      if (!tagId) {
        const { data: newTag, error: createError } = await supabase
          .from("tags")
          .insert({
            name: newTagName.trim(),
            color: getRandomColor(),
          })
          .select()
          .single();

        if (createError) throw createError;
        tagId = newTag.id;
        setAllTags([...allTags, newTag]);
      }

      // 关联标签到笔记
      const { error: linkError } = await supabase
        .from("note_tags")
        .insert({
          note_id: noteId,
          tag_id: tagId,
        });

      if (linkError) throw linkError;

      // 刷新标签列表
      await loadNoteTags();
      setNewTagName("");
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from("note_tags")
        .delete()
        .eq("note_id", noteId)
        .eq("tag_id", tagId);

      if (error) throw error;

      setTags(tags.filter((t) => t.id !== tagId));
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const getRandomColor = () => {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <TagIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <TagIcon className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* 已有标签 */}
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="group relative pr-6 hover:pr-7 transition-all"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* 添加标签 */}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            placeholder="输入标签名..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddTag();
              } else if (e.key === "Escape") {
                setIsAdding(false);
                setNewTagName("");
              }
            }}
            className="h-7 w-32 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddTag}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsAdding(false);
              setNewTagName("");
            }}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          添加标签
        </Button>
      )}
    </div>
  );
}

