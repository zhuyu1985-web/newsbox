import { getToken } from "./auth";
import { getApiUrl } from "./storage";
import type { SaveNoteRequest, SaveNoteResponse, MetaResponse } from "./types";
import type { VideoCapture } from "../content/video-extractors/base";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError(401, "NOT_AUTHENTICATED");

  const baseUrl = await getApiUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, err.error || "Request failed");
  }

  return res.json();
}

export interface SaveVideoResponse {
  noteId: string;
  jobId: string;
}

export interface RequestUploadCredResponse {
  jobId: string;
  noteId: string;
  cosKey: string;
  uploadUrl: string;
  method: string;
  headers?: Record<string, string>;
  publicUrl: string;
  expiresAt: number;
}

export interface ReportUploadDoneResponse {
  ok: boolean;
}

export const api = {
  /** Save a note from extension-extracted content */
  saveNote(data: SaveNoteRequest): Promise<SaveNoteResponse> {
    return request("/api/extension/save", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** Get user's folders and tags */
  getMeta(): Promise<MetaResponse> {
    return request("/api/extension/meta");
  },

  /** Save a video note via server-side download (A path) */
  saveVideo(body: { capture: VideoCapture }): Promise<SaveVideoResponse> {
    return request("/api/extension/save-video", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Request a pre-signed upload credential for browser-side upload (B path) */
  requestUploadCred(body: {
    capture: VideoCapture;
    ext: string;
    contentType: string;
  }): Promise<RequestUploadCredResponse> {
    return request("/api/extension/video-upload-cred", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Report that browser-side upload is done (B path) */
  reportUploadDone(body: {
    jobId: string;
    cosKey: string;
    sizeBytes: number;
  }): Promise<ReportUploadDoneResponse> {
    return request("/api/extension/video-upload-done", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
