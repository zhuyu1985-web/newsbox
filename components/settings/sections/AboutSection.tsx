"use client";

export function AboutSection() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-card-foreground">关于 NewsBox</h3>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Row label="使用指南" />
            <Row label="帮助文档" />
            <Row label="产品反馈" />
            <Row label="联系邮箱" />
            <Row label="联系微信" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label }: { label: string }) {
  return (
    <div className="bg-muted/70 rounded-2xl p-6 flex items-center justify-between gap-6">
      <div className="text-sm font-medium text-card-foreground">{label}</div>
      <div className="text-sm text-muted-foreground">正在规划中...</div>
    </div>
  );
}

