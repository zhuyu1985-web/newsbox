"use client";

import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";

export function AboutSection() {
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="text-base font-bold text-slate-900">关于 NewsBox</h3>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Row
              label="使用指南"
              right={
                <a
                  className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-2"
                  href="https://help.cubox.pro"
                  target="_blank"
                  rel="noreferrer"
                >
                  help.cubox.pro <ExternalLink className="h-4 w-4" />
                </a>
              }
            />
            <Row
              label="帮助文档"
              right={
                <a
                  className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-2"
                  href="https://help.cubox.pro"
                  target="_blank"
                  rel="noreferrer"
                >
                  help.cubox.pro <ExternalLink className="h-4 w-4" />
                </a>
              }
            />
            <Row
              label="产品反馈"
              right={
                <a
                  className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-2"
                  href="https://cubox.canny.io"
                  target="_blank"
                  rel="noreferrer"
                >
                  cubox.canny.io <ExternalLink className="h-4 w-4" />
                </a>
              }
            />
            <Row
              label="联系邮箱"
              right={
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">hi@cubox.pro</span>
                  <Button variant="outline" size="sm" onClick={() => copy("hi@cubox.pro")}>
                    <Copy className="h-4 w-4 mr-2" />
                    复制
                  </Button>
                </div>
              }
            />
            <Row
              label="联系微信"
              right={<span className="text-slate-500">（占位：后续可补二维码/微信号）</span>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="bg-[#f5f5f7] rounded-2xl p-6 flex items-center justify-between gap-6">
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <div className="text-sm">{right}</div>
    </div>
  );
}


