import { NextResponse } from "next/server";
import {
  establishSupabaseSession,
  fetchBusinessUserInfo,
  findOrCreateSsoUser,
  isSsoEnabled,
  sanitizeRedirectPath,
} from "@/lib/auth/sso";

export async function POST(request: Request) {
  if (!isSsoEnabled()) {
    return NextResponse.json(
      { error: "SSO 登录未启用，请配置 SSO_ENABLED=true" },
      { status: 503 }
    );
  }

  let body: { login_id?: string; login_tid?: string; redirect?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const login_id = body.login_id?.trim();
  const login_tid = body.login_tid?.trim();
  if (!login_id || !login_tid) {
    return NextResponse.json(
      { error: "缺少 login_id 或 login_tid" },
      { status: 400 }
    );
  }

  const redirectTo = sanitizeRedirectPath(body.redirect);

  try {
    const businessUser = await fetchBusinessUserInfo({ login_id, login_tid });
    const { userId, email, isNewUser } = await findOrCreateSsoUser(businessUser);
    await establishSupabaseSession(email);

    return NextResponse.json({
      ok: true,
      userId,
      email,
      isNewUser,
      redirectTo,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SSO 登录失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
