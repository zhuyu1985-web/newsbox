export type Platform = 'douyin' | 'bilibili' | 'weibo' | 'kuaishou' | 'weixin-channel';

export interface VideoCapture {
  platform: Platform;
  sourceUrl: string;
  videoUrl: string;
  videoHeaders?: Record<string, string>;
  /**
   * DASH 分轨平台（B 站等）的音频流 URL。
   * 与 videoUrl 同源不同流，需要浏览器分别下载并交由 COS CI <AudioMix> 合流。
   * 为空表示视频源自带音轨或无音轨。
   */
  audioUrl?: string;
  audioHeaders?: Record<string, string>;
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
