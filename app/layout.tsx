import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "NewsBox - 你的随身智库 | AI 驱动的全媒体阅读助理",
  description: "NewsBox 是面向未来的 AI 资讯助理，提供收集、净化、唤醒全流程知识管理。支持图文、视频内容一键收藏，AI 智能总结，助你将信息转化为生产力。",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
