import { ImageResponse } from "@vercel/og";
import { NextRequest, NextResponse } from "next/server";

/**
 * 用于调试 AI 快照链路的测试端点：
 * - GET  : 返回一张静态 PNG（用于验证 @vercel/og 与路由可用）
 * - POST : 返回 JSON（用于验证请求体与环境变量）
 */
export async function GET(_request: NextRequest) {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            padding: "80px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "48px", fontWeight: "bold", color: "#000" }}>测试快照</div>
          <div style={{ fontSize: "24px", color: "#666", marginTop: "20px" }}>这是一个简单的测试图片</div>
        </div>
      ),
      {
        width: 1200,
        height: 1600,
      }
    );
  } catch (error: any) {
    console.error("Test snapshot error:", error);
    return new Response(`Error: ${error.message}\n${error.stack}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export async function POST(request: NextRequest) {
  console.log("=== Snapshot Test API Called ===");

  try {
    const body = await request.json();
    console.log("Received body:", {
      hasContent: !!body.content,
      contentLength: body.content?.length || 0,
      template: body.template,
    });

    return NextResponse.json({
      success: true,
      message: "API endpoint is working",
      receivedData: {
        hasContent: !!body.content,
        contentLength: body.content?.length || 0,
        template: body.template || "business",
      },
      env: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIBaseUrl: process.env.OPENAI_API_BASE_URL || "not set",
        openAIModel: process.env.OPENAI_MODEL || "not set",
      },
    });
  } catch (error: any) {
    console.error("Test API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
