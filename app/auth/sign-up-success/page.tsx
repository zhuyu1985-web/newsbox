import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2, Home, LogIn } from "lucide-react";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[100px] rounded-full -z-10" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                注册成功
              </CardTitle>
              <CardDescription className="text-slate-500">
                我们已向您的邮箱发送验证邮件
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                请前往邮箱点击验证链接完成激活，然后再返回登录。
                <span className="block mt-1 text-xs text-slate-500">
                  若未收到邮件，请检查垃圾箱/订阅邮件，或稍后重试。
                </span>
              </p>

              <div className="grid grid-cols-1 gap-3">
                <Button asChild className="h-11 rounded-xl text-base font-semibold">
                  <Link href="/auth/login">
                    <LogIn className="h-4 w-4" />
                    去登录
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-xl text-base font-semibold"
                >
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    返回首页
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
