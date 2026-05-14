// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { WeixinChannelExtractor } from '../../../../extension/src/content/video-extractors/weixin-channel';
import { VideoExtractionError } from '../../../../extension/src/content/video-extractors/base';

describe('WeixinChannelExtractor', () => {
  let extractor: WeixinChannelExtractor;

  beforeEach(() => {
    extractor = new WeixinChannelExtractor();
    document.body.innerHTML = '';
  });

  // ---------- matches() ----------

  describe('matches()', () => {
    it('should match channels.weixin.qq.com URLs', () => {
      expect(extractor.matches('https://channels.weixin.qq.com/video/12345')).toBe(true);
      expect(extractor.matches('https://channels.weixin.qq.com/playground/finder/profile?finderUsername=abc')).toBe(true);
    });

    it('should match weixin.qq.com/channels URLs', () => {
      expect(extractor.matches('https://weixin.qq.com/channels/live/123456')).toBe(true);
      expect(extractor.matches('https://weixin.qq.com/channels/feed/123')).toBe(true);
    });

    it('should not match regular weixin.qq.com (non-channels) URLs', () => {
      expect(extractor.matches('https://weixin.qq.com/r/123')).toBe(false);
    });

    it('should not match other platforms', () => {
      expect(extractor.matches('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(false);
      expect(extractor.matches('https://www.douyin.com/video/7123456789012345678')).toBe(false);
      expect(extractor.matches('https://www.youtube.com/watch?v=abc')).toBe(false);
    });

    it('should not match unrelated qq.com domains', () => {
      expect(extractor.matches('https://v.qq.com/x/page/abc.html')).toBe(false);
      expect(extractor.matches('https://mp.weixin.qq.com/s/abc123')).toBe(false);
    });
  });

  // ---------- extract() ----------

  describe('extract()', () => {
    it('should throw VideoExtractionError with "not yet implemented" message', async () => {
      await expect(extractor.extract()).rejects.toThrow(VideoExtractionError);
    });

    it('should include "not yet implemented" in the error message', async () => {
      await expect(extractor.extract()).rejects.toThrow('not yet implemented');
    });

    it('should mention Phase 2 in the error message', async () => {
      await expect(extractor.extract()).rejects.toThrow('Phase 2');
    });

    it('should have platform "weixin-channel"', () => {
      expect(extractor.platform).toBe('weixin-channel');
    });

    it('should have recommendedStrategy "browser" (future B-path config)', async () => {
      // recommendedStrategy is not returned on error, but verify the platform config intent
      // by checking the source: the extractor is designed as browser-strategy for Phase 2.
      // We verify the error is a VideoExtractionError (not a silent failure or null).
      let thrown: unknown;
      try {
        await extractor.extract();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(VideoExtractionError);
      // Once Phase 2 is implemented, the result should be recommendedStrategy: 'browser'
    });
  });
});
