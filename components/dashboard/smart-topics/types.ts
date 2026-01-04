import type { TopicRow as BaseTopicRow } from "@/app/api/knowledge/topics/rebuild/route";

export interface TopicNote {
  id: string;
  title: string | null;
  excerpt: string | null;
  content_text: string | null;
  source_url: string | null;
  site_name: string | null;
  published_at: string | null;
  created_at: string;
  content_type: "article" | "video" | "audio";
  cover_image_url: string | null;
}

export interface TopicMember {
  topicId: string;
  noteId: string;
  score: number | null;
  time: string;
  event_time: string | null;
  source: string;
  manual_state: string | null;
  note: TopicNote;
}

export interface TopicEvent {
  id: string;
  topic_id: string;
  event_time: string;
  title: string | null;
  summary: string | null;
  importance: number;
  evidence: TopicMember[];
}

export interface TopicDetail {
  topic: BaseTopicRow & { stats?: any; category?: string };
  members: TopicMember[];
  timeline: TopicMember[];
  events: TopicEvent[];
}

export type TopicSubView = "list" | "timeline" | "report";
