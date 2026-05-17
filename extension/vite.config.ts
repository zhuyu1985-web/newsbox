import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, cpSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from "fs";

const BROWSERS = ["chrome", "firefox", "safari"] as const;
const LEGACY_SUPABASE_PATTERN = "https://*.supabase.co/*";

// 从 VITE_SUPABASE_URL 推导 host_permissions 中需要追加/替换的匹配模式
// - Cloud (*.supabase.co)  → 保持 wildcard
// - 自托管 / 内网          → 用具体的 ${protocol}//${hostname}/*
function deriveSupabaseHostPattern(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const u = new URL(supabaseUrl);
    if (u.hostname.endsWith(".supabase.co")) return LEGACY_SUPABASE_PATTERN;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

// 把 manifest.host_permissions 中的 legacy supabase.co 条目替换为目标 pattern
function patchManifestHostPermissions(manifestPath: string, targetPattern: string) {
  if (!existsSync(manifestPath)) return;
  const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (!Array.isArray(m.host_permissions)) return;

  let touched = false;
  m.host_permissions = m.host_permissions.map((p: string) => {
    if (p === LEGACY_SUPABASE_PATTERN && targetPattern !== LEGACY_SUPABASE_PATTERN) {
      touched = true;
      return targetPattern;
    }
    return p;
  });
  if (!m.host_permissions.includes(targetPattern)) {
    m.host_permissions.push(targetPattern);
    touched = true;
  }
  if (touched) writeFileSync(manifestPath, JSON.stringify(m, null, 2));
}

// Plugin to fix output paths and generate per-browser dist directories
function extensionBuildPlugin(supabaseHostPattern: string | null) {
  return {
    name: "extension-build",
    closeBundle() {
      const dist = resolve(__dirname, "dist");

      // Fix popup HTML path: dist/src/popup/index.html → dist/popup/index.html
      const wrongPath = resolve(dist, "src/popup/index.html");
      const correctPath = resolve(dist, "popup/index.html");
      if (existsSync(wrongPath)) {
        let html = readFileSync(wrongPath, "utf-8");
        html = html.replace(/\.\.\/\.\.\/popup\//g, "./");
        html = html.replace(/\.\.\/\.\.\//g, "../");
        writeFileSync(correctPath, html);
        rmSync(resolve(dist, "src"), { recursive: true, force: true });
      }

      // Copy icons into dist/
      const iconsDir = resolve(__dirname, "public/icons");
      const distIcons = resolve(dist, "icons");
      if (!existsSync(distIcons)) mkdirSync(distIcons, { recursive: true });
      if (existsSync(iconsDir)) {
        for (const file of readdirSync(iconsDir)) {
          if (file.startsWith(".")) continue;
          copyFileSync(resolve(iconsDir, file), resolve(distIcons, file));
        }
      }

      // Generate per-browser directories: dist-chrome/, dist-firefox/, dist-safari/
      for (const browser of BROWSERS) {
        const browserDist = resolve(__dirname, `dist-${browser}`);
        const manifestSrc = resolve(__dirname, `manifests/${browser}.json`);

        if (!existsSync(manifestSrc)) continue;

        // Copy shared build output
        if (existsSync(browserDist)) rmSync(browserDist, { recursive: true });
        cpSync(dist, browserDist, { recursive: true });

        // Write browser-specific manifest
        copyFileSync(manifestSrc, resolve(browserDist, "manifest.json"));
      }

      // Also copy default (chrome) manifest into dist/ for backwards compatibility
      const chromeManifest = resolve(__dirname, "manifests/chrome.json");
      if (existsSync(chromeManifest)) {
        copyFileSync(chromeManifest, resolve(dist, "manifest.json"));
      }

      // Patch host_permissions: 替换 legacy supabase.co 为当前 VITE_SUPABASE_URL 派生的 pattern
      if (supabaseHostPattern) {
        for (const browser of BROWSERS) {
          patchManifestHostPermissions(
            resolve(__dirname, `dist-${browser}`, "manifest.json"),
            supabaseHostPattern,
          );
        }
        patchManifestHostPermissions(resolve(dist, "manifest.json"), supabaseHostPattern);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const supabaseHostPattern = deriveSupabaseHostPattern(env.VITE_SUPABASE_URL);
  if (supabaseHostPattern) {
    console.log(`[extension-build] Supabase host_permissions pattern: ${supabaseHostPattern}`);
  } else {
    console.warn(`[extension-build] VITE_SUPABASE_URL not set; keeping default host_permissions`);
  }

  return {
  base: "./",
  plugins: [react(), extensionBuildPlugin(supabaseHostPattern)],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@popup": resolve(__dirname, "src/popup"),
    },
  },
  build: {
    outDir: "dist",
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background/service-worker.js";
          if (chunkInfo.name === "content") return "content/index.js";
          return "popup/[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "popup/[name][extname]";
          return "assets/[name][extname]";
        },
      },
    },
  },
  };
});
