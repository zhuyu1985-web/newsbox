"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("两次输入的密码不一致");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册过程中发生错误");
    } finally {
      setIsLoading(false);
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
                <Button type="submit" className="w-full h-11 rounded-xl text-base font-semibold shadow-blue-500/20" disabled={isLoading}>
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
