export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Try modern Clipboard API first (requires a focused document + user gesture in many browsers).
  try {
    if (navigator.clipboard?.writeText) {
      if (typeof window.focus === "function" && !document.hasFocus()) {
        window.focus();
      }
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }

  // Fallback: execCommand('copy') via a temporary textarea.
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand?.("copy") ?? false;
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

