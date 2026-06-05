import type { BusinessSsoUser } from "./types";
import { getSsoEmailDomain, getSsoEmailSuffix } from "./config";

type CmcUserInfo = {
  login_name?: string;
  user_nick?: string;
  real_name?: string;
  user_mobile?: string;
  user_email?: string;
  user_pic?: string;
  id?: string | number;
};

type CmcAuthData = {
  login_id?: string;
  user_info?: CmcUserInfo;
};

function pickString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function isBusinessApiSuccess(code: unknown): boolean {
  return (
    code === 10000 ||
    code === "10000" ||
    code === 0 ||
    code === "0" ||
    code === 200 ||
    code === "200"
  );
}

/**
 * 业务手机号 → 系统邮箱：{mobile}@gmail.com（后缀可配置，默认 gmail.com）
 */
export function mobileToSystemEmail(mobile: string): string {
  const normalized = mobile.trim();
  if (!normalized) {
    throw new Error("业务系统未返回有效的 user_mobile");
  }
  return `${normalized}@${getSsoEmailSuffix()}`;
}

function resolveEmail(userInfo: CmcUserInfo, loginId: string): string {
  const mobile = pickString(userInfo.user_mobile);
  if (mobile) {
    return mobileToSystemEmail(mobile);
  }

  const directEmail = pickString(userInfo.user_email);
  if (directEmail) {
    return directEmail.toLowerCase();
  }

  return `${loginId}@${getSsoEmailDomain()}`;
}

/**
 * 解析 CMC get-login-auth 返回报文。
 * 用户信息在 data.user_info；昵称取 login_name；邮箱由 user_mobile 转换。
 */
export function parseCmcAuthResponse(
  json: unknown,
  fallbackLoginId: string
): BusinessSsoUser {
  if (!json || typeof json !== "object") {
    throw new Error("业务系统返回了无效的用户信息");
  }

  const root = json as Record<string, unknown>;

  if (root.code !== undefined || root.success !== undefined) {
    const code = root.code ?? root.success;
    if (!isBusinessApiSuccess(code) && root.success !== true) {
      const message =
        pickString(
          typeof root.message === "string" ? root.message : null,
          typeof root.msg === "string" ? root.msg : null,
          typeof root.error === "string" ? root.error : null
        ) ?? "业务系统验票失败";
      throw new Error(message);
    }
  }

  const data =
    root.data && typeof root.data === "object"
      ? (root.data as CmcAuthData)
      : null;

  if (!data) {
    throw new Error("业务系统返回缺少 data 节点");
  }

  const userInfo =
    data.user_info && typeof data.user_info === "object"
      ? data.user_info
      : ({} as CmcUserInfo);

  const login_id = pickString(data.login_id, fallbackLoginId);
  if (!login_id) {
    throw new Error("业务系统未返回有效的 login_id");
  }

  return {
    login_id,
    email: resolveEmail(userInfo, login_id),
    full_name: pickString(
      userInfo.login_name,
      userInfo.user_nick,
      userInfo.real_name
    ),
    avatar_url: pickString(userInfo.user_pic),
  };
}
