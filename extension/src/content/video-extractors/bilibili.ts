// TODO: 以下提取逻辑基于 B 站 PC 网页的已知结构，需在真实页面验证：
// 1. __playinfo__ 是否稳定注入（不同地区/登录状态可能差异）
// 2. dash.video[0].baseUrl 可能有时效性（expires），需确认 TTL
// 3. durl 格式多见于番剧/课程，通常需要大会员 cookie
// 4. 短链 b23.tv 会 302 跳转到 bilibili.com/video/BV...，matches() 以跳转后 URL 为准
// 5. 移动端 m.bilibili.com 结构不同，暂不支持

import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

// 内部类型：B 站注入的 __playinfo__ 全局对象
interface BiliPlayInfo {
  data?: {
    dash?: {
      video?: Array<{ baseUrl?: string; base_url?: string }>;
    };
    durl?: Array<{ url?: string }>;
  };
}

export class BilibiliExtractor implements IVideoExtractor {
  platform = 'bilibili' as const;

  matches(url: string): boolean {
    // 匹配 bilibili.com/video/BVxxx 或 bilibili.com/video/avxxx
    return /bilibili\.com\/video\/(BV|av)\w+/.test(url);
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;

    // --- 1. 从 window.__playinfo__ 读取视频地址 ---
    const playinfo = (window as unknown as { __playinfo__?: BiliPlayInfo }).__playinfo__;
    let videoUrl: string | undefined;

    if (playinfo?.data?.dash?.video?.length) {
      // DASH 格式（主流）
      const track = playinfo.data.dash.video[0];
      videoUrl = track.baseUrl ?? track.base_url;
    } else if (playinfo?.data?.durl?.length) {
      // DURL 格式（番剧/旧版接口）
      videoUrl = playinfo.data.durl[0].url;
    }

    if (!videoUrl) {
      throw new VideoExtractionError(
        this.platform,
        'window.__playinfo__ not found or video URL missing; ' +
        'ensure page is fully loaded or user is logged in',
      );
    }

    // --- 2. 元数据提取 ---
    const rawTitle =
      document.querySelector('h1')?.textContent?.trim()
      ?? document.title;

    // 去除 B 站标题后缀，如 "_哔哩哔哩 (゜-゜)つロ 干杯~-bilibili"
    const title = rawTitle
      .replace(/_哔哩哔哩.*$/u, '')
      .replace(/-bilibili\s*$/i, '')
      .trim()
      || '哔哩哔哩视频';

    const coverUrl =
      document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content?.trim()
      || undefined;

    const authorEl = document.querySelector<HTMLAnchorElement>('a[href*="/space.bilibili.com/"]');
    const authorName = authorEl?.textContent?.trim() || undefined;

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl,
      videoHeaders: { Referer: 'https://www.bilibili.com/' },
      // B 路径：视频带防盗链，需浏览器环境下载
      recommendedStrategy: 'browser',
      meta: { title, authorName, coverUrl },
    };
  }
}
