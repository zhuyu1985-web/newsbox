"use client";

import dynamic from "next/dynamic";
import { ArticleReader } from "./ArticleReader";

// 懒加载重型组件
const VideoPlayer = dynamic(() => import("./VideoPlayer").then((mod) => mod.VideoPlayer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">加载播放器...</div>,
});

const WebView = dynamic(() => import("./WebView").then((mod) => mod.WebView), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">加载网页...</div>,
});

const AIBriefView = dynamic(() => import("./AISnapshotView").then((mod) => mod.AISnapshotView), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">加载AI快照...</div>,
});

const ArchiveView = dynamic(() => import("./ArchiveView").then((mod) => mod.ArchiveView), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">加载存档...</div>,
});

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
  created_at: string;
  published_at: string | null;
  estimated_read_time?: number;
}

interface ContentStageProps {
  note: Note;
  currentView: "reader" | "web" | "ai-brief" | "archive";
}

export function ContentStage({ note, currentView }: ContentStageProps) {
  // 根据当前视图和内容类型渲染对应组件
  if (currentView === "reader") {
    // 沉浸阅读模式：根据content_type渲染不同内容
    if (note.content_type === "video") {
      return <VideoPlayer note={note} />;
    } else {
      return <ArticleReader note={note} />;
    }
  }

  if (currentView === "web") {
    return <WebView url={note.source_url} />;
  }

  if (currentView === "ai-brief") {
    return <AIBriefView noteId={note.id} title={note.title} content={note.content_text || note.content_html} />;
  }

  if (currentView === "archive") {
    return <ArchiveView noteId={note.id} />;
  }

  return null;
}

