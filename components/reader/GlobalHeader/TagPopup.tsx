"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TagPopupProps {
  noteId: string;
  currentTagIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TagPopup({
  noteId,
  currentTagIds,
  isOpen,
  onClose,
  onSuccess,
}: TagPopupProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // 加载标签列表
  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color, icon")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("name");

      if (!error && data) {
        setTags(data);
      }
      setLoading(false);
    };

    if (isOpen) {
      fetchTags();
      // 聚焦到搜索输入框
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, supabase]);

  // 重置选中状态
  useEffect(() => {
    setSelectedTagIds(currentTagIds);
    setSearchQuery("");
    setNewTagName("");
  }, [currentTagIds, isOpen]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // 过滤标签
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 切换标签选中状态 - 立即应用并关闭
  const toggleTag = async (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);
    const newSelectedIds = isSelected
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    // 如果是选中操作，立即添加到数据库
    if (!isSelected) {
      const { error } = await supabase
        .from("note_tags")
        .insert({
          note_id: noteId,
          tag_id: tagId,
        });

      if (!error) {
        setSelectedTagIds(newSelectedIds);
        onSuccess();
        onClose(); // 关闭弹出层
      }
    } else {
      // 如果是取消选中，立即从数据库删除
      const { error } = await supabase
        .from("note_tags")
        .delete()
        .eq("note_id", noteId)
        .eq("tag_id", tagId);

      if (!error) {
        setSelectedTagIds(newSelectedIds);
        onSuccess();
        onClose(); // 关闭弹出层
      }
    }
  };

  // 添加新标签
  const addNewTag = async () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      return;
    }

    // 检查是否已存在
    const existingTag = tags.find(
      (tag) => tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingTag) {
      // 如果已存在且未选中，选中它
      if (!selectedTagIds.includes(existingTag.id)) {
        await toggleTag(existingTag.id);
      }
      setNewTagName("");
      return;
    }

    setAdding(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAdding(false);
      return;
    }

    // 创建新标签
    const { data, error } = await supabase
      .from("tags")
      .insert({
        name: trimmedName,
        user_id: user.id,
        color: null,
        icon: null,
      })
      .select()
      .single();

    setAdding(false);

    if (error) {
      console.error("创建标签失败:", error);
      return;
    }

    // 添加到标签列表并选中
    setTags((prev) => [...prev, data]);
    await toggleTag(data.id);
    setNewTagName("");
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-[9999] mb-2 w-80 max-h-80 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        bottom: "60px", // 在底部导航栏上方
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      {/* 搜索框 */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索或创建标签..."
            value={searchQuery || newTagName}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              setNewTagName(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newTagName.trim()) {
                  addNewTag();
                }
              }
            }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-accent/50 border-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* 标签列表 */}
      <div className="h-48 overflow-y-auto">
        {loading ? (
          // 骨架屏加载状态
          <div className="p-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center px-3 py-2 rounded-md animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="h-4 bg-accent/50 rounded w-20" />
              </div>
            ))}
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="p-4 text-center">
            {searchQuery || newTagName ? (
              <button
                onClick={addNewTag}
                disabled={adding || !newTagName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-accent rounded-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                {adding ? "创建中..." : `创建 "${newTagName}" 标签`}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">暂无标签</p>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="flex items-center px-3 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                <span className="text-sm">{tag.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-2 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          {searchQuery || newTagName
            ? "按回车创建新标签"
            : "点击标签选择，或输入搜索"}
        </p>
      </div>
    </div>
  );
}
