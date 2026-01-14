/**
 * 开发环境：手动激活会员
 * POST /api/dev/activate-membership
 * 
 * 用于本地测试时，z-pay 无法回调的情况下手动激活会员
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // 仅在开发环境可用
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();

    // 验证用户登录
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "请先登录" },
        { status: 401 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const { planType = "ai" } = body;

    if (!["pro", "ai"].includes(planType)) {
      return NextResponse.json(
        { error: "Invalid planType", message: "无效的会员类型" },
        { status: 400 }
      );
    }

    // 计算到期时间（一年后）
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 更新会员状态 - 使用两步操作确保正确更新
    // 先尝试更新现有记录
    const { data: existingRecord } = await supabase
      .from("user_memberships")
      .select("*")
      .eq("user_id", user.id)
      .single();

    console.log("[Dev] Existing membership record:", existingRecord);

    let membershipError;
    if (existingRecord) {
      // 更新现有记录
      const { error } = await supabase
        .from("user_memberships")
        .update({
          plan_type: planType,
          expires_at: expiresAt.toISOString(),
          last_payment_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", user.id);
      membershipError = error;
    } else {
      // 插入新记录
      const { error } = await supabase
        .from("user_memberships")
        .insert({
          user_id: user.id,
          plan_type: planType,
          expires_at: expiresAt.toISOString(),
          trial_started_at: now.toISOString(), // 新用户也设置 trial_started_at
          last_payment_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      membershipError = error;
    }

    // 验证更新结果
    const { data: updatedRecord } = await supabase
      .from("user_memberships")
      .select("*")
      .eq("user_id", user.id)
      .single();

    console.log("[Dev] Updated membership record:", updatedRecord);

    if (membershipError) {
      console.error("[Dev] Failed to activate membership:", membershipError);
      return NextResponse.json(
        { error: "Failed to activate", message: membershipError.message },
        { status: 500 }
      );
    }

    console.log(`[Dev] Activated ${planType} membership for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: `已激活 ${planType === "ai" ? "NewsBox AI" : "NewsBox Pro"} 会员`,
      data: {
        planType,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Dev] Activate membership error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
