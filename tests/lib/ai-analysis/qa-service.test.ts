// tests/lib/ai-analysis/qa-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { askVideoQuestion } from '@/lib/ai-analysis/qa-service';
import type { TranscriptSegment } from '@/lib/ai-analysis/types';

describe('askVideoQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    process.env.DASHSCOPE_TEXT_MODEL = 'qwen-plus';
  });

  it('returns answer from LLM', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: { choices: [{ message: { content: '主持人 A 说欢迎' } }] },
      }),
    });
    const transcript: TranscriptSegment[] = [
      { start: 0, end: 2, text: '欢迎收看', speaker: 'A' },
    ];
    const r = await askVideoQuestion({ transcript, question: '主持人说了什么' });
    expect(r.answer).toBe('主持人 A 说欢迎');
  });

  it('truncates very long transcript via summary pass', async () => {
    // 30k tokens transcript（粗略 9 万字符）；service 会先抽 Qwen 摘要再问
    fetchMock
      .mockResolvedValueOnce({   // 第一次：摘要
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: '【段落摘要】' } }] } }),
      })
      .mockResolvedValueOnce({   // 第二次：真正回答
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: '答案' } }] } }),
      });
    const huge = Array.from({ length: 1000 }, (_, i) => ({
      start: i, end: i + 1, text: '一'.repeat(100), speaker: 'A',
    }));
    const r = await askVideoQuestion({ transcript: huge, question: '主题是什么' });
    expect(r.answer).toBe('答案');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'server error',
    });
    await expect(askVideoQuestion({
      transcript: [{ start: 0, end: 1, text: 'x' }],
      question: 'y',
    })).rejects.toThrow(/server error|500/);
  });

  it('includes history in prompt when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: { choices: [{ message: { content: '继续回答' } }] } }),
    });
    await askVideoQuestion({
      transcript: [{ start: 0, end: 1, text: '欢迎' }],
      question: '继续',
      history: [
        { role: 'user', content: '主题是什么' },
        { role: 'assistant', content: '欢迎' },
      ],
    });
    const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    const messages = callBody.input.messages;
    expect(messages.length).toBeGreaterThanOrEqual(3); // system + history + user
  });
});
