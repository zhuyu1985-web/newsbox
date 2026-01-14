/**
 * 创建支付订单 API
 * POST /api/payment/create - 创建订单并返回支付链接
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generatePaymentUrl,
  generateOutTradeNo,
  PayType,
} from "@/lib/services/zpay";
import { PLAN_PRICES, PLAN_NAMES } from "@/lib/services/membership";

interface CreatePaymentRequest {
  planType: "pro" | "ai";
  payType: PayType;
}

export async function POST(request: NextRequest) {
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
    const body: CreatePaymentRequest = await request.json();
    const { planType, payType } = body;

    // 验证参数
    if (!planType || !["pro", "ai"].includes(planType)) {
      return NextResponse.json(
        { error: "Invalid planType", message: "无效的会员类型" },
        { status: 400 }
      );
    }

    if (!payType || payType !== "wxpay") {
      return NextResponse.json(
        { error: "Invalid payType", message: "目前仅支持微信支付" },
        { status: 400 }
      );
    }

    // 生成订单号
    const outTradeNo = generateOutTradeNo();
    const amount = PLAN_PRICES[planType];
    const productName = PLAN_NAMES[planType];

    // 创建订单记录
    const { error: orderError } = await supabase
      .from("subscription_orders")
      .insert({
        user_id: user.id,
        out_trade_no: outTradeNo,
        plan_type: planType,
        amount,
        status: "pending",
        pay_type: payType,
      });

    if (orderError) {
      console.error("[Payment] Failed to create order:", orderError);
      // 检查是否是表不存在的错误
      const errorMessage = orderError.code === "42P01" 
        ? "请先运行数据库迁移创建 subscription_orders 表"
        : `创建订单失败: ${orderError.message}`;
      return NextResponse.json(
        { error: "Order creation failed", message: errorMessage, details: orderError },
        { status: 500 }
      );
    }

    // 生成支付链接
    const paymentUrl = generatePaymentUrl({
      outTradeNo,
      name: `${productName} - 年度订阅`,
      money: amount.toFixed(2),
      type: payType,
      param: JSON.stringify({ userId: user.id, planType }),
    });

    return NextResponse.json({
      success: true,
      data: {
        outTradeNo,
        paymentUrl,
        amount,
        planType,
        payType,
      },
    });
  } catch (error) {
    console.error("[API] /payment/create error:", error);
    const errorMessage = error instanceof Error ? error.message : "创建支付订单失败";
    return NextResponse.json(
      { error: "Internal Server Error", message: errorMessage },
      { status: 500 }
    );
  }
}
