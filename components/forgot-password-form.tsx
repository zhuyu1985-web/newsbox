"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Mail } from "lucide-react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">忘记密码？</CardTitle>
          <CardDescription>
            当前部署在内网环境，未启用邮件服务。请联系管理员重置密码。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
            <Mail className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p>请通过内部沟通渠道联系系统管理员，提供：</p>
              <ul className="list-disc list-inside ml-1 text-slate-500 dark:text-slate-400">
                <li>你的登录邮箱</li>
                <li>身份验证信息（按公司规范）</li>
              </ul>
              <p className="pt-1">
                管理员会为你生成新密码，首次登录后请尽快修改。
              </p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/login">返回登录</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
