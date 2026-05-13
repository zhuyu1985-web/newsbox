// tests/lib/ai-analysis/adapters/qwen-vl.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { QwenVlAdapter } from '@/lib/ai-analysis/adapters/qwen-vl';

describe('QwenVlAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    process.env.DASHSCOPE_VISION_MODEL = 'qwen-vl-max';
  });

  it('analyzeFrames returns per-frame analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: {
          choices: [{
            message: {
              content: JSON.stringify([
                {
                  timestamp: 0,
                  sceneDescription: '一个新闻演播室',
                  entities: ['主持人', '电视台 logo'],
                  onScreenText: '今日要闻',
                },
                {
                  timestamp: 30,
                  sceneDescription: '街头采访',
                  entities: ['路人', '城市街景'],
                },
              ]),
            },
          }],
        },
      }),
    });
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({
      frames: [
        { timestamp: 0, url: 'https://cos.example.com/f-000000.jpg' },
        { timestamp: 30, url: 'https://cos.example.com/f-000030.jpg' },
      ],
      context: '新闻视频',
    });
    expect(r).toHaveLength(2);
    expect(r[0].sceneDescription).toBe('一个新闻演播室');
    expect(r[0].entities).toContain('主持人');
    expect(r[1].timestamp).toBe(30);
  });

  it('returns empty array when frames empty', async () => {
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({ frames: [] });
    expect(r).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on DashScope API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'invalid api key' }),
    });
    const a = new QwenVlAdapter();
    await expect(a.analyzeFrames({
      frames: [{ timestamp: 0, url: 'x' }],
    })).rejects.toThrow(/invalid api key/);
  });

  it('throws when DASHSCOPE_API_KEY missing', () => {
    delete process.env.DASHSCOPE_API_KEY;
    expect(() => new QwenVlAdapter()).toThrow(/DASHSCOPE_API_KEY/);
  });

  it('handles non-JSON LLM response gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: {
          choices: [{
            message: { content: 'this is not json' },
          }],
        },
      }),
    });
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({ frames: [{ timestamp: 0, url: 'x' }] });
    // 回退为单帧通用描述，避免抛错（视觉失败不阻塞 fully_ready 决策）
    expect(r).toHaveLength(1);
    expect(r[0].sceneDescription).toBeTruthy();
  });
});
