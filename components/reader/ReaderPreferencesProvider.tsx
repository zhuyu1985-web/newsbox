"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";

const STORAGE_KEY = "newsbox:readerPreferences:v1";
const CUSTOM_FONT_KEY = "newsbox:readerCustomFont";

export type ReaderTheme = "auto" | "light" | "dark" | "sepia";
export type ReaderLineHeight = "compact" | "comfortable" | "loose";
export type ReaderFontFamily = "system" | "serif" | "sans" | "mono" | "custom";

// Helper to map next-themes values to reader theme values
function mapNextThemeToReaderTheme(nextTheme: string | undefined): ReaderTheme {
  if (nextTheme === "dark") return "dark";
  if (nextTheme === "light") return "light";
  return "auto"; // system or undefined -> auto
}

export type ReaderPreferences = {
  fontSize: number; // px
  lineHeight: ReaderLineHeight;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  maxWidth: number; // px
};

const DEFAULT_PREFS: ReaderPreferences = {
  fontSize: 18,
  lineHeight: "comfortable",
  theme: "auto",
  fontFamily: "system",
  maxWidth: 720,
};

type StoredFont = {
  name: string;
  dataUrl: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resolveLineHeight(preset: ReaderLineHeight): number {
  switch (preset) {
    case "compact":
      return 1.7;
    case "loose":
      return 2.2;
    case "comfortable":
    default:
      return 2.0;
  }
}

function resolveFontStack(fontFamily: ReaderFontFamily, customFamilyName?: string) {
  const system = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";
  const serif = "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif";
  const sans = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial";
  const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

  if (fontFamily === "custom" && customFamilyName) {
    return `"${customFamilyName}", ${system}`;
  }

  if (fontFamily === "serif") return `${serif}, ${system}`;
  if (fontFamily === "sans") return `${sans}, ${system}`;
  if (fontFamily === "mono") return `${mono}`;

  return system;
}

type ReaderPreferencesContextValue = {
  prefs: ReaderPreferences;
  setPrefs: (next: Partial<ReaderPreferences> | ((prev: ReaderPreferences) => Partial<ReaderPreferences>)) => void;
  reset: () => void;
  lineHeightValue: number;
  fontStack: string;
  hasCustomFont: boolean;
};

const ReaderPreferencesContext = createContext<ReaderPreferencesContextValue | null>(null);

export function ReaderPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // Ref to track initial sync
  const initialSyncDoneRef = useRef(false);

  const [customFont, setCustomFont] = useState<StoredFont | null>(null);
  const [prefs, setPrefsState] = useState<ReaderPreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PREFS;
      const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        fontSize: clamp(Number(parsed.fontSize ?? DEFAULT_PREFS.fontSize), 12, 28),
        maxWidth: clamp(Number(parsed.maxWidth ?? DEFAULT_PREFS.maxWidth), 560, 1100),
      };
    } catch {
      return DEFAULT_PREFS;
    }
  });

  // load custom font from localStorage (if any)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_FONT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredFont;
      if (parsed?.name && parsed?.dataUrl) {
        setCustomFont(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // inject @font-face for custom font
  useEffect(() => {
    const styleId = "newsbox-reader-custom-font-style";
    const family = "NewsBox Custom";

    const existing = document.getElementById(styleId);
    if (!customFont?.dataUrl) {
      if (existing) existing.remove();
      return;
    }

    const css = `@font-face { font-family: "${family}"; src: url(${customFont.dataUrl}); font-display: swap; }`;

    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;

    if (existing) existing.remove();
    document.head.appendChild(styleEl);

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [customFont]);

  // persist prefs
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  // Sync: next-themes -> ReaderPreferences (one-way sync only)
  // When user changes theme via AnimatedThemeSwitcher, sync to reader preferences for persistence
  // We do NOT sync in the opposite direction to allow the global theme switcher to work freely
  useEffect(() => {
    // Skip initial sync to avoid overriding stored prefs on mount
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      return;
    }

    // Map next-themes theme to reader theme
    const readerTheme = mapNextThemeToReaderTheme(theme);

    // Only update if different to avoid unnecessary renders
    if (readerTheme !== prefs.theme) {
      setPrefsState((prev) => ({ ...prev, theme: readerTheme }));
    }
  }, [theme]);

  const setPrefs = useCallback<ReaderPreferencesContextValue["setPrefs"]>((next) => {
    setPrefsState((prev) => {
      const patch = typeof next === "function" ? next(prev) : next;
      const merged = { ...prev, ...patch } as ReaderPreferences;
      return {
        ...merged,
        fontSize: clamp(Number(merged.fontSize), 12, 28),
        maxWidth: clamp(Number(merged.maxWidth), 560, 1100),
      };
    });
  }, []);

  const reset = useCallback(() => setPrefsState(DEFAULT_PREFS), []);

  const lineHeightValue = useMemo(() => resolveLineHeight(prefs.lineHeight), [prefs.lineHeight]);

  const fontStack = useMemo(
    () => resolveFontStack(prefs.fontFamily, customFont?.dataUrl ? "NewsBox Custom" : undefined),
    [prefs.fontFamily, customFont],
  );

  const value = useMemo<ReaderPreferencesContextValue>(
    () => ({
      prefs,
      setPrefs,
      reset,
      lineHeightValue,
      fontStack,
      hasCustomFont: !!customFont?.dataUrl,
    }),
    [prefs, setPrefs, reset, lineHeightValue, fontStack, customFont],
  );

  return <ReaderPreferencesContext.Provider value={value}>{children}</ReaderPreferencesContext.Provider>;
}

export function useReaderPreferences() {
  const ctx = useContext(ReaderPreferencesContext);
  if (!ctx) {
    throw new Error("useReaderPreferences must be used within ReaderPreferencesProvider");
  }
  return ctx;
}
