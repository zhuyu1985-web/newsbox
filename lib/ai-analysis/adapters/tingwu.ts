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
        // 必须显式声明 Format，**不能依赖听悟的"自动识别"**：
        // 实测对 COS CI AudioMix 合流的 mp4 产物（44.1kHz AAC + H.264）会假装
        // 抛 'TSC.AudioSampleRate: Audio sample rate invalid' —— 真实原因是
        // auto-detect 解析器对某些容器布局挂了，显式指定后走对应解码器即正常。
        Format: inferTingwuFormat(input.mediaUrl),
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

/**
 * 从 URL 推断 Tingwu 的 Format 字段。
 * 听悟支持的容器/编码：mp3 / mp4 / m4a / wav / aac / flac / amr / opus / ogg。
 * 落到列表外（含没有扩展名的）→ 兜底 'mp4'，因为流水线把所有视频统一转码为 mp4 输出。
 */
function inferTingwuFormat(url: string): string {
  const SUPPORTED = new Set(['mp3', 'mp4', 'm4a', 'wav', 'aac', 'flac', 'amr', 'opus', 'ogg']);
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split('.').pop() ?? '';
    if (SUPPORTED.has(ext)) return ext;
  } catch {
    // ignore parse errors
  }
  return 'mp4';
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
  const [transcriptionDoc, autoChaptersDoc, summarizationDoc, keyPointsDoc, meetingDoc] = await Promise.all([
    resolveResultField(raw.Transcription),
    resolveResultField(raw.AutoChapters),
    resolveResultField(raw.Summarization),
    resolveResultField(raw.KeyPoints),
    resolveResultField(raw.MeetingAssistance),
  ]);

  // 真实 API 返回的 JSON 多一层同名包裹：{ TaskId, Transcription: { AudioInfo, Paragraphs } }
  // test mock 直接传内层对象。两种都兼容：优先看包裹内层。
  return mapTingwuToResult({
    transcription: transcriptionDoc?.Transcription ?? transcriptionDoc,
    autoChapters: autoChaptersDoc?.AutoChapters ?? autoChaptersDoc,
    summarization: summarizationDoc?.Summarization ?? summarizationDoc,
    keyPoints: keyPointsDoc?.KeyPoints ?? keyPointsDoc,
    meeting: meetingDoc?.MeetingAssistance ?? meetingDoc,
  });
}

export interface TingwuMappingInput {
  transcription: any;
  autoChapters: any;
  summarization: any;
  keyPoints: any;
  meeting: any;
}

/**
 * 把已经解析好的 Tingwu 各段文档映射成 AudioAnalysisResult。
 * 与 mapResult 的区别：本函数是同步的，不再处理 URL 解 fetch，只负责字段映射。
 */
export function mapTingwuToResult(input: TingwuMappingInput): AudioAnalysisResult {
  const { transcription, autoChapters, summarization, keyPoints, meeting: meetingAssistance } = input;

  // 真实 API：Paragraphs[].Words[]，每个 Word 含 SentenceId + Start + End + Text
  // 同 SentenceId 的 Words 聚合成一个 segment（"句子"），text 用空格连接。
  // 测试 mock：Paragraphs[].Sentences[] 直接给 BeginTime/EndTime/Text 也支持。
  const transcript: TranscriptSegment[] = [];
  for (const p of transcription?.Paragraphs ?? []) {
    const speaker = p.SpeakerId ? String(p.SpeakerId) : undefined;
    if (Array.isArray(p.Sentences)) {
      // mock / 部分 API 直接给 Sentences 数组
      for (const s of p.Sentences) {
        transcript.push({
          start: Number(s.BeginTime ?? s.Start ?? 0) / 1000,
          end: Number(s.EndTime ?? s.End ?? 0) / 1000,
          text: String(s.Text ?? ''),
          speaker: s.SpeakerId ? String(s.SpeakerId) : speaker,
        });
      }
    } else if (Array.isArray(p.Words)) {
      // 真实 API：按 SentenceId 聚合 Words
      const bySentence = new Map<string, { start: number; end: number; texts: string[] }>();
      for (const w of p.Words) {
        const sid = String(w.SentenceId ?? '0');
        const cur = bySentence.get(sid);
        const wStart = Number(w.Start ?? w.BeginTime ?? 0);
        const wEnd = Number(w.End ?? w.EndTime ?? 0);
        if (!cur) {
          bySentence.set(sid, { start: wStart, end: wEnd, texts: [String(w.Text ?? '')] });
        } else {
          cur.end = wEnd;
          cur.texts.push(String(w.Text ?? ''));
        }
      }
      for (const s of bySentence.values()) {
        transcript.push({
          start: s.start / 1000,
          end: s.end / 1000,
          text: s.texts.join(''),
          speaker,
        });
      }
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
  const keywordsArr = keyPointsList.map((kp: any) => String(kp));

  return {
    transcript,
    chapters,
    summary: String(summarization?.ParagraphSummary ?? ''),
    keyPoints: keywordsArr,
    keywords: keywordsArr,
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
