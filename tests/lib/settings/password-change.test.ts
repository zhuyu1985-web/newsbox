import { describe, expect, it } from "vitest";
import {
  getPasswordChangeErrorMessage,
  validatePasswordChange,
} from "@/lib/settings/password-change";

describe("password change helpers", () => {
  it("requires the current password before changing password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      })
    ).toBe("请输入当前密码");
  });

  it("requires a strong enough new password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "old-password",
        newPassword: "1234567",
        confirmPassword: "1234567",
      })
    ).toBe("新密码至少 8 位");
  });

  it("requires matching confirmation", () => {
    expect(
      validatePasswordChange({
        currentPassword: "old-password",
        newPassword: "new-password-123",
        confirmPassword: "different-password",
      })
    ).toBe("两次输入的新密码不一致");
  });

  it("maps invalid login credentials to current-password copy", () => {
    expect(
      getPasswordChangeErrorMessage(new Error("Invalid login credentials"))
    ).toBe("当前密码不正确，请重新输入");
  });
});
