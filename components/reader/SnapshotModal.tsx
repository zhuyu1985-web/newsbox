"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string;
  title?: string;
  content?: string;
}

type TemplateType = "business" | "deep" | "social";

const templates = [
  { id: "business" as const, name: "商务简报", description: "白底黑字，极简专业" },
  { id: "deep" as const, name: "黑金深邃", description: "深色模式，科技感强" },
  { id: "social" as const, name: "社交海报", description: "大图模式，易分享" },
];

export function SnapshotModal({ isOpen, onClose, noteId, title, content }: SnapshotModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("business");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  // 生成快照图片（先查库命中，未命中才触发首生成；风格切换只取链接/补渲染）
  const generateSnapshot = async (opts?: { force?: boolean }) => {
    if (!noteId && !content) {
      setError("缺少必要参数：content 或 noteId");
      return;
    }

    if (!noteId) {
      // 该 Modal 的 legacy 模式（无 noteId）暂不支持持久化，避免误写入
      setError("当前内容未关联笔记，无法生成可缓存的快照");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      // 1) 先查
      const q = await fetch(`/api/ai/snapshot?noteId=${encodeURIComponent(noteId)}&template=${selectedTemplate}`);
      const qj = await q.json().catch(() => null);
      if (q.ok && qj?.exists && qj?.renders?.[0]?.url) {
        setImageUrl(qj.renders[0].url);
        return;
      }

      // 2) 未命中：ensure
      const res = await fetch("/api/ai/snapshot/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, template: selectedTemplate, force: !!opts?.force }),
      });

      const json = await res.json().catch(() => null);

      if (res.status === 202) {
        setError("正在生成中，请稍后重试");
        return;
      }

      if (!res.ok) {
        const msg =
          json?.error && json?.details
            ? `${json.error}: ${json.details}`
            : (json?.error as string | undefined) || (json?.details as string | undefined) || `生成失败 (${res.status})`;
        throw new Error(msg);
      }

      setImageUrl(json?.url || "");
    } catch (err: any) {
      setError(err.message || "生成失败，请稍后重试");
      console.error("Snapshot generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 打开弹窗或切换模版时生成（避免初次打开被两个 effect 重复触发）
  useEffect(() => {
    if (!isOpen) return;
    if (!content && !noteId) return;
    generateSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTemplate]);

  // 下载图片
  const handleDownload = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsbox-snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  // 分享图片
  const handleShare = async () => {
    if (!imageUrl) return;

    try {
      if (navigator.share) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "newsbox-snapshot.png", { type: "image/png" });

        await navigator.share({
          title: "NewsBox AI 快照",
          text: title || "精选内容快照",
          files: [file],
        });
      } else {
        // 浏览器不支持 Web Share API，复制链接
        await navigator.clipboard.writeText(window.location.origin + imageUrl);
        alert("图片链接已复制到剪贴板");
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl font-bold">AI 快照</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!imageUrl || isGenerating}
              >
                <Download className="h-4 w-4 mr-1.5" />
                下载
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={!imageUrl || isGenerating}
              >
                <Share2 className="h-4 w-4 mr-1.5" />
                分享
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 模版选择器 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">选择风格</label>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedTemplate === template.id
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  )}
                >
                  <span className="font-medium text-sm">{template.name}</span>
                  <span className="text-xs text-slate-500">{template.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 图片预览区 */}
          <div className="relative w-full aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200">
            {isGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                <p className="text-sm text-slate-600">正在生成快照...</p>
                <p className="text-xs text-slate-400 mt-1">AI 正在提炼核心内容</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 z-10">
                <X className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm text-red-600">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateSnapshot({ force: true })}
                  className="mt-3"
                >
                  重试
                </Button>
              </div>
            )}

            {imageUrl && !isGenerating && !error && (
              <img
                src={imageUrl}
                alt="AI Snapshot"
                className="w-full h-full object-contain"
                onLoad={() => setIsGenerating(false)}
                onError={() => {
                  setIsGenerating(false);
                  setError("图片加载失败");
                }}
              />
            )}
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 <strong>分享提示：</strong>快照会自动带有 NewsBox 水印和二维码，适合分享到朋友圈、小红书等社交平台。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
