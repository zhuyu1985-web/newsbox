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
        SourceLanguage: input.language ?? 'cn',
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

    if (status === 'COMPLETED') {
      return { status: 'done', result: mapResult(d.Result) };
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

function buildCapabilityParameters(caps: Array<string>): Record<string, any> {
  return {
    Transcription: { DiarizationEnabled: caps.includes('transcript') },
    AutoChaptersEnabled: caps.includes('chapters'),
    SummarizationEnabled: caps.includes('summary'),
    KeyPointsEnabled: caps.includes('key_points'),
    // 注：Q&A 是否真的能开取决于 spike 验证；不可用时不传
    AskQuestionEnabled: caps.includes('qa'),
  };
}

function mapResult(raw: any): AudioAnalysisResult {
  const transcript: TranscriptSegment[] = [];
  for (const p of raw?.Transcription?.Paragraphs ?? []) {
    for (const s of p.Sentences ?? []) {
      transcript.push({
        start: Number(s.BeginTime ?? 0) / 1000,
        end: Number(s.EndTime ?? 0) / 1000,
        text: String(s.Text ?? ''),
        speaker: s.SpeakerId ? String(s.SpeakerId) : undefined,
      });
    }
  }

  const chapters: Chapter[] = (raw?.AutoChapters ?? []).map((c: any) => ({
    start: Number(c.Start ?? 0) / 1000,
    end: Number(c.End ?? 0) / 1000,
    title: String(c.Headline ?? ''),
    summary: c.Summary ? String(c.Summary) : undefined,
  }));

  return {
    transcript,
    chapters,
    summary: String(raw?.Summarization?.ParagraphSummary ?? ''),
    keyPoints: (raw?.KeyPoints ?? []).map((kp: any) => String(kp)),
    qaPairs: (raw?.MeetingAssistance?.QAs ?? []).map((q: any) => ({
      q: String(q.Q ?? ''),
      a: String(q.A ?? ''),
    })),
    speakers: raw?.Transcription?.Speakers
      ? raw.Transcription.Speakers.map((sp: any) => ({
          id: String(sp.Id),
          label: String(sp.Label ?? sp.Id),
        }))
      : undefined,
  };
}
