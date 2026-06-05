import type { BusinessSsoUser, SsoLoginParams } from "./types";
import {
  getSsoAccessKeyId,
  getSsoAccessKeySecret,
  getSsoApiTimeoutMs,
  getSsoServiceKey,
  getSsoUserInfoApiUrl,
} from "./config";
import { parseCmcAuthResponse } from "./parse-response";
import { buildSignedAuthUrl } from "./signature";

function pickString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function extractErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const root = json as Record<string, unknown>;
    const message = pickString(
      typeof root.message === "string" ? root.message : null,
      typeof root.msg === "string" ? root.msg : null,
      typeof root.error === "string" ? root.error : null
    );
    if (message) return message;
  }
  return `业务系统验票失败（HTTP ${status}）`;
}

/**
 * 携带 login_id / login_tid，按 HMAC-SHA1 签名规则调用业务授权接口。
 * 接口：GET {SSO_USER_INFO_API_URL}?login_id=...&login_tid=...&AccessKeyId=...
 */
export async function fetchBusinessUserInfo(
  params: SsoLoginParams
): Promise<BusinessSsoUser> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getSsoApiTimeoutMs());

  const signedUrl = buildSignedAuthUrl(getSsoUserInfoApiUrl(), {
    login_id: params.login_id,
    login_tid: params.login_tid,
    accessKeyId: getSsoAccessKeyId(),
    accessKeySecret: getSsoAccessKeySecret(),
    serviceKey: getSsoServiceKey(),
  });

  try {
    const response = await fetch(signedUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("业务系统返回了非 JSON 响应");
      }
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(json, response.status));
    }

    return parseCmcAuthResponse(json, params.login_id);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("业务系统验票超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
