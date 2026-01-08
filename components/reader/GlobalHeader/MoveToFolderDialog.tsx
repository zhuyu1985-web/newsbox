"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Folder {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  note_count?: number;
}

interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  depth?: number;
}

interface MoveToFolderDialogProps {
  noteId: string;
  currentFolderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newFolderId: string | null) => void;
}

function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // 创建所有节点
  folders.forEach((folder) => {
    nodes.set(folder.id, { ...folder, children: [] });
  });

  // 构建树结构
  folders.forEach((folder) => {
    const node = nodes.get(folder.id)!;
    if (folder.parent_id && nodes.has(folder.parent_id)) {
      nodes.get(folder.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function flattenFolderTree(
  nodes: FolderTreeNode[],
  depth = 0,
): Array<FolderTreeNode & { depth: number }> {
  const result: Array<FolderTreeNode & { depth: number }> = [];

  nodes.forEach((node) => {
    result.push({ ...node, depth });
    if (node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  });

  return result;
}

export function MoveToFolderDialog({
  noteId,
  currentFolderId,
  isOpen,
  onClose,
  onSuccess,
}: MoveToFolderDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  // 加载文件夹列表
  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);

      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("folders")
        .select("id, name, icon, parent_id, position, archived_at, notes(count)")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("position", { ascending: true });

      if (!error && data) {
        // 构建文件夹列表，笔记数量从 notes(count) 获取
        const normalizedFolders: Folder[] = data.map((folder) => {
          const noteCountEntry = Array.isArray(folder.notes)
            ? folder.notes[0]
            : null;
          return {
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
            parent_id: folder.parent_id,
            note_count: Number(noteCountEntry?.count ?? 0),
          };
        });

        setFolders(normalizedFolders);
      }
      setLoading(false);
    };

    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen, supabase]);

  // 重置选中状态
  useEffect(() => {
    setSelectedFolderId(currentFolderId);
  }, [currentFolderId, isOpen]);

  const handleMove = async () => {
    setMoving(true);

    const { error } = await supabase
      .from("notes")
      .update({ folder_id: selectedFolderId })
      .eq("id", noteId);

    setMoving(false);

    if (error) {
      console.error("移动失败:", error);
      toast.error("移动失败，请重试");
      return;
    }

    toast.success(
      selectedFolderId ? "已移动到收藏夹" : "已移出收藏夹（未分类）"
    );
    onSuccess?.(selectedFolderId);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const folderTree = buildFolderTree(folders);
  const flattenedOptions = flattenFolderTree(folderTree);

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
            className="w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full p-6 shadow-xl border-slate-200/60 bg-white/95 backdrop-blur-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">移动到收藏夹</h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">加载中...</div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {/* 未分类选项 */}
                    <Button
                      variant={selectedFolderId === null ? "default" : "outline"}
                      className="w-full justify-start hover:bg-slate-50 border-slate-200"
                      onClick={() => setSelectedFolderId(null)}
                    >
                      <span className="text-base leading-none mr-2">📄</span>
                      未分类
                    </Button>

                    {/* 文件夹列表 */}
                    {flattenedOptions.map((folder) => (
                      <Button
                        key={folder.id}
                        variant={selectedFolderId === folder.id ? "default" : "outline"}
                        className="w-full justify-start gap-2 hover:bg-slate-50 border-slate-200"
                        style={{ paddingLeft: folder.depth * 12 + 12 }}
                        onClick={() => setSelectedFolderId(folder.id)}
                      >
                        <span className="text-base leading-none">
                          {folder.icon || "📁"}
                        </span>
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {folder.note_count || 0}
                        </span>
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={onClose} disabled={moving}>
                      取消
                    </Button>
                    <Button onClick={handleMove} disabled={moving}>
                      {moving ? "移动中..." : "确定"}
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
