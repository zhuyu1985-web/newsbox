/**
 * 会员到期检查 Edge Function
 * 每天运行一次，查找即将到期的会员并发送通知
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface MembershipRecord {
  user_id: string;
  plan_type: string;
  expires_at: string;
}

interface NotificationRecord {
  user_id: string;
  type: string;
  created_at: string;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 查找 7 天内到期的会员
    const { data: expiringIn7Days } = await supabase
      .from("user_memberships")
      .select("user_id, plan_type, expires_at")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysFromNow.toISOString())
      .in("plan_type", ["pro", "ai"]);

    // 查找 3 天内到期的会员
    const { data: expiringIn3Days } = await supabase
      .from("user_memberships")
      .select("user_id, plan_type, expires_at")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", threeDaysFromNow.toISOString())
      .in("plan_type", ["pro", "ai"]);

    // 查找已经过期的会员（最近 24 小时内过期）
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: justExpired } = await supabase
      .from("user_memberships")
      .select("user_id, plan_type, expires_at")
      .gte("expires_at", oneDayAgo.toISOString())
      .lt("expires_at", now.toISOString())
      .in("plan_type", ["pro", "ai"]);

    const notifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      link: string;
    }> = [];

    // 处理 7 天到期提醒（排除已经发过通知的）
    if (expiringIn7Days?.length) {
      const userIds = expiringIn7Days.map((m: MembershipRecord) => m.user_id);
      const { data: existingNotifications } = await supabase
        .from("user_notifications")
        .select("user_id, type, created_at")
        .in("user_id", userIds)
        .eq("type", "membership_expiring_7d")
        .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const notifiedUsers = new Set(existingNotifications?.map((n: NotificationRecord) => n.user_id) || []);

      for (const membership of expiringIn7Days as MembershipRecord[]) {
        if (notifiedUsers.has(membership.user_id)) continue;

        const expiresAt = new Date(membership.expires_at);
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        if (daysRemaining > 3) {
          // 只在 4-7 天时发送 7 天提醒
          notifications.push({
            user_id: membership.user_id,
            type: "membership_expiring_7d",
            title: "会员即将到期",
            message: `您的 ${getPlanName(membership.plan_type)} 会员将在 ${daysRemaining} 天后到期，请及时续费以继续享受服务。`,
            link: "/pricing",
          });
        }
      }
    }

    // 处理 3 天到期提醒
    if (expiringIn3Days?.length) {
      const userIds = expiringIn3Days.map((m: MembershipRecord) => m.user_id);
      const { data: existingNotifications } = await supabase
        .from("user_notifications")
        .select("user_id, type, created_at")
        .in("user_id", userIds)
        .eq("type", "membership_expiring_3d")
        .gte("created_at", new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString());

      const notifiedUsers = new Set(existingNotifications?.map((n: NotificationRecord) => n.user_id) || []);

      for (const membership of expiringIn3Days as MembershipRecord[]) {
        if (notifiedUsers.has(membership.user_id)) continue;

        const expiresAt = new Date(membership.expires_at);
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        notifications.push({
          user_id: membership.user_id,
          type: "membership_expiring_3d",
          title: "会员即将到期提醒",
          message: `您的 ${getPlanName(membership.plan_type)} 会员将在 ${daysRemaining} 天后到期，为避免服务中断，请尽快续费。`,
          link: "/pricing",
        });
      }
    }

    // 处理刚过期的提醒
    if (justExpired?.length) {
      const userIds = justExpired.map((m: MembershipRecord) => m.user_id);
      const { data: existingNotifications } = await supabase
        .from("user_notifications")
        .select("user_id, type, created_at")
        .in("user_id", userIds)
        .eq("type", "membership_expired")
        .gte("created_at", oneDayAgo.toISOString());

      const notifiedUsers = new Set(existingNotifications?.map((n: NotificationRecord) => n.user_id) || []);

      for (const membership of justExpired as MembershipRecord[]) {
        if (notifiedUsers.has(membership.user_id)) continue;

        notifications.push({
          user_id: membership.user_id,
          type: "membership_expired",
          title: "会员已过期",
          message: `您的 ${getPlanName(membership.plan_type)} 会员已过期，部分功能将受限。续费后可恢复所有权益。`,
          link: "/pricing",
        });
      }
    }

    // 批量插入通知
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("user_notifications")
        .insert(notifications);

      if (insertError) {
        console.error("Failed to insert notifications:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: {
          expiringIn7Days: expiringIn7Days?.length || 0,
          expiringIn3Days: expiringIn3Days?.length || 0,
          justExpired: justExpired?.length || 0,
          notificationsSent: notifications.length,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Membership expiry check error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function getPlanName(planType: string): string {
  switch (planType) {
    case "pro":
      return "NewsBox Pro";
    case "ai":
      return "NewsBox AI";
    default:
      return "NewsBox";
  }
}
