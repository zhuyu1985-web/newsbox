import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipStatus, initializeTrial } from "@/lib/services/membership";

export async function DashboardAuthCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 检查会员状态
  const membershipStatus = await getMembershipStatus(user.id, supabase);

  // 调试日志
  console.log("[DashboardAuthCheck] User:", user.id);
  console.log("[DashboardAuthCheck] Membership status:", JSON.stringify(membershipStatus, null, 2));

  // 如果是新用户（没有会员记录），初始化试用期
  if (membershipStatus.planType === "none") {
    console.log("[DashboardAuthCheck] New user, initializing trial");
    await initializeTrial(user.id);
    // 重新获取状态，此时应该是 trial
    const newStatus = await getMembershipStatus(user.id, supabase);
    console.log("[DashboardAuthCheck] After init trial:", JSON.stringify(newStatus, null, 2));
    if (!newStatus.isActive) {
      redirect("/pricing?reason=expired");
    }
    return <>{children}</>;
  }

  // 检查会员是否有效（试用期或付费会员未过期）
  if (!membershipStatus.isActive) {
    console.log("[DashboardAuthCheck] Membership not active, redirecting to pricing");
    // 会员已过期，重定向到 pricing 页面
    const reason = membershipStatus.isTrialExpired ? "trial_expired" : "expired";
    redirect(`/pricing?reason=${reason}`);
  }

  console.log("[DashboardAuthCheck] Access granted");
  return <>{children}</>;
}

