import { extractPageContent } from "./extractor";
import { extractVideoCapture, findExtractor } from "./video-extractors";

// Listen for messages from background service worker or popup
chrome.runtime.onMessage.addListener(
  (message: { type: string }, _sender, sendResponse) => {
    switch (message.type) {
      case "EXTRACT_CONTENT": {
        try {
          const content = extractPageContent();
          sendResponse({ success: true, data: content });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Extraction failed",
          });
        }
        break;
      }

      case "EXTRACT_SELECTION": {
        try {
          const selection = window.getSelection()?.toString().trim() || "";
          sendResponse({ success: true, data: selection });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Extraction failed",
          });
        }
        break;
      }

      case "PING": {
        // Health check - confirms content script is loaded
        sendResponse({ success: true });
        break;
      }

      case "CHECK_VIDEO_PLATFORM": {
        // Check if current page is a supported video platform
        try {
          const extractor = findExtractor(window.location.href, document);
          sendResponse({ success: true, data: { isVideo: extractor !== null } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Check failed",
          });
        }
        break;
      }

      case "EXTRACT_VIDEO": {
        // Extract video capture data from current page (async)
        extractVideoCapture(window.location.href, document)
          .then((capture) => {
            sendResponse({ success: true, data: capture });
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Video extraction failed",
            });
          });
        // Return true to keep message channel open for async response
        return true;
      }

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }

    // Return true to indicate we will send a response asynchronously
    return true;
  }
);
