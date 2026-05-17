/** Extracted content from a web page */
export interface ExtractedContent {
  url: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  coverImageUrl: string | null;
  author: string | null;
  siteName: string | null;
  publishedAt: string | null;
  contentType: "article" | "video";
}

/** Request body for POST /api/extension/save */
export interface SaveNoteRequest {
  source_url: string;
  title?: string;
  excerpt?: string;
  content_html?: string;
  content_text?: string;
  cover_image_url?: string;
  author?: string;
  site_name?: string;
  published_at?: string;
  content_type?: "article" | "video";
  folder_id?: string;
  tag_ids?: string[];
}

/** Response from POST /api/extension/save */
export interface SaveNoteResponse {
  success: boolean;
  noteId: string;
  isNew: boolean;
  needsCapture: boolean;
}

/** Response from GET /api/extension/meta */
export interface MetaResponse {
  folders: Folder[];
  tags: Tag[];
  user: { id: string; email: string };
}

export interface Folder {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  position: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

/** Auth tokens stored in chrome.storage */
export interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string };
}

/** Messages between extension components */
export type ExtensionMessage =
  | { type: "EXTRACT_CONTENT" }
  | { type: "EXTRACT_SELECTION" }
  | { type: "SAVE_CURRENT_PAGE"; folderId?: string; tagIds?: string[] }
  | { type: "SAVE_RESULT"; success: boolean; noteId?: string; error?: string }
  | { type: "AUTH_STATE_CHANGED"; isLoggedIn: boolean };
