// B 站视频提取器
//
// 提取链路（按优先级）：
//   1. window.__playinfo__ —— 老路径，部分老页面/未登录会有
//   2. window.__INITIAL_STATE__ —— SPA 注入，能拿到 bvid + cid
//   3. URL 路径解析 BVxxx + 调 API playurl —— 兜底
//
// __playinfo__ / __INITIAL_STATE__ 都是异步注入：进入页面后 SPA 才填充。
// 因此先做一个短时轮询（最多 ~3s），等到至少其中一个就绪再提取。

import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

interface BiliPlayInfo {
  data?: {
    dash?: {
      video?: Array<{ baseUrl?: string; base_url?: string }>;
      audio?: Array<{ baseUrl?: string; base_url?: string; id?: number }>;
    };
    durl?: Array<{ url?: string }>;
  };
}

interface BiliInitialState {
  bvid?: string;
  aid?: number;
  videoData?: {
    bvid?: string;
    aid?: number;
    cid?: number;
    title?: string;
    pic?: string;
    duration?: number;
    owner?: { name?: string };
    pages?: Array<{ cid?: number }>;
  };
}

interface PlayUrlResponse {
  code: number;
  message?: string;
  data?: {
    dash?: {
      video?: Array<{ baseUrl?: string; base_url?: string }>;
      audio?: Array<{ baseUrl?: string; base_url?: string; id?: number }>;
    };
    durl?: Array<{ url?: string }>;
  };
}

const POLL_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 100;

function getPlayInfo(): BiliPlayInfo | undefined {
  return (window as unknown as { __playinfo__?: BiliPlayInfo }).__playinfo__;
}

function getInitialState(): BiliInitialState | undefined {
  return (window as unknown as { __INITIAL_STATE__?: BiliInitialState }).__INITIAL_STATE__;
}

function parseBvidFromUrl(url: string): string | undefined {
  return /\/video\/(BV\w+)/.exec(url)?.[1];
}

function pickVideoUrl(info: BiliPlayInfo | PlayUrlResponse['data'] | undefined): string | undefined {
  const data = (info as BiliPlayInfo)?.data ?? (info as PlayUrlResponse['data']);
  if (data?.dash?.video?.length) {
    const v = data.dash.video[0];
    return v.baseUrl ?? v.base_url;
  }
  if (data?.durl?.length) {
    return data.durl[0].url;
  }
  return undefined;
}

/**
 * 取 DASH 音频轨。B 站把音视频分轨发，dash.audio[0] 是默认音质。
 * durl 是 FLV 合流，自带音频，所以 durl 不需要单独取音轨。
 */
function pickAudioUrl(info: BiliPlayInfo | PlayUrlResponse['data'] | undefined): string | undefined {
  const data = (info as BiliPlayInfo)?.data ?? (info as PlayUrlResponse['data']);
  if (data?.dash?.audio?.length) {
    const a = data.dash.audio[0];
    return a.baseUrl ?? a.base_url;
  }
  return undefined;
}

async function waitForBiliData(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    if (getPlayInfo() || getInitialState()?.videoData?.cid) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function fetchPlayUrl(bvid: string, cid: number): Promise<{ videoUrl?: string; audioUrl?: string }> {
  // playurl 接口需要带 cookie；content script 走页面源（bilibili.com），cookie 会自动带上
  const url =
    `https://api.bilibili.com/x/player/playurl?` +
    `bvid=${encodeURIComponent(bvid)}&cid=${cid}` +
    `&qn=80&fnval=4048&fnver=0&fourk=1&platform=html5&high_quality=1`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return {};
    const json = (await res.json()) as PlayUrlResponse;
    if (json.code !== 0) return {};
    return { videoUrl: pickVideoUrl(json.data), audioUrl: pickAudioUrl(json.data) };
  } catch {
    return {};
  }
}

function cleanTitle(raw: string): string {
  return (
    raw
      .replace(/_哔哩哔哩.*$/u, '')
      .replace(/-bilibili\s*$/i, '')
      .trim() || '哔哩哔哩视频'
  );
}

export class BilibiliExtractor implements IVideoExtractor {
  platform = 'bilibili' as const;

  matches(url: string): boolean {
    return /bilibili\.com\/video\/(BV|av)\w+/.test(url);
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;
    const bvid = parseBvidFromUrl(url);

    // 等待 SPA 注入
    await waitForBiliData();

    // --- 1. window.__playinfo__（最理想路径）
    const playInfo = getPlayInfo();
    let videoUrl = pickVideoUrl(playInfo);
    let audioUrl = pickAudioUrl(playInfo);

    // --- 2. __INITIAL_STATE__ 拿 bvid+cid 后调 API
    if (!videoUrl) {
      const state = getInitialState();
      const stateBvid = state?.videoData?.bvid ?? state?.bvid ?? bvid;
      const cid =
        state?.videoData?.cid ?? state?.videoData?.pages?.[0]?.cid;
      if (stateBvid && cid) {
        const r = await fetchPlayUrl(stateBvid, cid);
        videoUrl = r.videoUrl;
        audioUrl = r.audioUrl;
      }
    }

    // --- 3. 完全没有 state，但 URL 有 bvid → 先查 view 拿 cid，再 playurl
    if (!videoUrl && bvid) {
      try {
        const viewRes = await fetch(
          `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
          { credentials: 'include' },
        );
        if (viewRes.ok) {
          const viewJson = (await viewRes.json()) as {
            code: number;
            data?: { cid?: number; pages?: Array<{ cid?: number }> };
          };
          const cid = viewJson?.data?.cid ?? viewJson?.data?.pages?.[0]?.cid;
          if (cid) {
            const r = await fetchPlayUrl(bvid, cid);
            videoUrl = r.videoUrl;
            audioUrl = r.audioUrl;
          }
        }
      } catch {
        // 落空就继续抛错
      }
    }

    if (!videoUrl) {
      throw new VideoExtractionError(
        this.platform,
        '未能从页面或 API 解析到视频地址。可能页面尚未加载完成，或需要登录哔哩哔哩账号后重试。',
      );
    }

    // --- 元数据：优先用 __INITIAL_STATE__（最准），其次 DOM 兜底
    const state = getInitialState();
    const vd = state?.videoData;

    const rawTitle =
      vd?.title || document.querySelector('h1')?.textContent?.trim() || document.title;
    const title = cleanTitle(rawTitle);

    const coverUrl =
      vd?.pic ||
      document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content?.trim() ||
      undefined;

    const authorName =
      vd?.owner?.name ||
      document.querySelector<HTMLAnchorElement>('a[href*="/space.bilibili.com/"]')?.textContent?.trim() ||
      undefined;

    const durationSec = typeof vd?.duration === 'number' ? vd.duration : undefined;

    const headers = { Referer: 'https://www.bilibili.com/' };

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl,
      videoHeaders: headers,
      // DASH 分轨：videoUrl 是纯视频流，必须连音频一起上传 + CI AudioMix 合流
      audioUrl,
      audioHeaders: audioUrl ? headers : undefined,
      // 走 B 路径：B 站资源有 referer 防盗链，浏览器上传可携带 cookie + referer
      recommendedStrategy: 'browser',
      meta: { title, authorName, coverUrl, durationSec },
    };
  }
}
