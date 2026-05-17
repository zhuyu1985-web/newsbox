import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardAuthCheck } from "@/components/dashboard/dashboard-auth-check";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-background">
      {/* 顶部工具条占位 */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
      {/* 卡片网格占位 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardAuthCheck>
        <DashboardContent />
      </DashboardAuthCheck>
    </Suspense>
  );
}

