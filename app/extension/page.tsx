import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Download,
  Globe2,
  PackageOpen,
  Puzzle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "浏览器插件安装 - NewsBox",
  description: "下载并安装 NewsBox 浏览器插件，支持 Chrome、Edge、Firefox 与 Safari 的内测安装说明。",
};

const extensionVersion = "1.0.0";

const packages = [
  {
    name: "Chrome",
    file: "newsbox-chrome.zip",
    href: "/api/extension/download/chrome",
    status: "推荐",
    note: "适用于 Chrome 与 Chromium 内核浏览器的开发者模式安装。",
  },
  {
    name: "Microsoft Edge",
    file: "newsbox-edge.zip",
    href: "/api/extension/download/edge",
    status: "通用",
    note: "与 Chrome 使用同一 Chromium 版本包，安装入口为 Edge 扩展管理页。",
  },
  {
    name: "Firefox",
    file: "newsbox-firefox.zip",
    href: "/api/extension/download/firefox",
    status: "内测",
    note: "当前按临时附加组件方式安装；正式签名版本正在规划中。",
  },
  {
    name: "Safari",
    file: "newsbox-safari.zip",
    href: "/api/extension/download/safari",
    status: "开发包",
    note: "Safari 需要通过 Xcode 转换为 Safari Web Extension 后启用。",
  },
];

const installGuides = [
  {
    browser: "Chrome",
    url: "chrome://extensions",
    steps: [
      "下载 Chrome 插件包并解压到本地文件夹。",
      "打开 chrome://extensions，开启右上角“开发者模式”。",
      "点击“加载已解压的扩展程序”，选择刚才解压后的文件夹。",
      "固定 NewsBox 图标，登录后即可一键收藏当前网页。",
    ],
  },
  {
    browser: "Microsoft Edge",
    url: "edge://extensions",
    steps: [
      "下载 Edge 插件包并解压；该包使用 Chrome 兼容版本。",
      "打开 edge://extensions，开启“开发人员模式”。",
      "点击“加载解压缩的扩展”，选择解压后的目录。",
      "如浏览器提示权限，确认允许读取当前网页用于保存标题、正文和链接。",
    ],
  },
  {
    browser: "Firefox",
    url: "about:debugging#/runtime/this-firefox",
    steps: [
      "下载 Firefox 插件包并解压。",
      "打开 about:debugging#/runtime/this-firefox。",
      "点击“临时载入附加组件”，选择解压目录里的 manifest.json。",
      "临时载入会在浏览器重启后失效；正式签名版发布前请按此方式内测。",
    ],
  },
  {
    browser: "Safari",
    url: "Safari 设置 → 扩展",
    steps: [
      "下载 Safari 开发包并解压，或在 extension 目录执行 npm run build:safari-xcode。",
      "使用 Xcode 打开生成的 Safari Web Extension 项目并运行容器 App。",
      "打开 Safari 设置里的“扩展”，启用 NewsBox。",
      "Safari 正式安装包需要通过 Mac App 形式分发，目前仍在规划中。",
    ],
  },
];

const capabilities = [
  "一键保存当前网页到 NewsBox",
  "读取页面标题、来源、封面和正文线索",
  "视频平台遇到反盗链时走浏览器侧保存",
  "与网页端账号打通，保存后回到仪表盘继续整理",
];

export default function ExtensionGuidePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              返回 NewsBox
            </Link>
          </Button>
          <div className="text-xs text-muted-foreground">当前插件版本 v{extensionVersion}</div>
        </div>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              <Puzzle className="h-3.5 w-3.5" />
              浏览器插件
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                安装 NewsBox 插件，随手保存网页和视频
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                插件用于在浏览器里完成一键收藏、页面信息读取和视频保存兜底。当前提供内测包下载，正式商店版本和 Safari Mac App 正在规划中。
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">插件能做什么</div>
                <div className="text-xs text-muted-foreground">安装后在浏览器工具栏中使用</div>
              </div>
            </div>
            <div className="space-y-3">
              {capabilities.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">下载安装包</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {packages.map((pkg) => (
              <Card key={pkg.name} className="rounded-2xl border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Globe2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold">{pkg.name}</div>
                      <div className="text-xs text-muted-foreground">{pkg.file}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">
                    {pkg.status}
                  </span>
                </div>
                <p className="mb-4 min-h-[54px] text-sm leading-6 text-muted-foreground">{pkg.note}</p>
                <Button asChild className="w-full">
                  <a href={pkg.href}>
                    <Download className="h-4 w-4" />
                    下载
                  </a>
                </Button>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {installGuides.map((guide) => (
            <Card key={guide.browser} className="rounded-2xl border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{guide.browser} 安装步骤</h3>
                  <div className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Compass className="h-3.5 w-3.5" />
                    {guide.url}
                  </div>
                </div>
                <PackageOpen className="h-5 w-5 text-blue-600" />
              </div>
              <ol className="space-y-3">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
