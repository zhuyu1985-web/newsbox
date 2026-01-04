import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardAuthCheck } from "@/components/dashboard/dashboard-auth-check";

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    }>
      <DashboardAuthCheck>
        <DashboardContent />
      </DashboardAuthCheck>
    </Suspense>
  );
}

