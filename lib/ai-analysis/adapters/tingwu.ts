// lib/ai-analysis/adapters/tingwu.ts
import type {
  AudioAnalysisProvider,
  AudioSubmitInput,
  AudioPollResult,
  AudioAnalysisResult,
  TranscriptSegment,
  Chapter,
} from '../types';
import { callTingwu } from './tingwu-client';

const REQUIRED_ENV = [
  'ALI_TINGWU_APPKEY',
  'ALIBABA_CLOUD_ACCESS_KEY_ID',
  'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
];

export class TingwuAdapter implements AudioAnalysisProvider {
  readonly name = 'tingwu' as const;

  constructor() {
    for (const k of REQUIRED_ENV) {
      if (!process.env[k]) throw new Error(`${k} is required for TingwuAdapter`);
    }
  }

  async submit(input: AudioSubmitInput): Promise<{ taskId: string }> {
    const body = {
      AppKey: process.env.ALI_TINGWU_APPKEY,
      Input: {
        // 听悟的语言码与 ISO 639-1 不同：中文是 'cn'，英文是 'en'，自动是 'auto'
        SourceLanguage: mapLanguageToTingwu(input.language),
        FileUrl: input.mediaUrl,
        Format: undefined,  // 自动识别
      },
      Parameters: buildCapabilityParameters(input.capabilities),
    };
    const data = await callTingwu('put', body);
    const taskId = data?.body?.Data?.TaskId;
    if (!taskId) throw new Error(`tingwu submit: no TaskId in response: ${JSON.stringify(data)}`);
    return { taskId };
  }

  async poll(taskId: string): Promise<AudioPollResult> {
    const data = await callTingwu(`${taskId}`, {});  // GET task
    const d = data?.body?.Data;
    const status = d?.TaskStatus;

    if (status === 'COMPLETED' || status === 'COMPLETE') {
      return { status: 'done', result: await mapResult(d.Result) };
    }
    if (status === 'FAILED') {
      return {
        status: 'failed',
        error: { code: d?.ErrorCode ?? 'UNKNOWN', message: d?.ErrorMessage ?? '' },
      };
    }
    if (status === 'ONGOING' || status === 'QUEUEING') {
      return { status: 'processing' };
    }
    return { status: 'pending' };
  }
}

function mapLanguageToTingwu(lang: 'zh' | 'en' | 'auto' | undefined): string {
  switch (lang) {
    case 'zh':
    case undefined:
      return 'cn';
    case 'en':
      return 'en';
    case 'auto':
      return 'auto';
    default:
      return 'cn';
  }
}

function buildCapabilityParameters(caps: Array<string>): Record<string, any> {
  const params: Record<string, any> = {
    Transcription: { DiarizationEnabled: caps.includes('transcript') },
  };

  if (caps.includes('chapters')) {
    params.AutoChaptersEnabled = true;
  }

  if (caps.includes('summary')) {
    // 听悟要求 SummarizationEnabled=true 时同时传 Summarization.Types
    params.SummarizationEnabled = true;
    params.Summarization = { Types: ['Paragraph'] };
  }

  if (caps.includes('key_points')) {
    // 听悟没有独立的"关键词"开关；通过 ExtraParams.MaxKeywords 启用
    params.ExtraParams = { ...(params.ExtraParams ?? {}), MaxKeywords: 10 };
  }

  if (caps.includes('qa')) {
    // Q&A 走 MeetingAssistance（需要听悟控制台先开通对应能力）
    params.MeetingAssistanceEnabled = true;
    params.MeetingAssistance = { Types: ['Question', 'Conclusion'] };
  }

  return params;
}

/**
 * Tingwu 真实 API 把 Result.X 写成 URL 字符串（指向 OSS 上的 JSON 文件），
 * 测试 mock 写成内联对象。这个 helper 两种都兼容：
 * - string 且看起来像 URL → fetch 后 json
 * - 其他（对象/数组/null）→ 原样返回
 */
async function resolveResultField(value: unknown): Promise<any> {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  return value;
}

async function mapResult(rawIn: any): Promise<AudioAnalysisResult> {
  // 把可能的 URL 字段先 fetch 解开
  const raw = rawIn ?? {};
  const [transcription, autoChapters, summarization, keyPoints, meetingAssistance] = await Promise.all([
    resolveResultField(raw.Transcription),
    resolveResultField(raw.AutoChapters),
    resolveResultField(raw.Summarization),
    resolveResultField(raw.KeyPoints),
    resolveResultField(raw.MeetingAssistance),
  ]);

  const transcript: TranscriptSegment[] = [];
  for (const p of transcription?.Paragraphs ?? []) {
    for (const s of p.Sentences ?? []) {
      transcript.push({
        start: Number(s.BeginTime ?? 0) / 1000,
        end: Number(s.EndTime ?? 0) / 1000,
        text: String(s.Text ?? ''),
        speaker: s.SpeakerId ? String(s.SpeakerId) : undefined,
      });
    }
  }

  // autoChapters 可能是数组（test mock）或带 Chapters 字段的对象（真实 API）
  const chaptersRaw = Array.isArray(autoChapters)
    ? autoChapters
    : autoChapters?.Chapters ?? [];
  const chapters: Chapter[] = chaptersRaw.map((c: any) => ({
    start: Number(c.Start ?? 0) / 1000,
    end: Number(c.End ?? 0) / 1000,
    title: String(c.Headline ?? ''),
    summary: c.Summary ? String(c.Summary) : undefined,
  }));

  // keyPoints 可能是字符串数组（test mock）或 {KeyWords:[...]} 对象（真实 API）
  const keyPointsList = Array.isArray(keyPoints)
    ? keyPoints
    : keyPoints?.KeyWords ?? keyPoints?.Keywords ?? [];

  return {
    transcript,
    chapters,
    summary: String(summarization?.ParagraphSummary ?? ''),
    keyPoints: keyPointsList.map((kp: any) => String(kp)),
    qaPairs: (meetingAssistance?.QAs ?? []).map((q: any) => ({
      q: String(q.Q ?? ''),
      a: String(q.A ?? ''),
    })),
    speakers: transcription?.Speakers
      ? transcription.Speakers.map((sp: any) => ({
          id: String(sp.Id),
          label: String(sp.Label ?? sp.Id),
        }))
      : undefined,
  };
}
