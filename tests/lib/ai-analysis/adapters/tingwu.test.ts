// tests/lib/ai-analysis/adapters/tingwu.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures requestMock is available when vi.mock factory is hoisted to the top
const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
}));

vi.mock('@alicloud/openapi-client', () => ({
  default: { Config: class { constructor(_: any) {} } },
  Config: class { constructor(_: any) {} },
}));

vi.mock('@/lib/ai-analysis/adapters/tingwu-client', () => ({
  callTingwu: requestMock,
}));

import { TingwuAdapter, mapTingwuToResult } from '@/lib/ai-analysis/adapters/tingwu';

describe('TingwuAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALI_TINGWU_APPKEY = 'app';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'id';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'secret';
    process.env.ALIBABA_CLOUD_REGION = 'cn-beijing';
  });

  it('submit creates task and returns taskId', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskId: 'tw-task-123' } },
    });
    const a = new TingwuAdapter();
    const result = await a.submit({
      mediaUrl: 'https://cos.example.com/v.mp4',
      capabilities: ['transcript', 'chapters', 'summary', 'key_points'],
    });
    expect(result.taskId).toBe('tw-task-123');
  });

  it('submit throws on API error', async () => {
    requestMock.mockRejectedValueOnce(new Error('appkey invalid'));
    const a = new TingwuAdapter();
    await expect(a.submit({ mediaUrl: 'x', capabilities: ['transcript'] }))
      .rejects.toThrow(/appkey invalid/);
  });

  it('poll maps done response to AudioAnalysisResult', async () => {
    requestMock.mockResolvedValueOnce({
      body: {
        Data: {
          TaskStatus: 'COMPLETED',
          Result: {
            Transcription: {
              Paragraphs: [{
                Sentences: [
                  { BeginTime: 0, EndTime: 2000, Text: '你好', SpeakerId: 'A' },
                  { BeginTime: 2000, EndTime: 4500, Text: '欢迎', SpeakerId: 'B' },
                ],
              }],
            },
            AutoChapters: [
              { Start: 0, End: 60000, Headline: '开场', Summary: '主持人开场' },
            ],
            Summarization: { ParagraphSummary: '这是个新闻视频。' },
            KeyPoints: ['观点A', '观点B'],
          },
        },
      },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('done');
    expect(r.result?.transcript).toHaveLength(2);
    expect(r.result?.transcript[0]).toEqual(
      expect.objectContaining({ start: 0, end: 2, text: '你好', speaker: 'A' })
    );
    expect(r.result?.chapters[0].title).toBe('开场');
    expect(r.result?.chapters[0].start).toBe(0);
    expect(r.result?.chapters[0].end).toBe(60);
    expect(r.result?.summary).toBe('这是个新闻视频。');
    expect(r.result?.keyPoints).toEqual(['观点A', '观点B']);
  });

  it('poll returns processing when task is in progress', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskStatus: 'ONGOING' } },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('processing');
    expect(r.result).toBeUndefined();
  });

  it('poll returns failed with error details', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskStatus: 'FAILED', ErrorCode: 'AUDIO_TOO_LONG', ErrorMessage: '超过 5 小时' } },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('AUDIO_TOO_LONG');
  });

  it('throws when env missing', () => {
    delete process.env.ALI_TINGWU_APPKEY;
    expect(() => new TingwuAdapter()).toThrow(/ALI_TINGWU_APPKEY/);
  });
});

describe('Tingwu adapter mapping', () => {
  it('maps keyPoints.KeyWords to result.keywords', () => {
    const result = mapTingwuToResult({
      transcription: { Paragraphs: [] },
      autoChapters: { Chapters: [] },
      summarization: { Summary: '' },
      keyPoints: { KeyWords: ['北京电视台', '向前一步', '电视剧'] },
      meeting: null,
    });
    expect(result.keywords).toEqual(['北京电视台', '向前一步', '电视剧']);
  });
});
