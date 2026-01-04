"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Shield, Globe, Cpu, ArrowRight, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";

const pricingTiers = [
  {
    name: "NewsBox Pro",
    price: "98",
    period: "/年",
    description: "解锁无限收藏与高级管理功能，适合进阶阅读者。",
    buttonText: "升级 Pro",
    buttonVariant: "outline" as const,
    features: [
      "无限收藏与标注数量",
      "网页高质量解析与快照",
      "微信/浏览器插件快速收藏",
      "沉浸式阅读器与多种字体",
      "嵌套收藏夹与标签系统",
      "Newsletter & API 自动收藏",
      "全平台多端同步，无设备限制"
    ]
  },
  {
    name: "NewsBox Pro + AI",
    price: "198",
    period: "/年",
    description: "包含 Pro 全部功能，并赋予 AI 深度阅读助手能力。",
    buttonText: "免费试用 14 天",
    buttonVariant: "default" as const,
    highlight: true,
    features: [
      "包含 Pro 所有高级功能",
      "AI 阅读助手：文章自动解读",
      "AI 幻影高亮：关键内容预警",
      "AI 智能摘要：极速概括大意",
      "每月最多 1500 次 AI 使用次数",
      "未来所有 AI 增强功能优先体验",
      "优先技术支持"
    ]
  }
];

