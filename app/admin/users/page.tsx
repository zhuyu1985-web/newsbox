"use client";

/**
 * /admin/users —— 后台用户管理
 *
 * 鉴权：/admin 页面收集管理员账号密码，登录成功后把 Basic token
 * 存在 sessionStorage。这里所有 /api/admin/users 请求都显式携带
 * Authorization 头，避免依赖浏览器原生 Basic Auth 弹窗。
 */

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  clearAdminAuthToken,
  getAdminAuthHeaders,
} from "@/lib/admin-client-auth";

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

type FetchUsersOptions = {
  silent?: boolean;
  preserveMessage?: boolean;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const redirectToLogin = useCallback(() => {
    clearAdminAuthToken();
    router.replace("/admin");
  }, [router]);

  const fetchUsers = useCallback(async (options: FetchUsersOptions = {}) => {
    const headers = getAdminAuthHeaders();
    if (!headers) {
      setLoading(false);
      redirectToLogin();
      return;
    }

    if (!options.silent) setLoading(true);
    if (!options.preserveMessage) setMessage(null);

    try {
      const res = await fetch(`/api/admin/users?t=${Date.now()}`, {
        cache: "no-store",
        headers,
      });
      const json = await res.json();
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "加载用户失败");
      setUsers(json.users ?? []);
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const headers = getAdminAuthHeaders();
    if (!headers) {
      redirectToLogin();
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      if (json.user) {
        setUsers((current) => {
          if (current.some((user) => user.id === json.user.id)) return current;
          return [json.user, ...current];
        });
      }
      setMessage({
        type: "ok",
        text: json.action === "updated"
          ? `已更新登录密码：${json.user.email}`
          : `已创建：${json.user.email}`,
      });
      setEmail("");
      setPassword("");
      await fetchUsers({ silent: true, preserveMessage: true });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const headers = getAdminAuthHeaders();
    if (!headers) {
      redirectToLogin();
      return;
    }

    const user = pendingDelete;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "删除失败");
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage({ type: "ok", text: `已删除：${user.email ?? user.id}` });
      setPendingDelete(null);
      await fetchUsers({ silent: true, preserveMessage: true });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeleting(false);
    }
  }

  function handleLogout() {
    clearAdminAuthToken();
    router.replace("/admin");
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchUsers()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
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
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    创建用户
                  </>
                )}
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
                  {loading && users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        加载中...
                      </td>
                    </tr>
                  )}
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
                          variant="destructive"
                          size="sm"
                          onClick={() => setPendingDelete(u)}
                          className="h-8"
                        >
                          <Trash2 className="h-4 w-4" />
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
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
        title="删除用户"
        description={`确认删除用户 ${pendingDelete?.email ?? pendingDelete?.id ?? ""}？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
