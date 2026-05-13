// lib/ai-analysis/qa-service.ts
import type { TranscriptSegment } from './types';

const ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const TRANSCRIPT_TOKEN_BUDGET = 25000; // ~75000 chars

export interface AskInput {
  transcript: TranscriptSegment[];
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function askVideoQuestion(input: AskInput): Promise<{ answer: string }> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY required');

  const transcriptText = serializeTranscript(input.transcript);
  const transcriptForPrompt = transcriptText.length > TRANSCRIPT_TOKEN_BUDGET * 3
    ? await summarizeTranscript(apiKey, transcriptText)
    : transcriptText;

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content:
        '你是基于视频转写文本回答问题的助手。回答简洁、忠实于内容；若提及说话人请用 SpeakerId。',
    },
    { role: 'user', content: `【视频转写】\n${transcriptForPrompt}\n【提问】${input.question}` },
  ];
  if (input.history) {
    // 把 history 插在 user 提问前
    messages.splice(1, 0, ...input.history);
  }

  const res = await callQwen(apiKey, messages);
  return { answer: res };
}

function serializeTranscript(transcript: TranscriptSegment[]): string {
  return transcript.map(s =>
    `[${formatTime(s.start)}-${formatTime(s.end)}]${s.speaker ? ` ${s.speaker}:` : ''} ${s.text}`
  ).join('\n');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function summarizeTranscript(apiKey: string, transcriptText: string): Promise<string> {
  // 分段摘要：每 N 字一段，每段让模型抽 1 段要点
  const messages = [
    { role: 'system', content: '你压缩长文本：保留要点 + 重要人名/时间/术语。' },
    { role: 'user', content: `请把以下视频转写压缩成 5000 字以内的段落摘要：\n${transcriptText.slice(0, 60000)}` },
  ];
  return await callQwen(apiKey, messages);
}

async function callQwen(
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const model = process.env.DASHSCOPE_TEXT_MODEL || 'qwen-plus';
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages },
      parameters: { result_format: 'message' },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Qwen API ${res.status}: ${t}`);
  }
  const data = await res.json();
  const answer = data?.output?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') throw new Error('Qwen: empty answer');
  return answer;
}
