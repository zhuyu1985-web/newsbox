/**
 * 会员状态 API
 * GET /api/membership/status - 获取当前用户的会员状态
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getMembershipStatus,
  PLAN_NAMES,
  PLAN_PRICES,
  TRIAL_DAYS,
} from "@/lib/services/membership";

export async function GET() {
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

    const status = await getMembershipStatus(user.id, supabase);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        planName: PLAN_NAMES[status.planType],
        expiresAt: status.expiresAt?.toISOString() || null,
        plans: {
          pro: { name: PLAN_NAMES.pro, price: PLAN_PRICES.pro },
          ai: { name: PLAN_NAMES.ai, price: PLAN_PRICES.ai },
        },
        trialDays: TRIAL_DAYS,
      },
    });
  } catch (error) {
    console.error("[API] /membership/status error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "获取会员状态失败" },
      { status: 500 }
    );
  }
}
