export * from "./types";
export { isSsoEnabled } from "./config";
export { fetchBusinessUserInfo } from "./business-client";
export {
  parseCmcAuthResponse,
  mobileToSystemEmail,
  isBusinessApiSuccess,
} from "./parse-response";
export { findOrCreateSsoUser } from "./user-service";
export { establishSupabaseSession } from "./session";

export function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path) return "/dashboard";
  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//")) return "/dashboard";
  if (path.startsWith("/auth/sso")) return "/dashboard";
  return path;
}
