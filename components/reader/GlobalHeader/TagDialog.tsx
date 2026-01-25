"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TagDialogProps {
  noteId: string;
  currentTagIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedTagIds: string[]) => void;
}

export function TagDialog({
  noteId,
  currentTagIds,
  isOpen,
  onClose,
  onSuccess,
}: TagDialogProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  // 确保只在客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // 加载标签列表
  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);

      // 获取当前用户
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
    }
  }, [isOpen, supabase]);

  // 重置选中状态
  useEffect(() => {
    setSelectedTagIds(currentTagIds);
  }, [currentTagIds, isOpen]);

  // 过滤标签
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 切换标签选中状态
  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // 添加新标签
  const addNewTag = async () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      toast.error("请输入标签名称");
      return;
    }

    // 检查是否已存在
    const existingTag = tags.find(
      (tag) => tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingTag) {
      // 如果已存在，直接选中
      if (!selectedTagIds.includes(existingTag.id)) {
        setSelectedTagIds((prev) => [...prev, existingTag.id]);
      }
      setNewTagName("");
      toast.success("标签已添加");
      return;
    }

    setUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("请先登录");
      setUpdating(false);
      return;
    }

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

    setUpdating(false);

    if (error) {
      console.error("创建标签失败:", error);
      toast.error("创建标签失败，请重试");
      return;
    }

    // 添加到标签列表
    setTags((prev) => [...prev, data]);
    // 选中新标签
    setSelectedTagIds((prev) => [...prev, data.id]);
    setNewTagName("");
    toast.success("标签已创建");
  };

  // 保存标签更改
  const handleSave = async () => {
    setUpdating(true);

    // 删除现有的标签关联
    const { error: deleteError } = await supabase
      .from("note_tags")
      .delete()
      .eq("note_id", noteId);

    if (deleteError) {
      console.error("删除标签关联失败:", deleteError);
      toast.error("保存失败，请重试");
      setUpdating(false);
      return;
    }

    // 添加新的标签关联
    if (selectedTagIds.length > 0) {
      const rows = selectedTagIds.map((tagId) => ({
        note_id: noteId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from("note_tags")
        .insert(rows);

      if (insertError) {
        console.error("添加标签关联失败:", insertError);
        toast.error("保存失败，请重试");
        setUpdating(false);
        return;
      }
    }

    setUpdating(false);
    toast.success("标签已保存");
    onSuccess?.(selectedTagIds);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  // 获取已选中的标签对象
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-[9999] pb-[10vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card
              className="w-full p-6 max-h-[80vh] overflow-hidden flex flex-col shadow-xl border-border/60 bg-card/95 backdrop-blur-xl"
            >
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">管理标签</h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">加载中...</div>
                </div>
              ) : (
                <>
                  {/* 已选标签 */}
                  {selectedTags.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm text-muted-foreground mb-2">已选标签</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="px-3 py-1 text-sm cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors"
                            style={!tag.color ? {} : {
                              backgroundColor: tag.color,
                              color: "white",
                            }}
                            onClick={() => toggleTag(tag.id)}
                          >
                            {tag.icon && <span className="mr-1">{tag.icon}</span>}
                            {tag.name}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 搜索框 */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                    <Input
                      placeholder="搜索标签..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-muted border-border"
                    />
                  </div>

                  {/* 标签列表 */}
                  <div className="flex-1 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                    {filteredTags.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground/70 text-sm">
                        {searchQuery ? "没有找到匹配的标签" : "暂无标签"}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredTags.map((tag) => {
                          const isSelected = selectedTagIds.includes(tag.id);
                          return (
                            <div
                              key={tag.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-blue-50 text-blue-700"
                                  : "hover:bg-muted text-popover-foreground"
                              )}
                              onClick={() => toggleTag(tag.id)}
                            >
                              <div className="flex items-center gap-2">
                                {tag.icon && <span>{tag.icon}</span>}
                                <span className="font-medium">{tag.name}</span>
                              </div>
                              {isSelected && (
                                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Check className="h-3 w-3 text-blue-600" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 添加新标签 */}
                  <div className="mb-4 pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">创建新标签</div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入标签名称..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="bg-muted border-border"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addNewTag();
                          }
                        }}
                      />
                      <Button
                        onClick={addNewTag}
                        disabled={updating || !newTagName.trim()}
                        size="icon"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2 pt-4 border-t border-border">
                    <Button variant="outline" onClick={onClose} disabled={updating}>
                      取消
                    </Button>
                    <Button onClick={handleSave} disabled={updating}>
                      {updating ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
