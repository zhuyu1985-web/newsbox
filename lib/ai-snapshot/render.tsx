import { ImageResponse } from "@vercel/og";
import type { SnapshotCardData } from "@/lib/services/snapshot";
import type { SnapshotTemplate } from "./types";
import { BusinessCard, DeepCard, SocialCard } from "./cards";

export const SNAPSHOT_IMAGE_WIDTH = 1200;
export const SNAPSHOT_IMAGE_HEIGHT = 1600;

export function renderSnapshotImageResponse(template: SnapshotTemplate, cardData: SnapshotCardData) {
  const element =
    template === "business" ? (
      <BusinessCard data={cardData} />
    ) : template === "deep" ? (
      <DeepCard data={cardData} />
    ) : (
      <SocialCard data={cardData} />
    );

  return new ImageResponse(element, {
    width: SNAPSHOT_IMAGE_WIDTH,
    height: SNAPSHOT_IMAGE_HEIGHT,
  });
}
