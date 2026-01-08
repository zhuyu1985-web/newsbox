"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Video,
  Music,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Note {
  id: string;
  source_url: string;
  content_type: "article" | "video" | "audio";
  title: string | null;
  author: string | null;
  site_name: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  content_html: string | null;
  content_text: string | null;
  media_url: string | null;
  media_duration: number | null;
  status: "unread" | "reading" | "archived";
  created_at: string;
  published_at: string | null;
}

export function NoteDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setNoteId(p.id));
  }, [params]);

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  const loadNote = async () => {
    if (!noteId) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      router.push("/dashboard");
      return;
    }

    setNote(data);
    setLoading(false);
  };

  const handleRefreshContent = async () => {
    if (!note) return;

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId: note.id,
          url: note.source_url,
        }),
      });

      if (response.ok) {
        await loadNote();
      } else {
        toast.error("刷新内容失败");
      }
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("刷新内容失败");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "audio":
        return <Music className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const processContentHtml = (html: string | null) => {
    if (!html) return null;
    // Add referrerpolicy="no-referrer" to all img tags to fix WeChat image anti-hotlinking
    return html.replace(/<img/g, '<img referrerpolicy="no-referrer"');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">笔记不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div className="flex items-center gap-2">
                {getContentTypeIcon(note.content_type)}
                <Badge variant="outline">{note.content_type}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshContent}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
                />
                刷新内容
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={note.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  打开原文
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Cover Image */}
        {note.cover_image_url && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img
              src={note.cover_image_url}
              alt={note.title || ""}
              className="w-full h-auto max-h-96 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Title and Metadata */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">
            {note.title || "无标题"}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {note.site_name && <span>来源：{note.site_name}</span>}
            {note.author && <span>作者：{note.author}</span>}
            {note.published_at && (
              <span>
                发布时间：{new Date(note.published_at).toLocaleDateString("zh-CN")}
              </span>
            )}
            {note.media_duration && (
              <span>时长：{formatDuration(note.media_duration)}</span>
            )}
            <span>
              收藏时间：{new Date(note.created_at).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>

        {/* Excerpt */}
        {note.excerpt && (
          <Card className="mb-6 p-4 bg-muted/50">
            <p className="text-muted-foreground">{note.excerpt}</p>
          </Card>
        )}

        {/* Content */}
        {note.content_html ? (
          <Card className="p-6">
            <div
              className="max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:mb-2 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4"
              dangerouslySetInnerHTML={{ __html: processContentHtml(note.content_html) || "" }}
            />
          </Card>
        ) : note.content_text ? (
          <Card className="p-6">
            <div className="whitespace-pre-wrap leading-relaxed">
              {note.content_text}
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              内容尚未抓取，请点击"刷新内容"按钮获取内容
            </p>
            <Button onClick={handleRefreshContent} disabled={isRefreshing}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "抓取中..." : "抓取内容"}
            </Button>
          </Card>
        )}

        {/* Video/Audio Player */}
        {note.content_type === "video" && note.media_url && (
          <Card className="mt-6 p-4">
            <div className="aspect-video">
              <iframe
                src={note.media_url}
                className="w-full h-full"
                allowFullScreen
                title={note.title || "Video"}
              />
            </div>
          </Card>
        )}

        {note.content_type === "audio" && note.media_url && (
          <Card className="mt-6 p-4">
            <audio controls className="w-full" src={note.media_url}>
              您的浏览器不支持音频播放
            </audio>
          </Card>
        )}
      </div>
    </div>
  );
}

