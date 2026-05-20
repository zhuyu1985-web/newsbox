export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validatePasswordChange({
  currentPassword,
  newPassword,
  confirmPassword,
}: PasswordChangeInput): string | null {
  if (!currentPassword) return "请输入当前密码";
  if (newPassword.length < PASSWORD_MIN_LENGTH) return "新密码至少 8 位";
  if (newPassword !== confirmPassword) return "两次输入的新密码不一致";
  if (currentPassword === newPassword) return "新密码不能与当前密码相同";
  return null;
}

export function getPasswordChangeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials")
  ) {
    return "当前密码不正确，请重新输入";
  }

  if (
    lower.includes("auth session") ||
    lower.includes("jwt") ||
    lower.includes("session")
  ) {
    return "登录状态已过期，请重新登录后再修改密码";
  }

  return message || "密码更新失败，请稍后重试";
}
