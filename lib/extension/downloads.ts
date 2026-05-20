export type ExtensionTarget = "chrome" | "edge" | "firefox" | "safari";

export type ExtensionDownload = {
  target: ExtensionTarget;
  label: string;
  sourceFile: string;
  downloadName: string;
  contentType: string;
};

const ZIP_CONTENT_TYPE = "application/zip";

const EXTENSION_DOWNLOADS: Record<ExtensionTarget, ExtensionDownload> = {
  chrome: {
    target: "chrome",
    label: "Chrome",
    sourceFile: "newsbox-chrome.zip",
    downloadName: "newsbox-chrome.zip",
    contentType: ZIP_CONTENT_TYPE,
  },
  edge: {
    target: "edge",
    label: "Microsoft Edge",
    sourceFile: "newsbox-chrome.zip",
    downloadName: "newsbox-edge.zip",
    contentType: ZIP_CONTENT_TYPE,
  },
  firefox: {
    target: "firefox",
    label: "Firefox",
    sourceFile: "newsbox-firefox.zip",
    downloadName: "newsbox-firefox.zip",
    contentType: ZIP_CONTENT_TYPE,
  },
  safari: {
    target: "safari",
    label: "Safari",
    sourceFile: "newsbox-safari.zip",
    downloadName: "newsbox-safari.zip",
    contentType: ZIP_CONTENT_TYPE,
  },
};

export function getExtensionDownload(target: string): ExtensionDownload | null {
  const normalized = target.trim().toLowerCase();
  if (normalized in EXTENSION_DOWNLOADS) {
    return EXTENSION_DOWNLOADS[normalized as ExtensionTarget];
  }
  return null;
}

export function listExtensionDownloads() {
  return Object.values(EXTENSION_DOWNLOADS);
}
