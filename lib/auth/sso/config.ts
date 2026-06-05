export function isSsoEnabled(): boolean {
  return process.env.SSO_ENABLED === "true";
}

export function getSsoUserInfoApiUrl(): string {
  const url = process.env.SSO_USER_INFO_API_URL?.trim();
  if (!url) {
    throw new Error("SSO_USER_INFO_API_URL is not configured");
  }
  return url;
}

export function getSsoAccessKeyId(): string {
  const value = process.env.SSO_ACCESS_KEY_ID?.trim();
  if (!value) {
    throw new Error("SSO_ACCESS_KEY_ID is not configured");
  }
  return value;
}

export function getSsoAccessKeySecret(): string {
  const value = process.env.SSO_ACCESS_KEY_SECRET?.trim();
  if (!value) {
    throw new Error("SSO_ACCESS_KEY_SECRET is not configured");
  }
  return value;
}

export function getSsoServiceKey(): string {
  const value = process.env.SSO_SERVICE_KEY?.trim();
  if (!value) {
    throw new Error("SSO_SERVICE_KEY is not configured");
  }
  return value;
}

export function getSsoEmailDomain(): string {
  return (process.env.SSO_EMAIL_DOMAIN ?? "sso.newsbox.local").trim();
}

/** 手机号转系统邮箱的后缀，默认 gmail.com → 18200121923@gmail.com */
export function getSsoEmailSuffix(): string {
  return (process.env.SSO_EMAIL_SUFFIX ?? "gmail.com").trim();
}

export function getSsoExternalSource(): string {
  return (process.env.SSO_EXTERNAL_SOURCE ?? "business").trim();
}

export function getSsoApiTimeoutMs(): number {
  const raw = Number(process.env.SSO_API_TIMEOUT_MS ?? "10000");
  return Number.isFinite(raw) && raw > 0 ? raw : 10000;
}
