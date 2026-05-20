export const ADMIN_AUTH_STORAGE_KEY = "newsbox_admin_auth";

export function encodeAdminAuthToken(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

export function storeAdminAuthToken(token: string) {
  window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, token);
}

export function clearAdminAuthToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

export function getAdminAuthHeaders(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const token = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!token) return null;
  return { Authorization: `Basic ${token}` };
}
