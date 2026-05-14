export type Platform = 'douyin' | 'bilibili' | 'weibo' | 'kuaishou' | 'weixin-channel';

export interface VideoCapture {
  platform: Platform;
  sourceUrl: string;
  videoUrl: string;
  videoHeaders?: Record<string, string>;
  recommendedStrategy: 'server' | 'browser';
  meta: {
    title: string;
    authorName?: string;
    authorUrl?: string;
    coverUrl?: string;
    durationSec?: number;
    publishedAt?: string;
  };
}

export interface IVideoExtractor {
  platform: Platform;
  matches(url: string, doc: Document): boolean;
  extract(): Promise<VideoCapture>;
}

export class VideoExtractionError extends Error {
  constructor(public readonly platform: Platform, message: string) {
    super(`[${platform}] ${message}`);
  }
}
