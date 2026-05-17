import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants";
import { getAuth, setAuth, clearAuth } from "./storage";
import type { AuthData } from "./types";

/** Login with email and password */
export async function login(email: string, password: string): Promise<AuthData> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || "登录失败");
  }

  const data = await res.json();
  const auth: AuthData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: data.user.id, email: data.user.email },
  };

  await setAuth(auth);
  return auth;
}

/** Refresh the access token */
async function refreshToken(): Promise<string> {
  const auth = await getAuth();
  if (!auth) throw new Error("NOT_AUTHENTICATED");

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });

  if (!res.ok) {
    await clearAuth();
    throw new Error("SESSION_EXPIRED");
  }

  const data = await res.json();
  const updated: AuthData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: data.user.id, email: data.user.email },
  };

  await setAuth(updated);
  return updated.accessToken;
}

/** Get a valid access token (auto-refreshes if expired) */
export async function getToken(): Promise<string | null> {
  const auth = await getAuth();
  if (!auth) return null;

  // Refresh if expires in less than 60 seconds
  if (auth.expiresAt - Date.now() < 60_000) {
    try {
      return await refreshToken();
    } catch {
      return null;
    }
  }

  return auth.accessToken;
}

/** Check if user is logged in */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}

/** Logout */
export async function logout(): Promise<void> {
  const auth = await getAuth();
  if (auth) {
    // Try to revoke token on server (best-effort)
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    }).catch(() => {});
  }
  await clearAuth();
}

/** Get current user info */
export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const auth = await getAuth();
  return auth?.user || null;
}
