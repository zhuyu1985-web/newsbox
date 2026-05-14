// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BilibiliExtractor } from '../../../../extension/src/content/video-extractors/bilibili';
import { VideoExtractionError } from '../../../../extension/src/content/video-extractors/base';

describe('BilibiliExtractor', () => {
  let extractor: BilibiliExtractor;

  beforeEach(() => {
    extractor = new BilibiliExtractor();
    document.body.innerHTML = '';
    document.title = '';
    // Reset __playinfo__ between tests
    delete (window as any).__playinfo__;
  });

  afterEach(() => {
    delete (window as any).__playinfo__;
  });

  // ---------- matches() ----------

  describe('matches()', () => {
    it('should match bilibili.com/video/BVxxx URLs', () => {
      expect(extractor.matches('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true);
      expect(extractor.matches('https://bilibili.com/video/BV1GJ411x7h7')).toBe(true);
    });

    it('should match bilibili.com/video/avxxx URLs', () => {
      expect(extractor.matches('https://www.bilibili.com/video/av12345678')).toBe(true);
    });

    it('should not match bilibili homepage', () => {
      expect(extractor.matches('https://www.bilibili.com/')).toBe(false);
    });

    it('should not match other platforms', () => {
      expect(extractor.matches('https://www.douyin.com/video/7123456789012345678')).toBe(false);
      expect(extractor.matches('https://www.youtube.com/watch?v=abc123')).toBe(false);
    });

    it('should not match bilibili space pages', () => {
      expect(extractor.matches('https://space.bilibili.com/12345678')).toBe(false);
    });
  });

  // ---------- extract() ----------

  describe('extract()', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.bilibili.com/video/BV1xx411c7mD' },
        writable: true,
        configurable: true,
      });
    });

    it('should extract video URL from dash format __playinfo__', async () => {
      (window as any).__playinfo__ = {
        data: {
          dash: {
            video: [{ baseUrl: 'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/test.m4s' }],
          },
        },
      };
      document.body.innerHTML = '<h1>测试 B 站视频标题</h1>';

      const result = await extractor.extract();

      expect(result.platform).toBe('bilibili');
      expect(result.videoUrl).toBe('https://upos-sz-mirror08c.bilivideo.com/upgcxcode/test.m4s');
      expect(result.sourceUrl).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    });

    it('should extract video URL from durl format __playinfo__', async () => {
      (window as any).__playinfo__ = {
        data: {
          durl: [{ url: 'https://cn-gdfs-dx-01-02.bilivideo.com/upgcxcode/test.flv' }],
        },
      };
      document.body.innerHTML = '<h1>番剧视频</h1>';

      const result = await extractor.extract();

      expect(result.videoUrl).toBe('https://cn-gdfs-dx-01-02.bilivideo.com/upgcxcode/test.flv');
    });

    it('should fall back to base_url if baseUrl is absent in dash track', async () => {
      (window as any).__playinfo__ = {
        data: {
          dash: {
            video: [{ base_url: 'https://upos-sz-mirror08c.bilivideo.com/test_base_url.m4s' }],
          },
        },
      };
      document.body.innerHTML = '<h1>备用字段测试</h1>';

      const result = await extractor.extract();
      expect(result.videoUrl).toBe('https://upos-sz-mirror08c.bilivideo.com/test_base_url.m4s');
    });

    it('should throw VideoExtractionError when __playinfo__ is absent', async () => {
      document.body.innerHTML = '<h1>无 playinfo 页面</h1>';

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
      await expect(extractor.extract()).rejects.toThrow('[bilibili]');
    });

    it('should throw VideoExtractionError when __playinfo__.data is empty', async () => {
      (window as any).__playinfo__ = { data: {} };

      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
    });

    it('should strip B-station title suffix "_哔哩哔哩..."', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };
      document.title = '精彩视频_哔哩哔哩 (゜-゜)つロ 干杯~-bilibili';

      const result = await extractor.extract();
      // h1 not present, falls back to document.title which is cleaned
      expect(result.meta.title).toBe('精彩视频');
    });

    it('should strip "-bilibili" suffix from title', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };
      document.title = '另一个视频标题-bilibili';

      const result = await extractor.extract();
      expect(result.meta.title).toBe('另一个视频标题');
    });

    it('should use h1 text as title and not strip suffix from it unnecessarily', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };
      document.body.innerHTML = '<h1>干净的标题</h1>';

      const result = await extractor.extract();
      expect(result.meta.title).toBe('干净的标题');
    });

    it('should set recommendedStrategy to "browser"', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };

      const result = await extractor.extract();
      expect(result.recommendedStrategy).toBe('browser');
    });

    it('should include Referer header pointing to bilibili.com', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };

      const result = await extractor.extract();
      expect(result.videoHeaders).toBeDefined();
      expect(result.videoHeaders!['Referer']).toContain('bilibili.com');
    });

    it('should extract og:image as coverUrl', async () => {
      (window as any).__playinfo__ = {
        data: { dash: { video: [{ baseUrl: 'https://example.com/video.m4s' }] } },
      };
      document.head.innerHTML = '<meta property="og:image" content="https://i0.hdslb.com/cover.jpg">';

      const result = await extractor.extract();
      expect(result.meta.coverUrl).toBe('https://i0.hdslb.com/cover.jpg');
    });
  });
});
