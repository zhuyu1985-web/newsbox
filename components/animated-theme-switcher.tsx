"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";

interface AnimatedThemeSwitcherProps {
  variant?: "default" | "compact";
}

export function AnimatedThemeSwitcher({ variant = "default" }: AnimatedThemeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // 调试：监听主题变化
    const handleStorageChange = () => {
      console.log("[ThemeSwitcher] Storage changed, new theme:", localStorage.getItem("newsbox-theme"));
      console.log("[ThemeSwitcher] HTML class:", document.documentElement.className);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className={variant === "compact" ? "w-[46px] h-[46px]" : "w-10 h-10"} />
    );
  }

  const themes = [
    { value: "light", icon: Sun, label: "浅色" },
    { value: "dark", icon: Moon, label: "深色" },
    { value: "system", icon: Laptop, label: "自动" },
  ];

  const currentTheme = themes.find((t) => t.value === (theme || "system")) || themes[2];
  const CurrentIcon = currentTheme.icon;

  const handleThemeChange = (value: string) => {
    console.log("[ThemeSwitcher] =========================================");
    console.log("[ThemeSwitcher] Changing theme to:", value);
    console.log("[ThemeSwitcher] HTML class BEFORE:", document.documentElement.className);

    setTheme(value);

    // 延迟检查
    setTimeout(() => {
      console.log("[ThemeSwitcher] HTML class AFTER:", document.documentElement.className);
      console.log("[ThemeSwitcher] localStorage theme:", localStorage.getItem("newsbox-theme"));
    }, 100);

    setIsOpen(false);
  };

  // 紧凑模式：与 Dashboard 按钮样式一致
  if (variant === "compact") {
    return (
      <div ref={containerRef} className="relative">
        {/* 触发按钮 */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="w-[46px] h-[46px] rounded-[15px] flex items-center justify-center text-[#4A4A4A] dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1A1A1A] dark:hover:text-slate-200 transition-all duration-200 ease-out group"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={`当前主题: ${currentTheme.label}`}
        >
          <CurrentIcon className="h-[22px] w-[22px] stroke-[1.8px] transition-transform duration-200 group-hover:scale-110" />
        </motion.button>

        {/* 弹出菜单 */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className="absolute top-full mt-2 left-0 z-50"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden min-w-[140px]">
                {themes.map((item, index) => {
                  const isActive = theme === item.value;
                  const Icon = item.icon;

                  return (
                    <motion.button
                      key={item.value}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.05,
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                      onClick={() => handleThemeChange(item.value)}
                      className={`
                        w-full px-4 py-2.5 flex items-center gap-3
                        transition-colors relative
                        ${
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }
                        ${index !== themes.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}
                      `}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-theme-bg"
                          className="absolute inset-0 bg-blue-50 dark:bg-blue-950/30"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <Icon className="w-4 h-4 relative z-10" />
                      <span className="text-sm font-medium relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 默认模式：标准尺寸
  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`当前主题: ${currentTheme.label}`}
      >
        <CurrentIcon className="w-5 h-5" />
      </motion.button>

      {/* 弹出菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            className="absolute top-full mt-2 right-0 z-50"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden min-w-[140px]">
              {themes.map((item, index) => {
                const isActive = theme === item.value;
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.value}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                    onClick={() => handleThemeChange(item.value)}
                    className={`
                      w-full px-3 py-2 flex items-center gap-2
                      transition-colors relative
                      ${
                        isActive
                          ? "text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }
                      ${index !== themes.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
