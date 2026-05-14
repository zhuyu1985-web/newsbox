import type { IVideoExtractor, VideoCapture } from './base';
import { DouyinExtractor } from './douyin';
import { KuaishouExtractor } from './kuaishou';
import { WeiboExtractor } from './weibo';

const REGISTRY: IVideoExtractor[] = [
  new DouyinExtractor(),
  new KuaishouExtractor(),
  new WeiboExtractor(),
];

export function findExtractor(url: string, doc: Document = document): IVideoExtractor | null {
  return REGISTRY.find(e => e.matches(url, doc)) ?? null;
}

export async function extractVideoCapture(url: string, doc: Document = document): Promise<VideoCapture | null> {
  const extractor = findExtractor(url, doc);
  if (!extractor) return null;
  return await extractor.extract();
}

export type { VideoCapture, Platform, IVideoExtractor } from './base';
export { VideoExtractionError } from './base';
