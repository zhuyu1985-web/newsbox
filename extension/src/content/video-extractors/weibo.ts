import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

// Candidate selectors for author name on Weibo pages (PC web)
const AUTHOR_SELECTORS = ['.username', 'a.name', '.nick-name', 'a[href*="/u/"]'];

function extractAuthorName(): string | undefined {
  for (const selector of AUTHOR_SELECTORS) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return undefined;
}

const WEIBO_SUFFIX_RE = /[\s\-–—|]+微博$/;

function cleanTitle(raw: string): string {
  return raw.replace(WEIBO_SUFFIX_RE, '').trim();
}

export class WeiboExtractor implements IVideoExtractor {
  platform = 'weibo' as const;

  matches(url: string): boolean {
    return (
      /weibo\.com\/tv\/show\//.test(url) ||
      /weibo\.com\/\d+\/[a-zA-Z0-9]+/.test(url) ||
      /video\.weibo\.com\//.test(url)
    );
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video?.src) {
      throw new VideoExtractionError(this.platform, 'video element src not found');
    }

    const rawTitle =
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim()
      ?? document.querySelector('h1')?.textContent?.trim()
      ?? document.title;

    const title = rawTitle ? cleanTitle(rawTitle) : '微博视频';

    const authorName = extractAuthorName();
    const coverUrl = video.poster || undefined;

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl: video.src,
      videoHeaders: { Referer: 'https://weibo.com/' },
      recommendedStrategy: 'server',
      meta: { title: title || '微博视频', authorName, coverUrl },
    };
  }
}

// TODO: 真实微博 PC 页面视频资源可能经过 cdn 鉴权或 HLS，需手工验证
// https://weibo.com/tv/show/<id> 与 https://video.weibo.com/ 下 <video> src 实际值。
