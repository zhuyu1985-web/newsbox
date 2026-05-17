import { useState, useEffect } from "react";
import { getApiUrl, setApiUrl, DEFAULT_API_URL } from "@shared/storage";

interface Props {
  onClose: () => void;
}

const PRESETS = [
  { label: "云端", value: "https://huasheng.cloud" },
  { label: "本地 :3000", value: "http://localhost:3000" },
  { label: "本地 :3001", value: "http://localhost:3001" },
  { label: "本地 :3002", value: "http://localhost:3002" },
];

/** Convert a URL to a host_permission match pattern (e.g. https://foo.com/*). */
function urlToMatchPattern(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

/** Ensure the extension has host permission for the given URL.
 * Returns true if permission is granted (either already, or just approved by user).
 */
async function ensureHostPermission(rawUrl: string): Promise<boolean> {
  const pattern = urlToMatchPattern(rawUrl);
  if (!pattern) return false;

  const has = await chrome.permissions.contains({ origins: [pattern] });
  if (has) return true;

  // Will trigger Chrome's permission prompt
  return chrome.permissions.request({ origins: [pattern] });
}

export function SettingsView({ onClose }: Props) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | "no-permission" | null>(null);
  const [hasPermission, setHasPermission] = useState(true);

  useEffect(() => {
    getApiUrl().then(setUrl);
  }, []);

  // Check whether the current URL has host permission
  useEffect(() => {
    const pattern = urlToMatchPattern(url);
    if (!pattern) { setHasPermission(false); return; }
    chrome.permissions.contains({ origins: [pattern] }).then(setHasPermission);
  }, [url]);

  const handleSave = async () => {
    if (!url.trim()) return;
    setSaving(true);
    setTestResult(null);
    try {
      const granted = await ensureHostPermission(url);
      if (!granted) {
        setTestResult("no-permission");
        return;
      }
      await setApiUrl(url.trim());
      setHasPermission(true);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const granted = await ensureHostPermission(url);
      if (!granted) {
        setTestResult("no-permission");
        return;
      }
      setHasPermission(true);
      const target = url.trim().replace(/\/+$/, "");
      const res = await fetch(`${target}/api/extension/meta`, {
        method: "GET",
        headers: { Authorization: "Bearer probe" },
      });
      // 401 (auth required, endpoint exists) or 200 = reachable
      setTestResult(res.status === 401 || res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    setUrl(DEFAULT_API_URL);
    await setApiUrl(DEFAULT_API_URL);
    setSavedAt(Date.now());
  };

  const handleRequestPermission = async () => {
    const granted = await ensureHostPermission(url);
    setHasPermission(granted);
    if (granted) setTestResult(null);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            title="返回"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-foreground">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-foreground">设置</span>
        </div>
      </div>

      {/* API URL */}
      <div className="mb-3">
        <label className="block text-xs text-muted-foreground mb-1.5">服务端地址</label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
          placeholder="https://your-server.com"
          className="w-full h-9 px-3 rounded-xl bg-secondary/50 border border-border
                     text-sm text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary
                     transition-all"
        />
      </div>

      {/* Presets */}
      <div className="mb-3">
        <label className="block text-xs text-muted-foreground mb-1.5">快速切换</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setUrl(p.value); setTestResult(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                ${url === p.value
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/50 text-foreground hover:bg-secondary border border-transparent"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Permission warning for custom domains */}
      {url.trim() && !hasPermission && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-xs">
          <p className="text-amber-700 dark:text-amber-400 mb-1.5">
            ⚠️ 该域名需要授权才能访问
          </p>
          <button
            onClick={handleRequestPermission}
            className="text-amber-700 dark:text-amber-400 underline hover:no-underline font-medium"
          >
            点此授权
          </button>
        </div>
      )}

      {/* Test result */}
      {testResult === "ok" && (
        <p className="text-xs px-3 py-2 rounded-lg mb-3 text-green-600 dark:text-green-400 bg-green-500/10">
          ✓ 连接正常
        </p>
      )}
      {testResult === "fail" && (
        <p className="text-xs px-3 py-2 rounded-lg mb-3 text-destructive bg-destructive/10">
          ✗ 无法连接，请检查地址或服务是否启动
        </p>
      )}
      {testResult === "no-permission" && (
        <p className="text-xs px-3 py-2 rounded-lg mb-3 text-amber-700 dark:text-amber-400 bg-amber-500/10">
          ⚠️ 未授权访问该域名
        </p>
      )}

      {savedAt && Date.now() - savedAt < 3000 && (
        <p className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-3 py-2 rounded-lg mb-3">
          ✓ 已保存
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !url.trim()}
          className="flex-1 h-9 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium
                     hover:bg-secondary/80 active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all"
        >
          {testing ? "测试中..." : "测试连接"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !url.trim()}
          className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium
                     hover:bg-primary/90 active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      <button
        onClick={handleReset}
        className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        恢复默认（{DEFAULT_API_URL}）
      </button>
    </div>
  );
}
