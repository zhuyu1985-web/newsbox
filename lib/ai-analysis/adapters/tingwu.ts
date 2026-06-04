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

function buildCapabilityParameters(caps: Array<string>): Record<string, unknown> {
  const params: Record<string, unknown> = {
    Transcription: { DiarizationEnabled: caps.includes('transcript') },
  };
  const summarizationTypes: string[] = [];

  if (caps.includes('chapters')) {
    params.AutoChaptersEnabled = true;
  }

  if (caps.includes('summary')) {
    summarizationTypes.push('Paragraph');
  }

  if (caps.includes('key_points')) {
    // 听悟没有独立的"关键词"开关；通过 ExtraParams.MaxKeywords 启用
    params.ExtraParams = { ...asRecord(params.ExtraParams), MaxKeywords: 10 };
  }

  if (caps.includes('qa')) {
    // 官方“问答回顾”属于大模型摘要总结能力：Summarization.Types=QuestionsAnswering
    summarizationTypes.push('QuestionsAnswering');
  }

  if (summarizationTypes.length > 0) {
    params.SummarizationEnabled = true;
    params.Summarization = { Types: Array.from(new Set(summarizationTypes)) };
  }

  return params;
}

/**
 * Tingwu 真实 API 把 Result.X 写成 URL 字符串（指向 OSS 上的 JSON 文件），
 * 测试 mock 写成内联对象。这个 helper 两种都兼容：
 * - string 且看起来像 URL → fetch 后 json
 * - 其他（对象/数组/null）→ 原样返回
 */
async function resolveResultField(value: unknown): Promise<unknown> {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

async function mapResult(rawIn: unknown): Promise<AudioAnalysisResult> {
  // 把可能的 URL 字段先 fetch 解开
  const raw = asRecord(rawIn);
  const [transcriptionDoc, autoChaptersDoc, summarizationDoc, keyPointsDoc, meetingDoc] = await Promise.all([
    resolveResultField(raw.Transcription),
    resolveResultField(raw.AutoChapters),
    resolveResultField(raw.Summarization),
    resolveResultField(raw.KeyPoints),
    resolveResultField(raw.MeetingAssistance),
  ]);

  // 真实 API 返回的 JSON 多一层同名包裹：{ TaskId, Transcription: { AudioInfo, Paragraphs } }
  // test mock 直接传内层对象。两种都兼容：优先看包裹内层。
  const transcriptionRecord = asRecord(transcriptionDoc);
  const autoChaptersRecord = asRecord(autoChaptersDoc);
  const summarizationRecord = asRecord(summarizationDoc);
  const keyPointsRecord = asRecord(keyPointsDoc);
  const meetingRecord = asRecord(meetingDoc);
  return mapTingwuToResult({
    transcription: transcriptionRecord.Transcription ?? transcriptionDoc,
    autoChapters: autoChaptersRecord.AutoChapters ?? autoChaptersDoc,
    summarization: summarizationRecord.Summarization ?? summarizationDoc,
    keyPoints: keyPointsRecord.KeyPoints ?? keyPointsDoc,
    meeting: meetingRecord.MeetingAssistance ?? meetingDoc,
  });
}

export interface TingwuMappingInput {
  transcription: unknown;
  autoChapters: unknown;
  summarization: unknown;
  keyPoints: unknown;
  meeting: unknown;
}

/**
 * 把已经解析好的 Tingwu 各段文档映射成 AudioAnalysisResult。
 * 与 mapResult 的区别：本函数是同步的，不再处理 URL 解 fetch，只负责字段映射。
 */
export function mapTingwuToResult(input: TingwuMappingInput): AudioAnalysisResult {
  const { transcription, autoChapters, summarization, keyPoints, meeting: meetingAssistance } = input;
  const transcriptionRecord = asRecord(transcription);
  const summarizationRecord = asRecord(summarization);
  const meetingRecord = asRecord(meetingAssistance);

  // 真实 API：Paragraphs[].Words[]，每个 Word 含 SentenceId + Start + End + Text
  // 同 SentenceId 的 Words 聚合成一个 segment（"句子"），text 用空格连接。
  // 测试 mock：Paragraphs[].Sentences[] 直接给 BeginTime/EndTime/Text 也支持。
  const transcript: TranscriptSegment[] = [];
  for (const item of getArray(transcriptionRecord.Paragraphs)) {
    const p = asRecord(item);
    const speaker = p.SpeakerId ? String(p.SpeakerId) : undefined;
    if (Array.isArray(p.Sentences)) {
      // mock / 部分 API 直接给 Sentences 数组
      for (const sentenceItem of p.Sentences) {
        const s = asRecord(sentenceItem);
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
      for (const wordItem of p.Words) {
        const w = asRecord(wordItem);
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
  const autoChaptersRecord = asRecord(autoChapters);
  const chaptersRaw = Array.isArray(autoChapters)
    ? autoChapters
    : getArray(autoChaptersRecord.Chapters);
  const chapters: Chapter[] = chaptersRaw.map((item) => {
    const c = asRecord(item);
    return {
      start: Number(c.Start ?? 0) / 1000,
      end: Number(c.End ?? 0) / 1000,
      title: String(c.Headline ?? ''),
      summary: c.Summary ? String(c.Summary) : undefined,
    };
  });

  // keyPoints 可能是字符串数组（test mock）或 {KeyWords:[...]} 对象（真实 API）
  const keyPointsRecord = asRecord(keyPoints);
  const keyPointsList = Array.isArray(keyPoints)
    ? keyPoints
    : getArray(keyPointsRecord.KeyWords ?? keyPointsRecord.Keywords);
  const keywordsArr = keyPointsList.map((kp) => String(kp));
  const qaFromSummarization = normalizeQaPairs(
    summarizationRecord.QuestionsAnsweringSummary,
    ['Question', 'question', 'Q', 'q'],
    ['Answer', 'answer', 'A', 'a'],
  );
  const qaFromMeeting = normalizeQaPairs(
    meetingRecord.QAs,
    ['Q', 'Question', 'q', 'question'],
    ['A', 'Answer', 'a', 'answer'],
  );

  return {
    transcript,
    chapters,
    summary: String(summarizationRecord.ParagraphSummary ?? summarizationRecord.Summary ?? ''),
    keyPoints: keywordsArr,
    keywords: keywordsArr,
    qaPairs: qaFromSummarization.length > 0 ? qaFromSummarization : qaFromMeeting,
    speakers: getArray(transcriptionRecord.Speakers).length > 0
      ? getArray(transcriptionRecord.Speakers).map((speakerItem) => {
          const sp = asRecord(speakerItem);
          return {
            id: String(sp.Id),
            label: String(sp.Label ?? sp.Id),
          };
        })
      : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeQaPairs(
  raw: unknown,
  questionKeys: string[],
  answerKeys: string[],
): Array<{ q: string; a: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const q = firstString(record, questionKeys);
      const a = firstString(record, answerKeys);
      if (!q || !a) return null;
      return { q, a };
    })
    .filter((qa): qa is { q: string; a: string } => qa !== null);
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}
