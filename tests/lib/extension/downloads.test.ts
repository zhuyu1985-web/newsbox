import { describe, expect, it } from "vitest";
import {
  getExtensionDownload,
  listExtensionDownloads,
} from "@/lib/extension/downloads";

describe("extension downloads", () => {
  it("maps Edge to the Chrome-compatible package with an Edge download name", () => {
    expect(getExtensionDownload("edge")).toMatchObject({
      target: "edge",
      sourceFile: "newsbox-chrome.zip",
      downloadName: "newsbox-edge.zip",
    });
  });

  it("rejects unsupported download targets", () => {
    expect(getExtensionDownload("opera")).toBeNull();
  });

  it("lists all supported browser targets", () => {
    expect(listExtensionDownloads().map((item) => item.target).sort()).toEqual([
      "chrome",
      "edge",
      "firefox",
      "safari",
    ]);
  });
});
