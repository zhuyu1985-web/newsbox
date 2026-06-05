import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server-service";
import { initializeTrialWithClient } from "@/lib/services/membership";
import type { BusinessSsoUser } from "./types";
import { getSsoExternalSource } from "./config";

function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

async function findAuthUserByEmail(email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const matched = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );
    if (matched) return matched;
    if (data.users.length < 1000) return null;
    page += 1;
  }

  return null;
}

async function findAuthUserByExternalLoginId(loginId: string) {
  const supabase = createServiceClient();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const matched = data.users.find(
      (user) => user.user_metadata?.external_login_id === loginId
    );
    if (matched) return matched;
    if (data.users.length < 1000) return null;
    page += 1;
  }

  return null;
}

async function ensureProfileAndTrial(
  userId: string,
  businessUser: BusinessSsoUser
) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const externalSource = getSsoExternalSource();

  const profileRow: Record<string, unknown> = {
    id: userId,
    email: businessUser.email,
    full_name: businessUser.full_name ?? null,
    avatar_url: businessUser.avatar_url ?? null,
    updated_at: now,
  };

  // migration 030 已执行时写入映射字段；未执行时跳过，避免阻塞 SSO 登录
  try {
    const probe = await supabase
      .from("profiles")
      .select("external_login_id")
      .limit(1);
    if (!probe.error) {
      profileRow.external_login_id = businessUser.login_id;
      profileRow.external_source = externalSource;
    }
  } catch {
    // ignore probe errors
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profileRow as never, { onConflict: "id" });

  if (profileError) {
    throw new Error(`初始化用户资料失败：${profileError.message}`);
  }

  const trialOk = await initializeTrialWithClient(userId, supabase);
  if (!trialOk) {
    throw new Error("初始化用户试用期失败");
  }
}

export async function findOrCreateSsoUser(
  businessUser: BusinessSsoUser
): Promise<{ userId: string; email: string; isNewUser: boolean }> {
  const supabase = createServiceClient();
  const externalSource = getSsoExternalSource();

  // 1. 优先按手机号转换后的邮箱关联（如 13027023530@gmail.com）
  let authUser = await findAuthUserByEmail(businessUser.email);
  if (authUser) {
    await ensureProfileAndTrial(authUser.id, businessUser);
    return {
      userId: authUser.id,
      email: businessUser.email,
      isNewUser: false,
    };
  }

  // 2. 按业务 login_id（存于 user_metadata）关联
  authUser = await findAuthUserByExternalLoginId(businessUser.login_id);
  if (authUser) {
    await ensureProfileAndTrial(authUser.id, businessUser);
    return {
      userId: authUser.id,
      email: businessUser.email,
      isNewUser: false,
    };
  }

  // 3. 新建用户
  const { data, error } = await supabase.auth.admin.createUser({
    email: businessUser.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      external_login_id: businessUser.login_id,
      external_source: externalSource,
      full_name: businessUser.full_name ?? null,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "创建 SSO 用户失败");
  }

  await ensureProfileAndTrial(data.user.id, businessUser);

  return {
    userId: data.user.id,
    email: businessUser.email,
    isNewUser: true,
  };
}