const faqs = [
  {
    question: "Pro 和 Pro+AI 有什么区别？",
    answer: "Pro 版侧重于基础的高级收藏和阅读体验（如无限篇数、快照、嵌套目录等）；Pro+AI 在此基础上增加了 AI 驱动的阅读辅助能力，包括自动摘要、解读、幻影高亮等，帮助你更快内化知识。"
  },
  {
    question: "订阅后可以在多个设备上使用吗？",
    answer: "是的，NewsBox 订阅绑定您的账号。您可以在 iPhone, Android, Mac, Windows 以及网页端同时登录使用，没有任何设备数量限制。"
  },
  {
    question: "如果会员到期了，我的数据会丢失吗？",
    answer: "绝对不会。即使会员到期，您已经收藏的所有内容、快照和标注都会完整保留，您依然可以随时查阅或导出。只是在篇数超过免费额度后，将无法新增收藏。"
  },
  {
    question: "支持退款吗？",
    answer: "由于数字产品的特殊性，我们建议您先使用免费版或 Pro+AI 的 14 天免费试用。如果您在订阅后 7 天内遇到任何严重技术问题无法解决，可以联系客服申请退款。"
  }
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const navItems = [
    { id: "product-features", label: "产品功能", href: "/#product-features" },
    { id: "pain-points", label: "用户痛点", href: "/#pain-points" },
    { id: "core-loop", label: "核心理念", href: "/#core-loop" },
    { id: "scenarios", label: "场景演绎", href: "/#scenarios" },
    { id: "pricing", label: "加入会员", href: "/pricing" },
  ];

  return (
    <main className="min-h-screen bg-[#FBFBFD] dark:bg-black selection:bg-blue-100 selection:text-blue-900 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-black/[0.03] dark:border-white/[0.03] bg-white/70 dark:bg-black/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-black dark:text-white">NewsBox</span>
          </Link>

          <div className="flex-1" />

          <div 
            className="hidden md:flex items-center gap-1 p-1 rounded-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03] mr-8"
            onMouseLeave={() => setHoveredNav(null)}
          >
            {navItems.map((item) => {
              const isActive = item.id === 'pricing'; // Always active on pricing page
              const isHovered = hoveredNav === item.id;
              
              const LinkContent = (
                <span className={`relative z-10 transition-colors duration-300 ${
                  isActive || isHovered ? 'text-blue-600' : 'text-black/60 dark:text-white/60'
                }`}>
                  {item.label}
                </span>
              );

              const baseStyles = "relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 outline-none block";

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setHoveredNav(item.id)}
                >
                  <Link href={item.href} className={baseStyles}>
                    {LinkContent}
                  </Link>

                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        layoutId="nav-hover-bg"
                        className="absolute inset-0 bg-white/40 dark:bg-white/10 backdrop-blur-md rounded-full -z-10 border border-black/[0.05] dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {isActive && !isHovered && (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 bg-blue-600/5 dark:bg-blue-400/10 rounded-full -z-10 border border-blue-600/20 dark:border-blue-400/30"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" className="rounded-full px-5 text-sm font-medium">登录</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-lg shadow-blue-500/25 transition-all active:scale-95">
                立即开始
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="pt-32 pb-16 lg:pt-48 lg:pb-24">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              加入 NewsBox 会员
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">
              与全球 550,000+ 阅读者一起，重塑你的知识循环系统
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.8 }}
                className={`relative flex flex-col p-8 lg:p-10 rounded-[32px] bg-white dark:bg-[#111] border ${
                  tier.highlight 
                    ? "border-blue-600 shadow-[0_32px_64px_-16px_rgba(59,130,246,0.15)] ring-1 ring-blue-600/50" 
                    : "border-black/[0.05] dark:border-white/[0.05] shadow-xl shadow-black/[0.02]"
                } overflow-hidden group`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-bl-2xl">
                      推荐方案
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-2xl font-bold">{tier.name}</h2>
                    {tier.highlight && <Zap className="w-5 h-5 text-blue-600 fill-blue-600" />}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl lg:text-5xl font-black">¥{tier.price}</span>
                    <span className="text-slate-400 font-medium">{tier.period}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    {tier.description}
                  </p>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3">
                      <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        tier.highlight ? "bg-blue-600/10 text-blue-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Link href="/auth/sign-up" className="block">
                  <Button 
                    variant={tier.buttonVariant} 
                    className={`w-full h-14 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
                      tier.highlight 
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25" 
                        : "border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    {tier.buttonText}
                    {tier.highlight && <ArrowRight className="ml-2 w-5 h-5" />}
                  </Button>
                </Link>
                
                {tier.highlight && (
                  <p className="mt-4 text-center text-xs text-slate-400 font-medium">
                    无信用卡要求，试用期内随时可取消
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Free Tier Info */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              免费用户限额 200 篇，每篇最多 3 个标注。升级以解锁无限可能。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="py-24 bg-white dark:bg-[#050505] border-y border-black/[0.03] dark:border-white/[0.03]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: "隐私与数据安全",
                desc: "我们不靠广告盈利，也不售卖您的个人数据。您的所有收藏内容均经过加密存储。"
              },
              {
                icon: Globe,
                title: "全平台订阅同步",
                desc: "一个账号，全平台通用。支持 iOS, Android, macOS, Windows, Web 及各种浏览器插件。"
              },
              {
                icon: Cpu,
                title: "持续的 AI 进化",
                desc: "会员收入将直接用于支付 AI 算力成本及新功能的研发，让 NewsBox 始终保持领先。"
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-12 text-center">常见问题</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="rounded-2xl border border-black/[0.05] dark:border-white/[0.05] bg-white dark:bg-[#111] overflow-hidden"
              >
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-6 pb-5 text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto p-12 lg:p-20 rounded-[48px] bg-blue-600 relative overflow-hidden text-center text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent)]" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl lg:text-5xl font-black">开启你的深度阅读之旅</h2>
              <p className="text-blue-100 text-lg lg:text-xl font-medium max-w-2xl mx-auto">
                今天就开始免费试用 Pro+AI，体验 AI 赋能的全新知识获取方式。
              </p>
              <div className="pt-4">
                <Link href="/auth/sign-up">
                  <Button size="lg" className="h-16 px-12 rounded-full text-xl font-bold bg-white text-blue-600 hover:bg-blue-50 shadow-2xl transition-all active:scale-95">
                    立即免费开始
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (Simplified) */}
      <footer className="py-12 border-t border-black/[0.05] dark:border-white/[0.05]">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-400 text-sm font-medium">© 2025 NewsBox. All rights reserved.</p>
          <div className="flex gap-8 text-sm font-medium text-slate-400">
            <Link href="#" className="hover:text-blue-600 transition-colors">隐私政策</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">服务条款</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">联系我们</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
