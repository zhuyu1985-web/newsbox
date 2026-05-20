"use client";

import { cn } from "@/lib/utils";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { useState } from "react";

import { motion } from "framer-motion";

// 暂时隐藏第三方注册入口（Google / GitHub），改为 false 即可恢复
const ENABLE_OAUTH = false;

// SVG logos for OAuth providers
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
);

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("两次输入的密码不一致");
      setIsLoading(false);
      return;
    }

    try {
      if (!isSupabaseClientConfigured()) {
        throw new Error("Supabase 未配置，请先设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。");
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;

      // Supabase 开启 ENABLE_EMAIL_AUTOCONFIRM 时，signUp 直接返回 session → 跳过"请查收邮件"页面
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/auth/sign-up-success");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册过程中发生错误");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setError(null);

    try {
      if (!isSupabaseClientConfigured()) {
        throw new Error("Supabase 未配置，请先设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "OAuth 注册过程中发生错误");
      setOauthLoading(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">注册</CardTitle>
          <CardDescription className="text-slate-500">
            创建新账户以开启 NewsBox 之旅
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 ml-1">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border-slate-200/60 bg-white/50 focus:bg-white focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" title="password" className="text-slate-700 dark:text-slate-300 ml-1">密码</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border-slate-200/60 bg-white/50 focus:bg-white focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password" title="repeat-password" className="text-slate-700 dark:text-slate-300 ml-1">确认密码</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="rounded-xl border-slate-200/60 bg-white/50 focus:bg-white focus:ring-blue-500/20 transition-all"
                />
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium text-red-500 bg-red-50 p-2 rounded-lg border border-red-100"
                >
                  {error}
                </motion.p>
              )}
              <div className="grid gap-3">
                <Button type="submit" className="w-full h-11 rounded-xl text-base font-semibold shadow-blue-500/20" disabled={isLoading || oauthLoading !== null}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>正在创建...</span>
                    </div>
                  ) : "注册账户"}
                </Button>
                <Button asChild variant="outline" className="w-full h-11 rounded-xl text-base font-semibold border-slate-200/60 bg-white/50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 transition-all">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                    返回首页
                  </Link>
                </Button>
              </div>

              {ENABLE_OAUTH && (
                <>
                  {/* OAuth Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">或</span>
                    </div>
                  </div>

                  {/* OAuth Buttons */}
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-xl text-base font-semibold bg-white dark:bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-100 transition-all"
                      onClick={() => handleOAuthSignUp("google")}
                      disabled={isLoading || oauthLoading !== null}
                    >
                      {oauthLoading === "google" ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                          <span>正在连接...</span>
                        </div>
                      ) : (
                        <>
                          <GoogleIcon />
                          <span className="ml-2">使用 Google 注册</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-xl text-base font-semibold bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-700 transition-all"
                      onClick={() => handleOAuthSignUp("github")}
                      disabled={isLoading || oauthLoading !== null}
                    >
                      {oauthLoading === "github" ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>正在连接...</span>
                        </div>
                      ) : (
                        <>
                          <GitHubIcon />
                          <span className="ml-2">使用 GitHub 注册</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 text-center text-sm text-slate-500">
              已有账户？{" "}
              <Link
                href="/auth/login"
                className="font-bold text-blue-600 hover:underline underline-offset-4"
              >
                立即登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
