"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LogOut, RefreshCw, ShieldCheck, Smartphone, Mail, MessageCircle } from "lucide-react";

export function AccountSection({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const validatePassword = () => {
    const p = newPassword.trim();
    if (p.length < 8) return "密码至少 8 位";
    if (p !== confirmPassword.trim()) return "两次输入的密码不一致";
    return null;
  };

  const onUpdatePassword = async () => {
    const err = validatePassword();
    if (err) {
      setMsg({ type: "error", text: err });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ type: "success", text: "密码已更新" });
    } catch (e: any) {
      const raw = String(e?.message ?? "");
      const friendly =
        raw.includes("Auth session") || raw.includes("JWT") || raw.includes("session")
          ? "登录状态已过期，请重新登录后再修改密码"
          : raw || "更新失败";
      setMsg({ type: "error", text: friendly });
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-base font-bold text-slate-900">我的账户</h3>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#f5f5f7] rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-slate-500 mb-2">用户名</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {user.email?.split("@")[0] ?? "用户"}
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    修改（占位）
                  </Button>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">密码</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900">••••••••</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUpdatePassword}
                    disabled={saving || Boolean(validatePassword())}
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "修改密码"}
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">新密码</Label>
                    <div className="relative mt-2">
                      <Input
                        type={showNew ? "text" : "password"}
                        placeholder="至少 8 位"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setMsg(null);
                        }}
                        className="bg-white pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        onClick={() => setShowNew((v) => !v)}
                        aria-label={showNew ? "隐藏密码" : "显示密码"}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500">确认密码</Label>
                    <div className="relative mt-2">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="再次输入"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setMsg(null);
                        }}
                        className="bg-white pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? "隐藏密码" : "显示密码"}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  建议使用更强的密码（包含字母/数字/符号）。
                </div>

                {msg ? (
                  <div
                    className={
                      msg.type === "success"
                        ? "text-xs text-green-600 mt-2"
                        : "text-xs text-red-600 mt-2"
                    }
                  >
                    {msg.text}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">NewsBox Pro+AI</div>
                <div className="text-xs text-slate-500 mt-1">有效期：占位</div>
              </div>
              <Button size="sm" className="rounded-full px-5" disabled>
                续费（占位）
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-base font-bold text-slate-900">账户绑定</h3>
          <p className="text-xs text-slate-500 mt-1">
            绑定更多账号后可以使用任意账号快捷登录（本期：UI入口占位，不做真实微信/短信接入）
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BindingRow
            icon={<Mail className="h-5 w-5 text-blue-600" />}
            label="邮箱"
            sub={user.email ?? "未绑定"}
            action={<Button size="sm">添加邮箱（占位）</Button>}
          />
          <BindingRow
            icon={<Smartphone className="h-5 w-5 text-sky-600" />}
            label="手机"
            sub="未绑定"
            action={<Button size="sm" variant="outline">更改手机（占位）</Button>}
          />
          <BindingRow
            icon={<MessageCircle className="h-5 w-5 text-green-600" />}
            label="微信"
            sub="未绑定"
            action={<Button size="sm">绑定（占位）</Button>}
          />
          <BindingRow
            icon={<ShieldCheck className="h-5 w-5 text-slate-700" />}
            label="安全"
            sub="建议开启更多保护（占位）"
            action={<Button size="sm" variant="outline" disabled>设置</Button>}
          />
        </div>

        <div className="px-6 py-5 border-t border-black/5 flex items-center justify-between">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录 / 切换账号
          </Button>
          <Button variant="ghost" className="text-slate-400 hover:text-slate-600" disabled>
            删除账户（占位）
          </Button>
        </div>
      </div>
    </div>
  );
}

function BindingRow({
  icon,
  label,
  sub,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[#f5f5f7] rounded-2xl p-5">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-white border border-black/5 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500 truncate mt-0.5">{sub}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}


