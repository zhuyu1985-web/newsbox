"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SsoState = "loading" | "error";

export function SsoLoginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SsoState>("loading");
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const login_id = searchParams.get("login_id")?.trim() ?? "";
    const login_tid = searchParams.get("login_tid")?.trim() ?? "";
    const redirect = searchParams.get("redirect")?.trim() ?? "/dashboard";
    return { login_id, login_tid, redirect };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!params.login_id || !params.login_tid) {
        setState("error");
        setError("缺少 login_id 或 login_tid，请从业务系统重新跳转。");
        return;
      }

      try {
        const response = await fetch("/api/auth/sso/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "SSO 登录失败");
        }

        if (cancelled) return;
        router.replace(payload.redirectTo ?? "/dashboard");
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setError(err instanceof Error ? err.message : "SSO 登录失败");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (state === "loading") {
    return (
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle>正在登录</CardTitle>
          <CardDescription>正在验证业务系统身份，请稍候…</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <ShieldAlert className="h-6 w-6 text-red-500" />
        </div>
        <CardTitle>登录失败</CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={() => router.replace("/auth/login")}
        >
          返回普通登录
        </Button>
      </CardContent>
    </Card>
  );
}
