import type { AuthData } from "./types";
import { NEWSBOX_API_URL } from "./constants";

const KEYS = {
  AUTH: "newsbox_auth",
  THEME: "newsbox_theme",
  API_URL: "newsbox_api_url",
} as const;

export async function getAuth(): Promise<AuthData | null> {
  const result = await chrome.storage.local.get(KEYS.AUTH);
  return result[KEYS.AUTH] || null;
}

export async function setAuth(auth: AuthData): Promise<void> {
  await chrome.storage.local.set({ [KEYS.AUTH]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(KEYS.AUTH);
}

export async function getTheme(): Promise<"light" | "dark" | "system"> {
  const result = await chrome.storage.local.get(KEYS.THEME);
  return result[KEYS.THEME] || "system";
}

export async function setTheme(theme: "light" | "dark" | "system"): Promise<void> {
  await chrome.storage.local.set({ [KEYS.THEME]: theme });
}

/** Get the configured API URL (falls back to build-time default) */
export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.API_URL);
  return (result[KEYS.API_URL] as string) || NEWSBOX_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  // Strip trailing slash for consistency
  const cleaned = url.replace(/\/+$/, "");
  await chrome.storage.local.set({ [KEYS.API_URL]: cleaned });
}

/** Build-time default — used as fallback when nothing is configured */
export const DEFAULT_API_URL = NEWSBOX_API_URL;
