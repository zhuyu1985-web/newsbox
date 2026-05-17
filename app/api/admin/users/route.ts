/**
 * Admin 用户管理 API
 *
 * 鉴权层级（防御深度）：
 *   1. proxy.ts 中间件已经拦下 /api/admin/*，校验 Basic Auth
 *   2. 这里再校一次（防御中间件被绕过：CVE-2025-29927 类）
 *
 * 操作：
 *   GET    /api/admin/users           列出所有用户
 *   POST   /api/admin/users           创建用户 { email, password }
 *   DELETE /api/admin/users?id=<uuid> 删除用户
 *
 * 全部使用 SUPABASE_SERVICE_ROLE_KEY 调用 supabase.auth.admin.*，绕过 RLS。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server-service";
import { BASIC_AUTH_REALM, verifyAdminAuth } from "@/lib/admin-auth";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": BASIC_AUTH_REALM },
  });
}

function guard(request: NextRequest): NextResponse | null {
  if (!verifyAdminAuth(request.headers.get("authorization"))) {
    return unauthorized();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const supabase = createServiceClient();
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Math.min(Number(url.searchParams.get("perPage") ?? "100"), 200);

  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  }));

  return NextResponse.json({ users, total: data.users.length });
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
