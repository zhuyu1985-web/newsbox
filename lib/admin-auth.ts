/**
 * 后台 Admin 的 HTTP Basic Auth 守门工具
 *
 * 同时被两处使用：
 *   1. 项目根 proxy.ts → lib/supabase/proxy.ts：拦截 /admin/* 与 /api/admin/*
 *   2. /api/admin/* 内部再校一次（防御 middleware 被绕过的 CVE 类问题）
 *
 * 凭据来自 .env.local：ADMIN_USER / ADMIN_PASS
 */

export interface AdminAuthDecoded {
  user: string;
  pass: string;
}

export function decodeBasicAuthHeader(authHeader: string | null): AdminAuthDecoded | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf-8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return {
    user: decoded.slice(0, idx),
    pass: decoded.slice(idx + 1),
  };
}

export function getExpectedAdminCredentials(): { user: string; pass: string } | null {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) return null;
  return { user, pass };
}

export function verifyAdminAuth(authHeader: string | null): boolean {
  const expected = getExpectedAdminCredentials();
  if (!expected) return false;
  const got = decodeBasicAuthHeader(authHeader);
  if (!got) return false;
  return got.user === expected.user && got.pass === expected.pass;
}

export const BASIC_AUTH_REALM = 'Basic realm="Newsbox Admin", charset="UTF-8"';
