"use client";

/**
 * /admin/users —— 后台用户管理
 *
 * 鉴权：浏览器原生 Basic Auth 弹窗（由 proxy.ts 中间件触发）。
 * 通过后浏览器会在同源后续请求自动附带 Authorization 头，
 * 因此 fetch /api/admin/users 不需要手动传凭据。
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function formatTime(t: string | null): string {
  if (!t) return "—";
  return new Date(t).toLocaleString("zh-CN", { hour12: false });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      setMessage({ type: "ok", text: `已创建：${json.user.email}` });
      setEmail("");
      setPassword("");
      await fetchUsers();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, email: string | null) {
    if (!confirm(`确认删除用户 ${email ?? id}？此操作不可恢复。`)) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "删除失败");
      setMessage({ type: "ok", text: `已删除：${email ?? id}` });
      await fetchUsers();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10">
      <div className="mx-auto w-full max-w-5xl px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
            <p className="mt-1 text-sm text-slate-500">
              后台手工添加用户。当前已关闭自助注册，仅此入口创建账号。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            {loading ? "刷新中..." : "刷新"}
          </Button>
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>添加用户</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">初始密码</Label>
                <Input
                  id="password"
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={creating} className="h-10">
                {creating ? "创建中..." : "创建用户"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              创建后 email_confirm 默认为 true，用户可直接登录，无需邮件验证。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用户列表（{users.length}）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">邮箱</th>
                    <th className="px-4 py-2 text-left font-medium">创建时间</th>
                    <th className="px-4 py-2 text-left font-medium">最近登录</th>
                    <th className="px-4 py-2 text-left font-medium">邮箱已确认</th>
                    <th className="px-4 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        暂无用户
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-slate-200 dark:border-slate-800"
                    >
                      <td className="px-4 py-2 font-mono text-xs">{u.email ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{formatTime(u.created_at)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {formatTime(u.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {u.email_confirmed_at ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(u.id, u.email)}
                          className="h-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
