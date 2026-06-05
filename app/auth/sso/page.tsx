import { Suspense } from "react";
import { SsoLoginHandler } from "@/components/auth/sso-login-handler";
import { Loader2 } from "lucide-react";

function SsoFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
    </div>
  );
}

export default function SsoLoginPage() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-6 md:p-10">
      <div className="absolute top-0 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px] -z-10" />
      <Suspense fallback={<SsoFallback />}>
        <SsoLoginHandler />
      </Suspense>
    </div>
  );
}
