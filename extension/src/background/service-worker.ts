import { api } from "../shared/api";
import { isLoggedIn, getToken } from "../shared/auth";
import type { ExtractedContent, SaveNoteRequest } from "../shared/types";
import { uploadVideoBytes } from "./video-uploader";

// ============================================================
// Context Menu Setup
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: "save-page",
    title: "保存此页面到 NewsBox",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "save-link",
    title: "保存此链接到 NewsBox",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "save-selection",
    title: "保存选中文本到 NewsBox",
    contexts: ["selection"],
  });
});

// ============================================================
// Context Menu Click Handler
// ============================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    showNotification("请先登录", "点击 NewsBox 插件图标登录后再试");
    return;
  }

  try {
    switch (info.menuItemId) {
      case "save-page": {
        if (!tab?.id) return;
        await saveCurrentPage(tab.id, tab.url || "");
        break;
      }
      case "save-link": {
        if (!info.linkUrl) return;
        await saveByUrl(info.linkUrl);
        break;
      }
      case "save-selection": {
        if (!info.selectionText) return;
        await saveSelection(info.selectionText, tab?.url || "");
        break;
      }
    }
  } catch (error) {
    showNotification("保存失败", error instanceof Error ? error.message : "未知错误");
  }
});

// ============================================================
// Keyboard Shortcut Handler
// ============================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-page") return;

  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    showNotification("请先登录", "点击 NewsBox 插件图标登录后再试");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    await saveCurrentPage(tab.id, tab.url);
  } catch (error) {
    showNotification("保存失败", error instanceof Error ? error.message : "未知错误");
  }
});

// ============================================================
// Message Handler (Popup -> Background)
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHECK_AUTH") {
    isLoggedIn().then((loggedIn) => sendResponse({ loggedIn }));
    return true;
  }
  if (message?.type === "video:browser-upload") {
    uploadVideoBytes(message.capture, message.cred);
    // fire-and-forget; no sendResponse needed
  }
  return false;
});

// ============================================================
// Core Save Functions
// ============================================================

/** Save the current page by extracting content via content script */
async function saveCurrentPage(tabId: number, url: string): Promise<void> {
  // Send message to content script to extract content
  const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" });

  if (!response?.success) {
    // Content script not loaded, save by URL only
    await saveByUrl(url);
    return;
  }

  const content: ExtractedContent = response.data;

  const result = await api.saveNote({
    source_url: content.url,
    title: content.title,
    excerpt: content.excerpt,
    content_html: content.contentHtml,
    content_text: content.contentText,
    cover_image_url: content.coverImageUrl || undefined,
    author: content.author || undefined,
    site_name: content.siteName || undefined,
    published_at: content.publishedAt || undefined,
    content_type: content.contentType,
  });

  showNotification(
    "已保存",
    `"${content.title}" 已保存到 NewsBox`
  );
}

/** Save by URL only (server will do the extraction) */
async function saveByUrl(url: string): Promise<void> {
  const result = await api.saveNote({
    source_url: url,
  });

  showNotification(
    "已保存",
    "链接已保存到 NewsBox，正在后台抓取内容..."
  );
}

/** Save selected text as a quick note */
async function saveSelection(text: string, pageUrl: string): Promise<void> {
  const result = await api.saveNote({
    source_url: pageUrl,
    title: text.substring(0, 100),
    content_text: text,
    content_html: `<blockquote>${escapeHtml(text)}</blockquote>`,
    excerpt: text.substring(0, 200),
  });

  showNotification(
    "已保存",
    "选中文本已保存到 NewsBox"
  );
}

// ============================================================
// Helpers
// ============================================================

function showNotification(title: string, message: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title,
    message,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
