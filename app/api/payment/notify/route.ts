/**
 * z-pay 异步回调 API
 * GET /api/payment/notify - 处理支付完成后的异步通知
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyNotify, ZPayNotifyParams } from "@/lib/services/zpay";
import { PLAN_PRICES } from "@/lib/services/membership";

// 使用 service role 绕过 RLS，处理回调更新
function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 解析回调参数
    const params: ZPayNotifyParams = {
      pid: searchParams.get("pid") || "",
      name: searchParams.get("name") || "",
      money: searchParams.get("money") || "",
      out_trade_no: searchParams.get("out_trade_no") || "",
      trade_no: searchParams.get("trade_no") || "",
      param: searchParams.get("param") || undefined,
      trade_status: searchParams.get("trade_status") || "",
      type: (searchParams.get("type") as "alipay" | "wxpay") || "alipay",
      sign: searchParams.get("sign") || "",
      sign_type: searchParams.get("sign_type") || "MD5",
    };

    console.log("[Payment Notify] Received:", {
      out_trade_no: params.out_trade_no,
      trade_status: params.trade_status,
      money: params.money,
    });

    // 验证签名和状态
    const verification = verifyNotify(params);
    if (!verification.valid) {
      console.error("[Payment Notify] Verification failed:", verification.error);
      return new NextResponse("fail", { status: 200 });
    }

    const supabase = getServiceSupabase();

    // 查询订单
    const { data: order, error: queryError } = await supabase
      .from("subscription_orders")
      .select("*")
      .eq("out_trade_no", params.out_trade_no)
      .single();

    if (queryError || !order) {
      console.error("[Payment Notify] Order not found:", params.out_trade_no);
      return new NextResponse("fail", { status: 200 });
    }

    // 幂等检查：如果订单已支付，直接返回成功
    if (order.status === "paid") {
      console.log("[Payment Notify] Order already paid:", params.out_trade_no);
      return new NextResponse("success", { status: 200 });
    }

    // 验证金额
    const expectedAmount = PLAN_PRICES[order.plan_type as "pro" | "ai"];
    const paidAmount = parseFloat(params.money);
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error(
        "[Payment Notify] Amount mismatch:",
        `expected ${expectedAmount}, got ${paidAmount}`
      );
      return new NextResponse("fail", { status: 200 });
    }

    // 计算会员到期时间（一年）
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 更新订单状态
    const { error: updateOrderError } = await supabase
      .from("subscription_orders")
      .update({
        status: "paid",
        trade_no: params.trade_no,
        paid_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("out_trade_no", params.out_trade_no);

    if (updateOrderError) {
      console.error("[Payment Notify] Failed to update order:", updateOrderError);
      return new NextResponse("fail", { status: 200 });
    }

    // 获取当前会员状态，处理续费情况
    const { data: currentMembership } = await supabase
      .from("user_memberships")
      .select("expires_at")
      .eq("user_id", order.user_id)
      .single();

    // 如果当前会员未过期，从当前到期时间续费
    let finalExpiresAt = expiresAt;
    if (
      currentMembership?.expires_at &&
      new Date(currentMembership.expires_at) > now
    ) {
      finalExpiresAt = new Date(currentMembership.expires_at);
      finalExpiresAt.setFullYear(finalExpiresAt.getFullYear() + 1);
    }

    // 激活/更新会员
    const { error: membershipError } = await supabase
      .from("user_memberships")
      .upsert(
        {
          user_id: order.user_id,
          plan_type: order.plan_type,
          expires_at: finalExpiresAt.toISOString(),
          last_payment_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (membershipError) {
      console.error("[Payment Notify] Failed to update membership:", membershipError);
      // 不返回 fail，订单已标记为 paid
    }

    console.log(
      "[Payment Notify] Success:",
      params.out_trade_no,
      "expires:",
      finalExpiresAt.toISOString()
    );

    return new NextResponse("success", { status: 200 });
  } catch (error) {
    console.error("[Payment Notify] Error:", error);
    return new NextResponse("fail", { status: 200 });
  }
}

// 同时支持 POST 方式
export async function POST(request: NextRequest) {
  return GET(request);
}
