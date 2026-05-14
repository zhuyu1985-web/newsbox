// TODO (Phase 2): 视频号视频实际通过 service worker 拦截网络请求获取 blob URL，
// 直接读取 DOM 中的 <video src> 会得到 blob: 协议地址，无法在插件后台重新下载。
// Phase 2 方案：在 service worker 中拦截 finder.video.qq.com 的视频分片请求，
// 重定向或转存到 Supabase Storage，然后回填 videoUrl。
// 参考文档：https://developers.chrome.com/docs/extensions/reference/api/declarativeNetRequest

import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

export class WeixinChannelExtractor implements IVideoExtractor {
  platform = 'weixin-channel' as const;

  matches(url: string): boolean {
    // 匹配视频号主要 URL 形态
    return (
      /channels\.weixin\.qq\.com/.test(url) ||
      /weixin\.qq\.com\/channels/.test(url)
    );
  }

  async extract(): Promise<VideoCapture> {
    // Phase 2 follow-up: 需要 service worker 网络拦截，当前版本不可用。
    throw new VideoExtractionError(
      this.platform,
      'Weixin Channel video extraction not yet implemented; ' +
      'requires service worker network interception (Phase 2 follow-up)',
    );
  }
}
