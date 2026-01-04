import type { SnapshotCardData } from "@/lib/services/snapshot";

// ============================================================================
// Business Card - 商务简报风格
// 设计理念：白底黑字，极简专业，适合商务场景分享
// ============================================================================
export function BusinessCard({ data }: { data: SnapshotCardData }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#fafbfc",
        padding: "70px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 顶部：来源和标签 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "50px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.source_name && (
            <div style={{ fontSize: "26px", fontWeight: "600", color: "#64748b", letterSpacing: "0.5px" }}>
              {data.source_name.toUpperCase()}
            </div>
          )}
          {data.publish_time && (
            <div style={{ fontSize: "20px", color: "#94a3b8" }}>
              {new Date(data.publish_time).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 24px",
            backgroundColor: "#eff6ff",
            borderRadius: "24px",
            fontSize: "28px",
            fontWeight: "600",
            color: "#2563eb",
          }}
        >
          {data.sentiment}
        </div>
      </div>

      {/* 中间：核心内容 */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "40px" }}>
        {/* 核心观点 */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: "700",
            color: "#0f172a",
            lineHeight: 1.35,
            letterSpacing: "-0.02em",
          }}
        >
          {data.one_liner}
        </div>

        {/* 分割线 */}
        <div style={{ width: "80px", height: "4px", backgroundColor: "#3b82f6", borderRadius: "2px" }} />

        {/* 要点列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {(data.bullet_points || []).map((point, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  minWidth: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#3b82f6",
                  color: "#ffffff",
                  borderRadius: "50%",
                  fontSize: "20px",
                  fontWeight: "700",
                }}
              >
                {idx + 1}
              </div>
              <div
                style={{
                  fontSize: "34px",
                  color: "#334155",
                  lineHeight: 1.5,
                  flex: 1,
                  paddingTop: "2px",
                }}
              >
                {point}
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据/金句 */}
        {data.key_stat && (
          <div
            style={{
              padding: "36px 40px",
              backgroundColor: "#ffffff",
              borderLeft: "5px solid #3b82f6",
              borderRadius: "4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: "38px",
                fontWeight: "600",
                color: "#1e40af",
                lineHeight: 1.45,
              }}
            >
              "{data.key_stat}"
            </div>
          </div>
        )}
      </div>

      {/* 底部：品牌信息 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "50px",
          paddingTop: "25px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: "700",
            }}
          >
            N
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b", letterSpacing: "0.5px" }}>
            NewsBox
          </div>
        </div>
        <div style={{ fontSize: "20px", color: "#94a3b8", fontWeight: "500" }}>
          AI 驱动 · 智能摘要
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Deep Card - 黑金深邃风格
// 设计理念：深色渐变背景，金色点缀，科技感强，适合深度内容
// ============================================================================
export function DeepCard({ data }: { data: SnapshotCardData }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        padding: "70px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
      }}
    >
      {/* 装饰背景圆 */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* 顶部信息 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "50px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {data.source_name && (
            <div style={{ fontSize: "26px", fontWeight: "600", color: "#cbd5e1", letterSpacing: "1px" }}>
              {data.source_name.toUpperCase()}
            </div>
          )}
          {data.publish_time && (
            <div style={{ fontSize: "20px", color: "#64748b" }}>
              {new Date(data.publish_time).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "12px 24px",
            background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
            borderRadius: "24px",
            fontSize: "28px",
            fontWeight: "700",
            color: "#1e293b",
            boxShadow: "0 4px 15px rgba(251, 191, 36, 0.3)",
          }}
        >
          {data.sentiment}
        </div>
      </div>

      {/* 核心内容 */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "40px", position: "relative" }}>
        {/* 核心观点 */}
        <div
          style={{
            fontSize: "54px",
            fontWeight: "700",
            color: "#ffffff",
            lineHeight: 1.35,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          {data.one_liner}
        </div>

        {/* 分割线 */}
        <div style={{ width: "80px", height: "4px", background: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)", borderRadius: "2px" }} />

        {/* 要点列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {(data.bullet_points || []).map((point, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  minWidth: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                  color: "#1e293b",
                  borderRadius: "50%",
                  fontSize: "20px",
                  fontWeight: "700",
                }}
              >
                {idx + 1}
              </div>
              <div
                style={{
                  fontSize: "34px",
                  color: "#e2e8f0",
                  lineHeight: 1.5,
                  flex: 1,
                  paddingTop: "2px",
                }}
              >
                {point}
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据 */}
        {data.key_stat && (
          <div
            style={{
              padding: "36px 40px",
              background: "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)",
              borderLeft: "5px solid #fbbf24",
              borderRadius: "4px",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: "38px",
                fontWeight: "600",
                color: "#fbbf24",
                lineHeight: 1.45,
              }}
            >
              "{data.key_stat}"
            </div>
          </div>
        )}
      </div>

      {/* 底部品牌 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "50px",
          paddingTop: "25px",
          borderTop: "1px solid rgba(148, 163, 184, 0.3)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e293b",
              fontSize: "18px",
              fontWeight: "700",
            }}
          >
            N
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", letterSpacing: "0.5px" }}>
            NewsBox
          </div>
        </div>
        <div style={{ fontSize: "20px", color: "#64748b", fontWeight: "500" }}>
          AI 驱动 · 智能摘要
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Social Card - 社交海报风格
// 设计理念：大图模式，渐变背景，易分享，适合社交媒体
// ============================================================================
export function SocialCard({ data }: { data: SnapshotCardData }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        padding: "70px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
      }}
    >
      {/* 装饰圆 */}
      <div
        style={{
          position: "absolute",
          top: "-150px",
          left: "-150px",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* 标签 */}
      <div
        style={{
          alignSelf: "flex-start",
          padding: "14px 28px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderRadius: "30px",
          fontSize: "26px",
          fontWeight: "700",
          color: "#6d28d9",
          marginBottom: "50px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
          position: "relative",
        }}
      >
        {data.sentiment}
      </div>

      {/* 核心内容 */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "36px", position: "relative" }}>
        {/* 核心观点 */}
        <div
          style={{
            fontSize: "58px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 20px rgba(0,0,0,0.2)",
          }}
        >
          {data.one_liner}
        </div>

        {/* 要点列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {(data.bullet_points || []).map((point, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                padding: "20px 28px",
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                alignItems: "center",
                gap: "16px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  minWidth: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "#ffffff",
                  borderRadius: "50%",
                  fontSize: "16px",
                  fontWeight: "700",
                }}
              >
                {idx + 1}
              </div>
              <div
                style={{
                  fontSize: "32px",
                  color: "#4c1d95",
                  lineHeight: 1.4,
                  flex: 1,
                }}
              >
                {point}
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据 */}
        {data.key_stat && (
          <div
            style={{
              padding: "40px 45px",
              backgroundColor: "rgba(255, 255, 255, 1)",
              borderRadius: "20px",
              marginTop: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                fontSize: "40px",
                fontWeight: "700",
                color: "#6d28d9",
                lineHeight: 1.4,
                fontStyle: "italic",
              }}
            >
              "{data.key_stat}"
            </div>
          </div>
        )}
      </div>

      {/* 底部品牌 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "50px",
          gap: "14px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            background: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6d28d9",
            fontSize: "20px",
            fontWeight: "800",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          N
        </div>
        <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "1px" }}>
          NewsBox
        </div>
      </div>
    </div>
  );
}
