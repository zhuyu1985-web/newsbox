import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

export class DouyinExtractor implements IVideoExtractor {
  platform = 'douyin' as const;

  matches(url: string): boolean {
    return /douyin\.com\/video\//.test(url);
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video?.src) {
      throw new VideoExtractionError(this.platform, 'video element src not found');
    }

    const title =
      document.querySelector('h1')?.textContent?.trim()
      ?? document.title;

    const authorName = document.querySelector('a[href*="/user/"]')?.textContent?.trim();
    const coverUrl = video.poster || undefined;

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl: video.src,
      videoHeaders: { Referer: 'https://www.douyin.com/' },
      recommendedStrategy: 'server',
      meta: { title: title || '抖音视频', authorName, coverUrl },
    };
  }
}
