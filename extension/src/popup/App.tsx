import { useState, useEffect } from "react";
import { isLoggedIn } from "@shared/auth";
import { LoginView } from "./components/LoginView";
import { SaveView } from "./components/SaveView";
import { SuccessView } from "./components/SuccessView";
import { SettingsView } from "./components/SettingsView";
import { VideoSaveView } from "./components/VideoSaveView";
import type { VideoCapture } from "../content/video-extractors/base";

type View = "loading" | "login" | "save" | "video-save" | "success" | "settings";

export function App() {
  const [view, setView] = useState<View>("loading");
  const [previousView, setPreviousView] = useState<View>("save");
  const [savedNoteId, setSavedNoteId] = useState<string>("");
  const [tabUrl, setTabUrl] = useState<string>("");
  const [videoCapture, setVideoCapture] = useState<VideoCapture | null>(null);

  useEffect(() => {
    isLoggedIn().then((loggedIn) => {
      if (!loggedIn) {
        setView("login");
        return;
      }

      // Detect if current tab is a video platform
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id || !tab.url) {
          setView("save");
          return;
        }

        setTabUrl(tab.url);

        chrome.tabs.sendMessage(
          tab.id,
          { type: "CHECK_VIDEO_PLATFORM" },
          (checkResponse) => {
            if (chrome.runtime.lastError || !checkResponse?.success || !checkResponse.data?.isVideo) {
              // Not a video platform or content script not loaded — show regular save view
              setView("save");
              return;
            }

            // Is a video platform — extract capture data
            chrome.tabs.sendMessage(
              tab.id!,
              { type: "EXTRACT_VIDEO" },
              (extractResponse) => {
                if (chrome.runtime.lastError || !extractResponse?.success || !extractResponse.data) {
                  // Extraction failed — fall back to regular save view
                  setView("save");
                  return;
                }

                setVideoCapture(extractResponse.data as VideoCapture);
                setView("video-save");
              }
            );
          }
        );
      });
    });
  }, []);

  const handleLoginSuccess = () => setView("save");

  const handleSaveSuccess = (noteId: string) => {
    setSavedNoteId(noteId);
    setView("success");
  };

  const handleSaveAnother = () => setView("save");

  const handleOpenSettings = () => {
    setPreviousView(view);
    setView("settings");
  };

  const handleCloseSettings = () => setView(previousView);

  if (view === "loading") {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-[380px] max-h-[520px] overflow-y-auto">
      {view === "login" && (
        <LoginView onSuccess={handleLoginSuccess} onOpenSettings={handleOpenSettings} />
      )}
      {view === "save" && (
        <SaveView onSuccess={handleSaveSuccess} onOpenSettings={handleOpenSettings} />
      )}
      {view === "video-save" && videoCapture && (
        <VideoSaveView
          tabUrl={tabUrl}
          capture={videoCapture}
          onOpenSettings={handleOpenSettings}
        />
      )}
      {view === "success" && (
        <SuccessView noteId={savedNoteId} onSaveAnother={handleSaveAnother} />
      )}
      {view === "settings" && <SettingsView onClose={handleCloseSettings} />}
    </div>
  );
}
