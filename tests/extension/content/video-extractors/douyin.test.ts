// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DouyinExtractor } from '../../../../extension/src/content/video-extractors/douyin';
import { VideoExtractionError } from '../../../../extension/src/content/video-extractors/base';

describe('DouyinExtractor', () => {
  let extractor: DouyinExtractor;

  beforeEach(() => {
    extractor = new DouyinExtractor();
    // Reset document body before each test
    document.body.innerHTML = '';
    document.title = '';
  });

  describe('matches()', () => {
    it('should match douyin.com/video/ URLs', () => {
      expect(extractor.matches('https://www.douyin.com/video/7123456789012345678')).toBe(true);
      expect(extractor.matches('https://douyin.com/video/7123456789012345678')).toBe(true);
    });

    it('should not match bilibili URLs', () => {
      expect(extractor.matches('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(false);
    });

    it('should not match non-video douyin URLs', () => {
      expect(extractor.matches('https://www.douyin.com/user/MS4wLjABAAAA')).toBe(false);
    });

    it('should not match other platform URLs', () => {
      expect(extractor.matches('https://www.youtube.com/watch?v=abc123')).toBe(false);
      expect(extractor.matches('https://weibo.com/tv/show/1034:123')).toBe(false);
    });
  });

  describe('extract()', () => {
    beforeEach(() => {
      // Set up a fake window.location
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.douyin.com/video/7123456789012345678' },
        writable: true,
        configurable: true,
      });
    });

    it('should extract video src, title, and author from DOM', async () => {
      document.body.innerHTML = `
        <h1>测试抖音视频标题</h1>
        <a href="/user/MS4wLjABAAAA">测试作者</a>
        <video src="https://v3-web.douyinvod.com/video/tos/cn/test.mp4" poster="https://example.com/cover.jpg"></video>
      `;

      const result = await extractor.extract();

      expect(result.platform).toBe('douyin');
      expect(result.sourceUrl).toBe('https://www.douyin.com/video/7123456789012345678');
      expect(result.videoUrl).toBe('https://v3-web.douyinvod.com/video/tos/cn/test.mp4');
      expect(result.meta.title).toBe('测试抖音视频标题');
      expect(result.meta.authorName).toBe('测试作者');
      expect(result.meta.coverUrl).toBe('https://example.com/cover.jpg');
    });

    it('should throw VideoExtractionError when no video element exists', async () => {
      document.body.innerHTML = '<h1>No Video Here</h1>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
      await expect(extractor.extract()).rejects.toThrow('[douyin] video element src not found');
    });

    it('should throw VideoExtractionError when video element has no src', async () => {
      document.body.innerHTML = '<video></video>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
    });

    it('should use recommendedStrategy "server" (A path for douyin)', async () => {
      document.body.innerHTML = `
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.recommendedStrategy).toBe('server');
    });

    it('should include Referer header pointing to douyin.com', async () => {
      document.body.innerHTML = `
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.videoHeaders).toBeDefined();
      expect(result.videoHeaders!['Referer']).toBe('https://www.douyin.com/');
    });

    it('should fall back to document.title when no h1 element', async () => {
      document.title = 'Document Title from Tab';
      document.body.innerHTML = `
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.meta.title).toBe('Document Title from Tab');
    });

    it('should use fallback title "抖音视频" when no h1 and no document.title', async () => {
      document.title = '';
      document.body.innerHTML = `
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.meta.title).toBe('抖音视频');
    });

    it('should handle missing author gracefully', async () => {
      document.body.innerHTML = `
        <h1>Video without author</h1>
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.meta.authorName).toBeUndefined();
    });

    it('should handle missing poster gracefully', async () => {
      document.body.innerHTML = `
        <h1>Video without poster</h1>
        <video src="https://v3-web.douyinvod.com/video/test.mp4"></video>
      `;

      const result = await extractor.extract();
      expect(result.meta.coverUrl).toBeUndefined();
    });
  });
});
