"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, Camera, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

interface AISnapshotViewProps {
  noteId: string;
  title?: string | null;
  content?: string | null;
}

type TemplateType = "business" | "deep" | "social";

const templates = [
  { id: "business" as const, name: "商务简报", description: "白底黑字，极简专业" },
  { id: "deep" as const, name: "黑金深邃", description: "深色模式，科技感强" },
  { id: "social" as const, name: "社交海报", description: "大图模式，易分享" },
];

export function AISnapshotView({ noteId, title, content }: AISnapshotViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("business");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  // 跟踪是否有任何图片已加载（首次加载 vs 切换风格）
  const [hasAnyImage, setHasAnyImage] = useState(false);
  // 跟踪当前图片是否已加载完成（用于平滑切换）
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // 缓存已获得的图片 URL（signed url），减少重复网络请求
  const snapshotCacheRef = useRef<Record<string, string>>({});
  const activeNoteIdRef = useRef<string>(noteId);

  // 去重与取消：避免同一次进入/状态切换触发重复请求
  const inflightRef = useRef<{
    key: string;
    requestId: number;
    controller: AbortController;
  } | null>(null);
  const requestSeqRef = useRef(0);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // note 切换时清空缓存和状态
  useEffect(() => {
    if (activeNoteIdRef.current === noteId) return;

    inflightRef.current?.controller.abort();
    inflightRef.current = null;

    snapshotCacheRef.current = {};
    activeNoteIdRef.current = noteId;
    setImageUrl("");
    setError("");
    setHasAnyImage(false);
    setIsImageLoaded(false);
  }, [noteId]);

  const fetchExistingUrl = async (template: TemplateType, signal: AbortSignal) => {
    const res = await fetch(`/api/ai/snapshot?noteId=${encodeURIComponent(noteId)}&template=${template}`, { signal });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || `查询失败 (${res.status})`);
    }

    const url = json?.renders?.[0]?.url as string | undefined;
    return url || "";
  };

  const ensureUrl = async (template: TemplateType, signal: AbortSignal, force?: boolean) => {
    const res = await fetch("/api/ai/snapshot/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, template, force: !!force }),
      signal,
    });

    const json = await res.json().catch(() => null);

    if (res.status === 202) {
      return { status: "generating" as const, url: "" };
    }

    if (!res.ok) {
      const msg =
        json?.error && json?.details
          ? `${json.error}: ${json.details}`
          : (json?.error as string | undefined) || (json?.details as string | undefined) || `生成失败 (${res.status})`;
      throw new Error(msg);
    }

    return { status: "ready" as const, url: (json?.url as string) || "" };
  };

  // 生成/获取快照图片
  const generateSnapshot = async (template: TemplateType, opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const requestKey = `${noteId}:${template}`;

    // 检查缓存
    const cached = snapshotCacheRef.current[requestKey];
    if (!force && cached) {
      setError("");
      // 缓存命中：直接切换图片，不显示 loading
      setIsImageLoaded(false); // 重置加载状态
      setImageUrl(cached);
      return;
    }

    // 避免重复请求
    if (!force && inflightRef.current?.key === requestKey) {
      return;
    }

    // 取消之前的请求
    inflightRef.current?.controller.abort();

    const controller = new AbortController();
    const requestId = ++requestSeqRef.current;
    inflightRef.current = { key: requestKey, requestId, controller };

    // 只在首次加载（没有图片）时显示 loading
    // 切换风格时保持旧图片显示
    if (!hasAnyImage) {
      setIsGenerating(true);
    }
    setError("");

    try {
      // 1) 先查：如果已存在，直接返回签名链接
      let url = await fetchExistingUrl(template, controller.signal);

      // 2) 未命中：触发 ensure（首调 AI + 持久化）
      if (!url) {
        const maxAttempts = 8;
        for (let i = 0; i < maxAttempts; i++) {
          const ensured = await ensureUrl(template, controller.signal, force);
          if (ensured.status === "ready" && ensured.url) {
            url = ensured.url;
            break;
          }

          // generating：等一会再查
          await sleep(800);
          url = await fetchExistingUrl(template, controller.signal);
          if (url) break;
        }
      }

      if (!url) {
        throw new Error("生成超时，请重试");
      }

      // 检查是否还是当前请求
      if (inflightRef.current?.requestId !== requestId || inflightRef.current?.key !== requestKey) {
        return;
      }

      snapshotCacheRef.current[requestKey] = url;

      // 设置新图片 URL（会触发图片重新加载）
      setIsImageLoaded(false);
      setImageUrl(url);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "生成失败，请稍后重试");
    } finally {
      // 只在这是当前请求时才更新状态
      if (inflightRef.current?.requestId === requestId && inflightRef.current?.key === requestKey) {
        setIsGenerating(false);
      }
    }
  };

  // 组件卸载时取消未完成请求
  useEffect(() => {
    return () => {
      inflightRef.current?.controller.abort();
      inflightRef.current = null;
      snapshotCacheRef.current = {};
    };
  }, []);

  // 统一入口：进入界面/风格切换
  useEffect(() => {
    generateSnapshot(selectedTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, selectedTemplate]);

  // 图片加载完成回调
  const handleImageLoad = () => {
    setIsImageLoaded(true);
    setHasAnyImage(true);
    setIsGenerating(false);
  };

  // 下载图片
  const handleDownload = async () => {
    if (!imageUrl) return;

    try {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = `newsbox-snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
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
        toast.success("图片已准备好，请右键保存分享");
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  return (
    <div className="w-[680px] h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="w-full px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 头部：标题和操作按钮 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">AI 快照</h1>
                <p className="text-xs text-slate-500">将长文章浓缩为精美分享卡片</p>
              </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateSnapshot(selectedTemplate, { force: true })}
                disabled={isGenerating}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", isGenerating && "animate-spin")} />
                重新生成
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[240px,1fr] gap-6">
            {/* 左侧：风格选择器 */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  选择风格
                </h3>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left group",
                        selectedTemplate === template.id
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {template.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate leading-relaxed">
                          {template.description}
                        </div>
                      </div>
                      {selectedTemplate === template.id && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 ml-2.5 shadow-sm">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 提示信息 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100/80 p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1.5">分享提示</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      快照会自动带有 NewsBox 水印和二维码，适合分享到朋友圈、小红书等社交平台。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：快照预览 */}
            <div className="flex flex-col">
              <div className="relative bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200">
                  <AnimatePresence mode="wait">
                    {/* 首次加载时显示 loading */}
                    {isGenerating && !hasAnyImage && (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-10"
                      >
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="flex flex-col items-center"
                        >
                          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                          <p className="text-base font-semibold text-slate-700 mb-1">正在生成快照...</p>
                          <p className="text-sm text-slate-400">AI 正在提炼核心内容</p>
                        </motion.div>
                      </motion.div>
                    )}

                    {/* 错误状态 */}
                    {error && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 z-10 p-6"
                      >
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                          <span className="text-3xl">⚠️</span>
                        </div>
                        <p className="text-base font-semibold text-red-600 mb-2">生成失败</p>
                        <p className="text-sm text-red-500 text-center mb-4 max-w-xs leading-relaxed">{error}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSnapshot(selectedTemplate, { force: true })}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          重试
                        </Button>
                      </motion.div>
                    )}

                    {/* 图片容器 - 添加加载指示器 */}
                    <div className="relative w-full h-full">
                      {/* 背景占位符 - 有图片但未加载完成时显示 */}
                      {imageUrl && !error && !isImageLoaded && hasAnyImage && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 z-0"
                        >
                          {/* 扫描线动画 */}
                          <div className="absolute inset-0 overflow-hidden">
                            <motion.div
                              className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                              animate={{
                                y: ["0%", "100%"],
                              opacity: [0, 1, 1, 0]
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "linear"
                              }}
                            />
                          </div>

                          {/* 脉动的加载图标 */}
                          <motion.div
                            animate={{
                              scale: [1, 1.05, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            className="relative z-10"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                            </div>
                            <p className="text-sm font-medium text-slate-500 mt-3">加载中...</p>
                          </motion.div>
                        </motion.div>
                      )}

                      {/* 图片显示 */}
                      {imageUrl && !error && (
                        <motion.img
                          src={imageUrl}
                          alt="AI Snapshot"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{
                            opacity: isImageLoaded ? 1 : 0.7,
                            scale: isImageLoaded ? 1 : 0.98
                          }}
                          transition={{
                            duration: 0.3,
                            ease: "easeOut"
                          }}
                          className={cn(
                            "relative z-10 w-full h-full object-contain",
                            !isImageLoaded && "opacity-0"
                          )}
                          onLoad={handleImageLoad}
                          onError={() => {
                            setError("图片加载失败");
                          }}
                        />
                      )}
                    </div>
                  </AnimatePresence>
                </div>

                {/* 底部信息栏：始终占位，避免生成前后高度变化导致页面抖动 */}
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 h-12 flex items-center">
                  <div
                    className={cn(
                      "w-full flex items-center justify-between text-sm transition-opacity font-medium",
                      imageUrl && !isGenerating && !error ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>1200 × 1600 px</span>
                    </div>
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>PNG</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
