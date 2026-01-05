"use client";

import React, { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Trash2, 
  Archive, 
  Star, 
  Image as ImageIcon, 
  Folder as FolderIcon, 
  X,
  ChevronRight,
  Loader2,
  Upload,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Custom Dialog components with light blue overlay
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-blue-100/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-0 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl border-gray-200",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-3 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none hover:bg-gray-100">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogTitle = DialogPrimitive.Title;

interface Tag {
  id: string;
  name: string;
}

interface Folder {
  id: string;
  name: string;
}

interface EditMetaDialogProps {
  noteId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditMetaDialog({ 
  noteId, 
  isOpen, 
  onOpenChange,
  onSuccess 
}: EditMetaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("未分类");
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  
  // Folder selection state
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<Folder[]>([]);
  
  // Tag dropdown state
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && noteId) {
      fetchNoteDetails();
      fetchMetadata();
    }
  }, [isOpen, noteId]);

  const fetchNoteDetails = async () => {
    setLoading(true);
    try {
      const { data: note, error } = await supabase
        .from("notes")
        .select(`
          title, 
          excerpt,
          source_url, 
          cover_image_url, 
          folder_id, 
          is_starred, 
          status,
          folders(name),
          note_tags(tags(id, name))
        `)
        .eq("id", noteId)
        .single();

      if (error) throw error;
      if (!note) throw new Error("Note not found");

      setTitle(note.title || "");
      setDescription(note.excerpt || "");
      setSourceUrl(note.source_url || "");
      setCoverImage(note.cover_image_url);
      setFolderId(note.folder_id);
      const folderData = note.folders as unknown as { name: string } | null;
      setFolderName(folderData?.name || "未分类");
      setIsStarred(note.is_starred || false);
      setIsArchived(note.status === "archived");
      
      const noteTags = note.note_tags
        ?.map((nt: any) => nt.tags)
        .filter(Boolean) as Tag[];
      setTags(noteTags || []);

    } catch (error) {
      console.error("Error fetching note:", error);
      toast.error("获取笔记信息失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      // Fetch folders
      const { data: foldersData } = await supabase
        .from("folders")
        .select("id, name")
        .order("name");
      if (foldersData) setAvailableFolders(foldersData);

      // Fetch all tags for selection
      const { data: tagsData } = await supabase
        .from("tags")
        .select("id, name")
        .order("name");
      if (tagsData) setAllTags(tagsData);
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update Note basic info
      const { error: noteError } = await supabase
        .from("notes")
        .update({
          title,
          excerpt: description,
          cover_image_url: coverImage,
          folder_id: folderId,
          is_starred: isStarred,
          status: isArchived ? "archived" : "unread",
          updated_at: new Date().toISOString(),
        })
        .eq("id", noteId);

      if (noteError) throw noteError;

      // 2. Update Tags
      // First delete existing links
      const { error: deleteTagsError } = await supabase
        .from("note_tags")
        .delete()
        .eq("note_id", noteId);
      
      if (deleteTagsError) throw deleteTagsError;

      // Then insert new links
      if (tags.length > 0) {
        const noteTagsInsert = tags.map(tag => ({
          note_id: noteId,
          tag_id: tag.id
        }));
        
        const { error: insertTagsError } = await supabase
          .from("note_tags")
          .insert(noteTagsInsert);
          
        if (insertTagsError) throw insertTagsError;
      }

      toast.success("保存成功");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => setIsArchived(!isArchived);
  const handleStar = () => setIsStarred(!isStarred);
  const handleDelete = async () => {
    if (!confirm("确定要将此笔记移入回收站吗？")) return;
    try {
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", noteId);
      if (error) throw error;
      toast.success("已移入回收站");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error("删除失败");
    }
  };

  const handleAddTag = async (tag: Tag) => {
    if (!tags.find(t => t.id === tag.id)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  };

  const handleCreateTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tagName = tagInput.trim();
      
      const existingTag = tags.find(t => t.name === tagName);
      if (existingTag) {
        setTagInput("");
        return;
      }

      // Check if tag exists in allTags
      const existingInAll = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (existingInAll) {
        handleAddTag(existingInAll);
        return;
      }

      try {
        let tagToAdd: Tag;
        const { data: existingDbTag } = await supabase
          .from("tags")
          .select("id, name")
          .eq("name", tagName)
          .single();

        if (existingDbTag) {
          tagToAdd = existingDbTag;
        } else {
          const { data: newTag, error } = await supabase
            .from("tags")
            .insert({ name: tagName })
            .select("id, name")
            .single();
          
          if (error) throw error;
          tagToAdd = newTag;
          // Add to allTags for future reference
          setAllTags(prev => [...prev, tagToAdd]);
        }
        
        setTags([...tags, tagToAdd]);
        setTagInput("");
        setShowTagDropdown(false);
      } catch (error) {
        toast.error("添加标签失败");
      }
    }
  };

  const removeTag = (tagId: string) => {
    setTags(tags.filter(t => t.id !== tagId));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("未登录");

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('zhuyu')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('zhuyu')
          .getPublicUrl(fileName);

        setCoverImage(publicUrl);
        toast.success("封面上传成功");
      } catch (error) {
        console.error("Upload failed", error);
        toast.error("上传失败");
      } finally {
        setUploading(false);
      }
    }
  };

  // Filter tags for dropdown based on input
  const filteredTags = allTags.filter(tag => 
    !tags.find(t => t.id === tag.id) && 
    tag.name.toLowerCase().includes(tagInput.toLowerCase())
  );

  // Get suggested tags (first 5 that are not already selected)
  const suggestedTags = allTags.filter(tag => !tags.find(t => t.id === tag.id)).slice(0, 5);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] overflow-visible">
        <DialogTitle className="sr-only">编辑信息</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
          <span className="font-semibold text-base text-gray-900">编辑信息</span>
          
          <div className="flex items-center gap-1 mr-6">
            <Button 
              variant="ghost" 
              size="icon"
              className={cn("rounded-full h-8 w-8 text-gray-500 hover:text-gray-900", isArchived && "text-blue-600 hover:text-blue-700 bg-blue-50")}
              onClick={handleArchive}
              title={isArchived ? "取消归档" : "归档"}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className={cn("rounded-full h-8 w-8 text-gray-500 hover:text-gray-900", isStarred && "text-yellow-500 hover:text-yellow-600 bg-yellow-50")}
              onClick={handleStar}
              title={isStarred ? "取消星标" : "星标"}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5 min-h-[380px] max-h-[60vh] overflow-y-auto bg-white">
          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* URL */}
              <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1.5 rounded truncate">
                {sourceUrl || "无链接"}
              </div>

              {/* Title & Description */}
              <div className="space-y-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-base font-semibold border-gray-200 px-3 shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-gray-300 h-9"
                  placeholder="标题"
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] border-gray-200 px-3 resize-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-gray-300 text-gray-600 text-sm leading-relaxed"
                  placeholder="添加简介..."
                />
              </div>

              {/* Cover Image */}
              <div className="flex items-center gap-3">
                <div 
                  className="w-28 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 cursor-pointer group relative hover:border-gray-300 transition-colors shrink-0"
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  ) : coverImage ? (
                    <>
                      <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="h-4 w-4 text-white" />
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-300" />
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                <span className="text-xs text-gray-400">点击上传封面图</span>
              </div>

              {/* Folder Selector */}
              <div className="relative">
                <div 
                  className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 transition-all cursor-pointer"
                  onClick={() => setShowFolderSelect(!showFolderSelect)}
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700">{folderName}</span>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", showFolderSelect && "rotate-90")} />
                </div>
                
                {showFolderSelect && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 max-h-40 overflow-y-auto z-20">
                    <div 
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 text-sm rounded cursor-pointer hover:bg-gray-50",
                        folderId === null && "bg-blue-50 text-blue-600"
                      )}
                      onClick={() => {
                        setFolderId(null);
                        setFolderName("未分类");
                        setShowFolderSelect(false);
                      }}
                    >
                      <FolderIcon className="h-4 w-4 text-gray-400" />
                      <span>未分类</span>
                      {folderId === null && <Check className="h-3 w-3 ml-auto" />}
                    </div>
                    {availableFolders.map(folder => (
                      <div 
                        key={folder.id}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 text-sm rounded cursor-pointer hover:bg-gray-50",
                          folderId === folder.id && "bg-blue-50 text-blue-600"
                        )}
                        onClick={() => {
                          setFolderId(folder.id);
                          setFolderName(folder.name);
                          setShowFolderSelect(false);
                        }}
                      >
                        <FolderIcon className={cn("h-4 w-4", folderId === folder.id ? "text-blue-500" : "text-gray-400")} />
                        <span>{folder.name}</span>
                        {folderId === folder.id && <Check className="h-3 w-3 ml-auto" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                {/* Suggested tags */}
                {suggestedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-gray-400">标签建议</span>
                    {suggestedTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag)}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Tag input area */}
                <div className="relative">
                  <div 
                    className="flex flex-wrap gap-1.5 p-2.5 border border-gray-200 rounded-lg bg-white min-h-[40px] cursor-text"
                    onClick={() => tagInputRef.current?.focus()}
                  >
                    {tags.map(tag => (
                      <div key={tag.id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs">
                        <span>{tag.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
                          className="hover:text-blue-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value);
                        setShowTagDropdown(true);
                      }}
                      onFocus={() => setShowTagDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                      onKeyDown={handleCreateTag}
                      placeholder={tags.length === 0 ? "输入或选择标签..." : ""}
                      className="flex-1 min-w-[100px] h-6 text-sm border-0 bg-transparent px-1 focus:outline-none placeholder:text-gray-400"
                    />
                  </div>

                  {/* Tag dropdown - positioned above */}
                  {showTagDropdown && filteredTags.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 max-h-36 overflow-y-auto z-20">
                      {filteredTags.slice(0, 8).map(tag => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 px-2.5 py-2 text-sm rounded cursor-pointer hover:bg-gray-50"
                          onMouseDown={(e) => { e.preventDefault(); handleAddTag(tag); }}
                        >
                          <span>{tag.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center px-5 py-3 border-t border-gray-100 bg-gray-50/50 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-white">
            取消
          </Button>
          <Button 
            size="sm"
            onClick={handleSave} 
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[60px]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
