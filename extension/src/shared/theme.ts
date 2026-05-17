import { getTheme, setTheme as saveTheme } from "./storage";

type Theme = "light" | "dark" | "system";

/** Get the resolved theme (resolves "system" to actual value) */
export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply theme class to a root element */
export function applyTheme(theme: "light" | "dark", root: HTMLElement = document.documentElement) {
  root.classList.toggle("dark", theme === "dark");
}

/** Initialize theme: load preference, apply, and listen for system changes */
export async function initTheme(root?: HTMLElement) {
  const pref = await getTheme();
  const resolved = pref === "system" ? getSystemTheme() : pref;
  applyTheme(resolved, root);

  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
    const current = await getTheme();
    if (current === "system") {
      applyTheme(getSystemTheme(), root);
    }
  });
}

/** Set and apply theme preference */
export async function setTheme(theme: Theme, root?: HTMLElement) {
  await saveTheme(theme);
  const resolved = theme === "system" ? getSystemTheme() : theme;
  applyTheme(resolved, root);
}
