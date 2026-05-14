// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { KuaishouExtractor } from '../../../../extension/src/content/video-extractors/kuaishou';
import { VideoExtractionError } from '../../../../extension/src/content/video-extractors/base';

describe('KuaishouExtractor', () => {
  let extractor: KuaishouExtractor;

  beforeEach(() => {
    extractor = new KuaishouExtractor();
    document.body.innerHTML = '';
    document.title = '';
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.kuaishou.com/short-video/3xabcdefghijk' },
      writable: true,
      configurable: true,
    });
  });

  describe('matches()', () => {
    it('should match kuaishou.com/short-video/ URLs', () => {
      expect(extractor.matches('https://www.kuaishou.com/short-video/3xabcdefghijk')).toBe(true);
      expect(extractor.matches('https://kuaishou.com/short-video/3x123456')).toBe(true);
    });

    it('should match v.kuaishou.com short-link URLs', () => {
      expect(extractor.matches('https://v.kuaishou.com/aBcDeF')).toBe(true);
    });

    it('should not match douyin URLs', () => {
      expect(extractor.matches('https://www.douyin.com/video/7123456789012345678')).toBe(false);
    });

    it('should not match bilibili URLs', () => {
      expect(extractor.matches('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(false);
    });

    it('should not match weibo URLs', () => {
      expect(extractor.matches('https://weibo.com/tv/show/1034:123')).toBe(false);
    });

    it('should not match generic kuaishou home page', () => {
      expect(extractor.matches('https://www.kuaishou.com/')).toBe(false);
    });
  });

  describe('extract()', () => {
    it('should extract video src, title, and author from DOM', async () => {
      document.body.innerHTML = `
        <h1>快手测试视频标题</h1>
        <a href="/profile/3x_abcdef">测试作者快手</a>
        <video src="https://cdn.kuaishouapp.com/bs2/video/test.mp4" poster="https://example.com/cover.jpg"></video>
      `;

      const result = await extractor.extract();

      expect(result.platform).toBe('kuaishou');
      expect(result.sourceUrl).toBe('https://www.kuaishou.com/short-video/3xabcdefghijk');
      expect(result.videoUrl).toBe('https://cdn.kuaishouapp.com/bs2/video/test.mp4');
      expect(result.meta.title).toBe('快手测试视频标题');
      expect(result.meta.authorName).toBe('测试作者快手');
      expect(result.meta.coverUrl).toBe('https://example.com/cover.jpg');
    });

    it('should prefer og:title over h1 when both present... but h1 wins (current impl)', async () => {
      document.body.innerHTML = `
        <meta property="og:title" content="OG 标题" />
        <h1>H1 标题</h1>
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      // h1 is tried first, so h1 wins
      expect(result.meta.title).toBe('H1 标题');
    });

    it('should fall back to og:title when no h1', async () => {
      document.head.innerHTML = `<meta property="og:title" content="OG 快手标题" />`;
      document.body.innerHTML = `
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.title).toBe('OG 快手标题');
    });

    it('should throw VideoExtractionError when no video element exists', async () => {
      document.body.innerHTML = '<h1>No Video Here</h1>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
      await expect(extractor.extract()).rejects.toThrow('[kuaishou] video element src not found');
    });

    it('should throw VideoExtractionError when video element has no src', async () => {
      document.body.innerHTML = '<video></video>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
    });

    it('should use recommendedStrategy "server" (A path)', async () => {
      document.body.innerHTML = `
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.recommendedStrategy).toBe('server');
    });

    it('should include Referer header pointing to kuaishou.com', async () => {
      document.body.innerHTML = `
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.videoHeaders).toBeDefined();
      expect(result.videoHeaders!['Referer']).toBe('https://www.kuaishou.com/');
    });

    it('should handle missing author gracefully', async () => {
      document.body.innerHTML = `
        <h1>Video without author</h1>
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.authorName).toBeUndefined();
    });

    it('should handle missing poster gracefully', async () => {
      document.body.innerHTML = `
        <h1>Video without poster</h1>
        <video src="https://cdn.kuaishouapp.com/test.mp4"></video>
      `;
      const result = await extractor.extract();
      expect(result.meta.coverUrl).toBeUndefined();
    });
  });
});
