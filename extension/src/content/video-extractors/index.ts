import type { IVideoExtractor, VideoCapture } from './base';
import { BilibiliExtractor } from './bilibili';
import { DouyinExtractor } from './douyin';
import { KuaishouExtractor } from './kuaishou';
import { WeiboExtractor } from './weibo';
import { WeixinChannelExtractor } from './weixin-channel';

const REGISTRY: IVideoExtractor[] = [
  new BilibiliExtractor(),
  new DouyinExtractor(),
  new KuaishouExtractor(),
  new WeiboExtractor(),
  new WeixinChannelExtractor(),
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
