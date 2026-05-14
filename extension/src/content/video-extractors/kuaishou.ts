import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

export class KuaishouExtractor implements IVideoExtractor {
  platform = 'kuaishou' as const;

  matches(url: string): boolean {
    return /kuaishou\.com\/short-video\//.test(url) || /v\.kuaishou\.com\//.test(url);
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video?.src) {
      throw new VideoExtractionError(this.platform, 'video element src not found');
    }

    const title = (
      document.querySelector('h1')?.textContent?.trim()
      ?? document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim()
      ?? document.title
    ) || '快手视频';

    const authorEl = document.querySelector('a[href*="/profile/"]');
    const authorName = authorEl?.textContent?.trim() || undefined;
    const coverUrl = video.poster || undefined;

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl: video.src,
      videoHeaders: { Referer: 'https://www.kuaishou.com/' },
      recommendedStrategy: 'server',
      meta: { title: title || '快手视频', authorName, coverUrl },
    };
  }
}

// TODO: 真实快手 PC 页面可能使用动态 blob URL 或 HLS 流，而非直接 mp4 src。
// 需手工打开 https://www.kuaishou.com/short-video/<id> 验证 <video> 的实际 src 形态。
