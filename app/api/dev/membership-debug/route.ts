/**
 * 调试：查看当前用户会员状态
 * GET /api/dev/membership-debug
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateMembershipStatus } from "@/lib/services/membership";

export async function GET() {
  // 仅在开发环境可用
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();

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

    // 获取原始数据库记录
    const { data: rawMembership, error: dbError } = await supabase
      .from("user_memberships")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // 计算会员状态
    const calculatedStatus = calculateMembershipStatus(rawMembership);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      rawDatabaseRecord: rawMembership,
      dbError: dbError?.message,
      calculatedStatus,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Dev] Membership debug error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: String(error) },
      { status: 500 }
    );
  }
}
