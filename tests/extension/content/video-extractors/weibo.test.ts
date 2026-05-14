// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { WeiboExtractor } from '../../../../extension/src/content/video-extractors/weibo';
import { VideoExtractionError } from '../../../../extension/src/content/video-extractors/base';

describe('WeiboExtractor', () => {
  let extractor: WeiboExtractor;

  beforeEach(() => {
    extractor = new WeiboExtractor();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.title = '';
    Object.defineProperty(window, 'location', {
      value: { href: 'https://weibo.com/tv/show/1034:5012345678901234' },
      writable: true,
      configurable: true,
    });
  });

  describe('matches()', () => {
    it('should match weibo.com/tv/show/ URLs', () => {
      expect(extractor.matches('https://weibo.com/tv/show/1034:5012345678901234')).toBe(true);
    });

    it('should match weibo.com/<uid>/<weibo_id> URLs', () => {
      expect(extractor.matches('https://weibo.com/1234567890/AbCdEfGhIj')).toBe(true);
    });

    it('should match video.weibo.com URLs', () => {
      expect(extractor.matches('https://video.weibo.com/show?fid=1034:abc')).toBe(true);
    });

    it('should not match douyin URLs', () => {
      expect(extractor.matches('https://www.douyin.com/video/7123456789012345678')).toBe(false);
    });

    it('should not match kuaishou URLs', () => {
      expect(extractor.matches('https://www.kuaishou.com/short-video/3xabcdef')).toBe(false);
    });

    it('should not match bilibili URLs', () => {
      expect(extractor.matches('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(false);
    });
  });

  describe('extract()', () => {
    it('should extract video src, title, and author from DOM', async () => {
      document.head.innerHTML = `<meta property="og:title" content="精彩微博视频" />`;
      document.body.innerHTML = `
        <span class="username">微博用户名</span>
        <video src="https://f.video.weibocdn.com/test.mp4" poster="https://example.com/cover.jpg"></video>
      `;

      const result = await extractor.extract();

      expect(result.platform).toBe('weibo');
      expect(result.sourceUrl).toBe('https://weibo.com/tv/show/1034:5012345678901234');
      expect(result.videoUrl).toBe('https://f.video.weibocdn.com/test.mp4');
      expect(result.meta.title).toBe('精彩微博视频');
      expect(result.meta.authorName).toBe('微博用户名');
      expect(result.meta.coverUrl).toBe('https://example.com/cover.jpg');
    });

    it('should strip trailing 微博 suffix from og:title', async () => {
      document.head.innerHTML = `<meta property="og:title" content="好看的视频 - 微博" />`;
      document.body.innerHTML = `
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.title).toBe('好看的视频');
    });

    it('should fall back to h1 when no og:title meta', async () => {
      document.body.innerHTML = `
        <h1>H1 微博标题</h1>
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.title).toBe('H1 微博标题');
    });

    it('should fall back to document.title when no og:title and no h1', async () => {
      document.title = 'Tab 标题 微博';
      document.body.innerHTML = `
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      // "Tab 标题 微博" — trailing 微博 stripped
      expect(result.meta.title).toBe('Tab 标题');
    });

    it('should throw VideoExtractionError when no video element exists', async () => {
      document.body.innerHTML = '<h1>No Video Here</h1>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
      await expect(extractor.extract()).rejects.toThrow('[weibo] video element src not found');
    });

    it('should throw VideoExtractionError when video element has no src', async () => {
      document.body.innerHTML = '<video></video>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
    });

    it('should use recommendedStrategy "server" (A path)', async () => {
      document.body.innerHTML = `
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.recommendedStrategy).toBe('server');
    });

    it('should include Referer header pointing to weibo.com', async () => {
      document.body.innerHTML = `
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.videoHeaders).toBeDefined();
      expect(result.videoHeaders!['Referer']).toBe('https://weibo.com/');
    });

    it('should handle missing author gracefully', async () => {
      document.body.innerHTML = `
        <h1>Video without author</h1>
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.authorName).toBeUndefined();
    });

    it('should pick up author from a.name selector', async () => {
      document.body.innerHTML = `
        <a class="name">主播名字</a>
        <video src="https://f.video.weibocdn.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.authorName).toBe('主播名字');
    });
  });
});
