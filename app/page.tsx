"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { 
  Inbox, 
  Search, 
  Zap, 
  Radio, 
  Video, 
  PenTool, 
  ArrowRight,
  Layers,
  Compass,
  History,
  MousePointer2,
  Brain,
  Sparkles
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatedThemeSwitcher } from "@/components/animated-theme-switcher";

const keywords = ["深度长文", "B站视频", "微信公众号", "网页新闻", "播客音频"];

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.2
    }
  },
  whileInView: {
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function LandingPage() {
  const containerRef = useRef(null);
  const [keywordIndex, setKeywordIndex] = useState(0);
  const [quoteKey, setQuoteKey] = useState(0);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const navItems = [
    { id: "product-features", label: "产品功能" },
    { id: "pain-points", label: "用户痛点" },
    { id: "core-loop", label: "核心理念" },
    { id: "scenarios", label: "场景演绎" },
    { id: "pricing", label: "加入会员", href: "/pricing" },
  ];

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      window.history.pushState(null, "", `#${id}`);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setIsAuthed(!!data.user))
      .catch(() => setIsAuthed(false));

    const timer = setInterval(() => {
      setKeywordIndex((prev) => (prev + 1) % keywords.length);
    }, 3000);

    const quoteTimer = setInterval(() => {
      setQuoteKey((prev) => prev + 1);
    }, 6000);

    // Intersection Observer to detect active section
    const observerOptions = {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    navItems.forEach((item) => {
      if (!item.href) {
        const element = document.getElementById(item.id);
        if (element) observer.observe(element);
      }
    });

    return () => {
      clearInterval(timer);
      clearInterval(quoteTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <main ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 selection:bg-blue-100 dark:selection:bg-blue-900 selection:text-blue-900 dark:selection:text-blue-100 overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">NewsBox</span>
          </Link>
          <div className="flex-1" />
          <div
            className="hidden md:flex items-center gap-1 p-1 rounded-full bg-accent/50 border border-border mr-8"
            onMouseLeave={() => setHoveredNav(null)}
          >
            {navItems.map((item) => {
              const isExternal = !!item.href;
              const isActive = activeSection === item.id;
              const isHovered = hoveredNav === item.id;

              const LinkContent = (
                <span className={`relative z-10 transition-colors duration-300 ${
                  isActive || isHovered ? 'text-blue-600' : 'text-muted-foreground'
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
                  {isExternal ? (
                    <Link href={item.href!} className={baseStyles}>
                      {LinkContent}
                    </Link>
                  ) : (
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => scrollToSection(e, item.id)}
                      className={baseStyles}
                    >
                      {LinkContent}
                    </a>
                  )}

                  {/* Hover Background - Glass Effect */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        layoutId="nav-hover-bg"
                        className="absolute inset-0 bg-card/40 backdrop-blur-md rounded-full -z-10 border border-border shadow-sm"
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

                  {/* Active Indicator - Glass Effect */}
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
            <AnimatedThemeSwitcher variant="default" />
            {isAuthed === true ? (
              <Link href="/dashboard">
                <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-lg shadow-blue-500/25 transition-all active:scale-95">
                  我的收藏
                </Button>
              </Link>
            ) : isAuthed === false ? (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" className="rounded-full px-5 text-sm font-medium">登录</Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-lg shadow-blue-500/25 transition-all active:scale-95">
                    立即开始
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-400/10 blur-[120px] rounded-full -z-10 animate-pulse" />
        <div className="absolute -top-24 right-0 w-[500px] h-[500px] bg-purple-400/5 blur-[100px] rounded-full -z-10" />

        <div className="container mx-auto px-6">
          <motion.div 
            className="max-w-[1000px] mx-auto text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8 relative inline-block"
              >
                <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-full" />
                <div className="relative px-8 py-3 rounded-2xl bg-card/40 backdrop-blur-2xl border border-border shadow-sm">
                  <motion.div
                    key={quoteKey}
                    className="text-lg lg:text-xl font-medium tracking-wide text-muted-foreground italic flex items-center justify-center flex-wrap gap-x-[2px]"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 1 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.08,
                          delayChildren: 0.2
                        }
                      }
                    }}
                  >
                    <motion.span variants={{ hidden: { opacity: 0, filter: "blur(4px)" }, visible: { opacity: 1, filter: "blur(0px)" } }}>“</motion.span>
                    {["你", "的", "“稍", "后", "阅", "读”", "列", "表", "，", "是", "否", "沦", "为", "了", "信", "息", "的"].map((char, i) => (
                      <motion.span
                        key={i}
                        variants={{
                          hidden: { opacity: 0, y: 5, filter: "blur(4px)" },
                          visible: { opacity: 1, y: 0, filter: "blur(0px)" }
                        }}
                        className="inline-block"
                      >
                        {char}
                      </motion.span>
                    ))}
                    <motion.span
                      variants={{
                        hidden: { opacity: 0, scale: 0.8, filter: "blur(8px)" },
                        visible: { 
                          opacity: 1, 
                          scale: 1, 
                          filter: "blur(0px)",
                          transition: { type: "spring", stiffness: 200, damping: 10 }
                        }
                      }}
                      className="not-italic font-bold text-blue-500/60 dark:text-blue-400/50 mx-1 relative"
                    >
                      数字冷宫
                      <motion.span 
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-blue-400/10 blur-md rounded-lg -z-10"
                      />
                    </motion.span>
                    <motion.span variants={{ hidden: { opacity: 0, filter: "blur(4px)" }, visible: { opacity: 1, filter: "blur(0px)" } }}>？ ”</motion.span>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 mb-8"
              >
                <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 fill-blue-600" />
                <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300 tracking-wide uppercase">AI-Powered Intelligence</span>
              </motion.div>
            </div>

            {/* Dynamic Rolling Title */}
            <motion.div variants={fadeInUp} className="mb-8">
              <h1 className="text-4xl lg:text-[64px] leading-[1.2] font-extrabold tracking-tight text-black dark:text-white flex flex-col items-center">
                <div className="flex items-center justify-center flex-wrap gap-x-4">
                  <span>NewsBox：让</span>
                  <div className="relative inline-flex items-center justify-center overflow-hidden h-[1.2em] w-[180px] lg:w-[320px] align-bottom">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={keywordIndex}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: "0%", opacity: 1 }}
                        exit={{ y: "-100%", opacity: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400 whitespace-nowrap"
                      >
                        {keywords[keywordIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
                <span className="block mt-2">成为你的随身智库</span>
              </h1>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              从稍后阅读到深度洞察，我们将你的信息流转化为生产力。
            </motion.p>

            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href="/auth/sign-up">
                <Button size="lg" className="h-14 px-10 rounded-full text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                  免费开启 NewsBox
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <div className="text-sm font-medium text-muted-foreground/70 mt-4 sm:mt-0 flex gap-6">
                <span>收集 (Collect)</span>
                <span className="opacity-50">•</span>
                <span>净化 (Purify)</span>
                <span className="opacity-50">•</span>
                <span>唤醒 (Recall)</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Visual Mockup Section - Interactive Bubbles */}
          <div id="product-features" className="mt-20 lg:mt-32 relative scroll-mt-24">
            <div className="container mx-auto px-6 max-w-7xl">
              <div className="relative flex flex-col items-center">
                
                {/* Central Screenshot Container - Slightly Shrunk */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-10 w-full max-w-3xl"
                >
                  <div className="text-center mb-10">
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-lg lg:text-xl font-medium text-muted-foreground leading-relaxed"
                    >
                      NewsBox 的核心功能旨在突显产品<span className="text-blue-600 dark:text-blue-400 font-bold">“从信息囤积到知识内化”</span>的完整闭环，<br className="hidden lg:block" />强调 AI 在每个环节的赋能作用
                    </motion.p>
                  </div>

                  {/* Outer Glow */}
                  <div className="absolute -inset-20 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
                  
                  {/* Screenshot Window with Enhanced Wide Glass Border */}
                  <div className="relative group p-6 lg:p-8 rounded-lg bg-card/30 shadow-[0_50px_100px_-20px_rgba(59,130,246,0.15)] border border-blue-200/50 dark:border-blue-500/30 backdrop-blur-3xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 to-transparent opacity-30 rounded-lg -z-10" />
                    <div className="relative rounded-xl overflow-hidden shadow-xl border-border bg-card transition-transform duration-700 group-hover:scale-[1.005]">
                      {/* Glass Overlay for Screenshot */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-white/5 to-transparent z-10 pointer-events-none" />
                      
                      {/* Header */}
                      <div className="h-10 bg-muted border-b border-border flex items-center px-5 gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] shadow-sm shadow-red-500/30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] shadow-sm shadow-yellow-500/30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] shadow-sm shadow-green-500/30" />
                        </div>
                        <div className="flex-1 text-center text-[10px] text-muted-foreground font-medium tracking-tight">
                          newsbox.app/dashboard
                        </div>
                      </div>
                      
                      {/* Screenshot */}
                      <div className="relative">
                        <div className="absolute inset-0 pointer-events-none border border-white/10 dark:border-white/5 z-10" />
                        <Image 
                          src="/dashboard-screenshot.png" 
                          alt="NewsBox Dashboard" 
                          width={1600}
                          height={900}
                          className="w-full h-auto"
                          priority
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Central Jumping Icon - Highest Z-Index (Moved outside to ensure it's always on top and not clipped) */}
                <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none flex flex-col items-center lg:flex hidden">
                  <motion.div 
                    animate={{
                      y: [0, -70, -20, -5, 0],
                      rotateY: [0, 360, 360, 360, 360],
                      rotate: [0, 15, -15, 0, 0],
                    }}
                    transition={{
                      duration: 5,
                      times: [0, 0.15, 0.45, 0.8, 1], // 快速上升，中速下降，缓慢落地
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="relative"
                  >
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.3)] border border-white/20 backdrop-blur-sm bg-blue-600/90">
                      <Sparkles className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
                    </div>
                    {/* Soft Glow behind icon */}
                    <div className="absolute inset-0 bg-blue-500/30 blur-2xl -z-10 rounded-full scale-150 animate-pulse" />
                  </motion.div>

                  {/* Dynamic Shadow below icon */}
                  <motion.div
                    animate={{
                      scale: [1, 0.2, 0.6, 0.9, 1],
                      opacity: [0.2, 0.02, 0.12, 0.18, 0.2],
                    }}
                    transition={{
                      duration: 5,
                      times: [0, 0.15, 0.45, 0.8, 1],
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-12 h-3 bg-foreground/20 blur-md rounded-[100%] mt-8"
                  />
                </div>

                {/* Floating Bubbles */}
                <div className="absolute inset-0 pointer-events-none lg:block hidden">
                  {[
                    {
                      id: 1,
                      title: "全媒体智能入库",
                      eng: "Omni-Media Ingestion",
                      subtitle: "统一收集，视听转文",
                      desc: "支持收藏网页、公众号及 B站/YouTube 视频。",
                      icon: Inbox,
                      pos: "top-[20%] left-[-2%]",
                      flyIn: { x: -30, y: -10 },
                      color: "from-blue-500 to-cyan-400",
                      lineStyle: "bottom-[-20px] right-[-30px] w-20 h-px rotate-[30deg]",
                      dotPos: "bottom-[-30px] right-[-50px]"
                    },
                    {
                      id: 2,
                      title: "AI 深度伴读助手",
                      eng: "AI Copilot",
                      subtitle: "深度批注，读懂用上",
                      desc: "在阅读时提供 AI 辅助，实现与内容的深度对话。",
                      icon: Brain,
                      pos: "top-[20%] right-[-2%]",
                      flyIn: { x: 30, y: -10 },
                      color: "from-purple-500 to-indigo-400",
                      lineStyle: "bottom-[-20px] left-[-30px] w-20 h-px rotate-[-30deg]",
                      dotPos: "bottom-[-30px] left-[-50px]"
                    },
                    {
                      id: 3,
                      title: "通勤听阅电台",
                      eng: "Smart Podcast",
                      subtitle: "碎片时间，高效听读",
                      desc: "将待读列表转化为音频简报，像听播客一样阅读。",
                      icon: Radio,
                      pos: "bottom-[5%] left-[0%]",
                      flyIn: { x: -30, y: 10 },
                      color: "from-orange-500 to-amber-400",
                      lineStyle: "top-[-20px] right-[-30px] w-20 h-px rotate-[-30deg]",
                      dotPos: "top-[-30px] right-[-50px]"
                    },
                    {
                      id: 4,
                      title: "灵感唤醒引擎",
                      eng: "Inspiration Engine",
                      subtitle: "对话知识，唤醒记忆",
                      desc: "基于 RAG 技术的知识检索，让积累化为灵感。",
                      icon: Sparkles,
                      pos: "bottom-[5%] right-[0%]",
                      flyIn: { x: 30, y: 10 },
                      color: "from-green-500 to-emerald-400",
                      lineStyle: "top-[-20px] left-[-30px] w-20 h-px rotate-[30deg]",
                      dotPos: "top-[-30px] left-[-50px]"
                    }
                  ].map((bubble, i) => (
                    <motion.div
                      key={bubble.id}
                      initial={{ opacity: 0, ...bubble.flyIn }}
                      whileInView={{ opacity: 1, x: 0, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className={`absolute ${bubble.pos} pointer-events-auto z-30`}
                    >
                      <motion.div
                        animate={{
                          y: [0, -30, 0],
                        }}
                        transition={{
                          duration: 4 + i,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                        className="relative p-4 rounded-xl bg-card/95 backdrop-blur-2xl border border-border shadow-lg flex flex-col w-[240px] lg:w-[260px]"
                      >
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${bubble.color} flex items-center justify-center shadow-md shadow-black/5 shrink-0`}>
                            <bubble.icon className="w-4.5 h-4.5 text-white" />
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="font-bold text-card-foreground leading-tight text-[13px]">{bubble.title}</h4>
                            <p className="text-[7px] font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-widest">{bubble.eng}</p>
                          </div>
                        </div>

                        <div className="h-px w-full bg-border mb-2.5" />
                        <p className="text-[11px] font-bold text-card-foreground mb-1">{bubble.subtitle}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{bubble.desc}</p>

                        {/* Annotation Line & Dot */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className={`absolute ${bubble.lineStyle} bg-blue-500/30 dark:bg-blue-400/30 origin-center`} />
                          <motion.div 
                            className={`absolute ${bubble.dotPos} w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]`}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>

                {/* Mobile Version - Grid below screenshot */}
                <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 w-full px-4">
                  {[
                    { title: "全媒体智能入库", subtitle: "统一收集，视听转文", desc: "支持一键收藏网页、公众号、视频等全媒体内容。", icon: Inbox, color: "from-blue-500 to-cyan-400" },
                    { title: "AI 深度伴读助手", subtitle: "深度批注，读懂用上", desc: "实时 AI 辅助，不仅仅是阅读，更是与内容的对话。", icon: Brain, color: "from-purple-500 to-indigo-400" },
                    { title: "通勤听阅电台", subtitle: "碎片时间，高效听读", desc: "将待读列表转化为个性化的音频简报。", icon: Radio, color: "from-orange-500 to-amber-400" },
                    { title: "灵感唤醒引擎", subtitle: "对话知识，唤醒记忆", desc: "基于 RAG 技术的全局知识库检索。", icon: Sparkles, color: "from-green-500 to-emerald-400" }
                  ].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      whileTap={{ scale: 0.98 }}
                      className="p-5 rounded-xl bg-card/90 backdrop-blur-xl border border-border shadow-lg"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                          <feature.icon className="w-4.5 h-4.5 text-white" />
                        </div>
                        <h4 className="font-bold text-sm">{feature.title}</h4>
                      </div>
                      <p className="text-xs font-bold mb-1.5">{feature.subtitle}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </motion.div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="py-24 lg:py-32 bg-white dark:bg-slate-900 border-y border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <motion.h2 
              variants={fadeInUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="text-3xl lg:text-4xl font-bold mb-6"
            >
              在信息过载时代，重塑你的阅读深度
            </motion.h2>
            <motion.p 
              variants={fadeInUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="text-lg text-muted-foreground"
            >
              我们深知，作为深度阅读者，你缺的不是内容，而是驾驭内容的能力。
            </motion.p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 mb-20">
            {[
              {
                icon: History,
                title: "解决记忆断层",
                desc: "不再为“记得看过却找不到”而苦恼。AI 帮你跨越时间，找回收藏夹深处的知识火花。"
              },
              {
                icon: Layers,
                title: "打通素材黑洞",
                desc: "海量视频与研报不再是负担。一键提取金句，让优质素材从沉睡中苏醒，转化为你的生产力。"
              },
              {
                icon: Compass,
                title: "走出碎片困局",
                desc: "利用通勤与运动的碎片时间。将长文转化为高效听阅电台，让深度思考不再受限于屏幕。"
              }
            ].map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col items-center text-center space-y-5 p-8 rounded-3xl hover:bg-accent transition-colors"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-600/5 dark:bg-blue-400/5 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-10 lg:p-16 rounded-[40px] bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border border-blue-600/10 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full group-hover:bg-blue-600/20 transition-colors duration-1000" />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="max-w-xl space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                  Vision
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold leading-tight">
                  NewsBox 不仅仅是一个收藏夹
                </h3>
                <p className="text-xl text-muted-foreground">
                  它是你在这个信息过载时代的<span className="text-blue-600 font-bold">“认知外骨骼”</span>。
                </p>
              </div>
              <div className="shrink-0 w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-600/30">
                <MousePointer2 className="w-10 h-10 text-white" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Loop Section */}
      <section id="core-loop" className="py-24 lg:py-40 bg-white dark:bg-slate-900 scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">核心理念</h2>
            <p className="text-xl text-muted-foreground">打造你私人的 AI 知识循环系统</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                id: "01",
                icon: Inbox,
                title: "收集 (Collect)",
                subtitle: "全媒体形态的统一入口",
                desc: "无论公众号长文、网页新闻，还是 B站/YouTube 视频。一键保存，自动清洗，图文影音一体化。",
                color: "bg-blue-600"
              },
              {
                id: "02",
                icon: Zap,
                title: "净化 (Purify)",
                subtitle: "AI 驱动的去伪真真",
                desc: "极速筛选未读列表，AI 瞬间生成 50 字浓缩摘要。像刷 Tinder 一样处理资讯，把精力留给真知灼见。",
                color: "bg-orange-500"
              },
              {
                id: "03",
                icon: Search,
                title: "唤醒 (Recall)",
                subtitle: "跨越时空的记忆检索",
                desc: "只需描述意图，AI 帮你从海量库中找回几年前的记忆。关联视频片段与笔记，让积累化为灵感。",
                color: "bg-green-600"
              }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.2 }}
                viewport={{ once: true }}
                className="relative group p-10 rounded-[32px] bg-card border-border hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 text-6xl font-black text-muted-foreground/20 group-hover:text-blue-500/5 transition-colors leading-none">{item.id}</div>
                <div className={`w-16 h-16 rounded-2xl ${item.color} flex items-center justify-center text-white mb-8 shadow-lg shadow-black/10`}>
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                <h4 className="text-sm font-semibold text-blue-600 mb-6 uppercase tracking-wider">{item.subtitle}</h4>
                <p className="text-muted-foreground leading-relaxed text-lg">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features/Scenarios Section */}
      <section id="scenarios" className="py-24 lg:py-40 bg-white dark:bg-[#050505] text-slate-900 dark:text-white scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row justify-between items-end gap-10 mb-24">
            <div className="max-w-2xl space-y-6">
              <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">核心场景演绎</h2>
              <p className="text-xl text-slate-600 dark:text-white/50">让 AI 深入你的每一个阅读瞬间</p>
            </div>
            <div className="hidden lg:block h-px flex-1 bg-slate-200 dark:bg-white/10 mx-10 mb-6" />
          </div>

          <div className="space-y-32">
            {[
              {
                title: "通勤路上的“专属电台”",
                subtitle: "把文章“听”进脑子里",
                desc: "不要浪费碎片时间。NewsBox 每日为你生成“专属简报”。由 AI 主播为你综合播报关注领域，甚至将长文转化为对话式 Podcast。",
                icon: Radio,
                img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=2070&auto=format&fit=crop"
              },
              {
                title: "视频新闻的“文本化阅读”",
                subtitle: "像查字典一样查视频",
                desc: "自动为视频生成带时间戳的逐字稿和章节目录。支持语音转文字、关键帧提取、金句一键复制，让音视频素材像图文一样易于检索。",
                icon: Video,
                img: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop"
              },
              {
                title: "写稿时的“灵感矿工”",
                subtitle: "让过去的积累成为今天的子弹",
                desc: "写作时 NewsBox 会自动浮现过去收藏的相关数据、专家观点。一键生成规范引用格式，建立你私有的事实核查库。",
                icon: PenTool,
                img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=2073&auto=format&fit=crop"
              }
            ].map((scene, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-16 lg:gap-32`}
              >
                <div className="flex-1 space-y-8">
                  <div className="inline-flex p-4 rounded-3xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
                    <scene.icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl lg:text-4xl font-bold leading-tight">{scene.title}</h3>
                    <p className="text-xl font-medium text-blue-400">{scene.subtitle}</p>
                  </div>
                  <p className="text-xl text-slate-600 dark:text-white/50 leading-relaxed max-w-xl">{scene.desc}</p>
                </div>
                <div className="flex-1 w-full aspect-[4/3] rounded-[48px] overflow-hidden relative group">
                  <img src={scene.img} alt={scene.title} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-32 lg:py-48 relative overflow-hidden bg-white dark:bg-slate-900">
        <div className="absolute inset-0 bg-blue-600/5 dark:bg-blue-600/10 -z-20" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)] -z-10" />
        
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl mx-auto space-y-12"
          >
            <motion.h2 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 1.2, 
                ease: [0.34, 1.56, 0.64, 1] // 带一点弹性效果的放大
              }}
  
              className="text-3xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[2.0]"
              style={{
                WebkitBackgroundClip: 'text',
                
              }}
            >
              <span className="block mb-4 lg:mb-8">打造面向未来</span>
  <span className="block">历久弥新的阅读方式</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="text-lg lg:text-xl text-muted-foreground leading-[2] font-medium max-w-3xl mx-auto"
              style={{
                fontSize:'18px'
              }}
            >
              在算法推荐横行的时代，NewsBox 坚持把“选择权”和“记忆权”交还给你<br className="hidden lg:block" />
              我们不生产新闻，我们只让优质的新闻在它的生命周期里，<br className="hidden lg:block" />被你读懂、记住、并创造新的价值。
            </motion.p>
            <div className="pt-8">
              <Link href="/auth/sign-up">
                <Button size="lg" className="h-16 px-12 rounded-full text-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">
                  即刻加入 NewsBox
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            
            
            <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-muted-foreground">
              <Link href="#" className="hover:text-blue-600 transition-colors">隐私政策</Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">服务条款</Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">联系我们</Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">关于我们</Link>
            </div>

            <p className="text-sm text-muted-foreground/70">
              © 2025 NewsBox. Designed for professional readers.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
