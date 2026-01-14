/**
 * 支付同步跳转 API
 * GET /api/payment/return - 支付完成后跳转回网站
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyReturn } from "@/lib/services/zpay";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // 收集所有参数
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const outTradeNo = params.out_trade_no;
    const tradeStatus = params.trade_status;

    console.log("[Payment Return] Received:", {
      out_trade_no: outTradeNo,
      trade_status: tradeStatus,
    });

    // 验证签名
    const verification = verifyReturn(params);
    if (!verification.valid) {
      console.error("[Payment Return] Verification failed:", verification.error);
      // 即使验证失败也跳转，用户可以在 Dashboard 查看实际状态
      return NextResponse.redirect(
        `${baseUrl}/dashboard?payment=error&message=${encodeURIComponent(
          "支付验证失败，请查看订单状态"
        )}`
      );
    }

    // 根据支付状态跳转
    if (tradeStatus === "TRADE_SUCCESS") {
      return NextResponse.redirect(
        `${baseUrl}/dashboard?payment=success&order=${outTradeNo}`
      );
    } else {
      return NextResponse.redirect(
        `${baseUrl}/dashboard?payment=pending&order=${outTradeNo}`
      );
    }
  } catch (error) {
    console.error("[Payment Return] Error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/dashboard?payment=error&message=${encodeURIComponent(
        "处理支付结果时发生错误"
      )}`
    );
  }
}
