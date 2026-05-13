// lib/ai-analysis/adapters/qwen-vl.ts
import type {
  VisualAnalysisProvider,
  VisualFrameAnalysis,
} from '../types';

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

export class QwenVlAdapter implements VisualAnalysisProvider {
  readonly name = 'qwen-vl' as const;
  private apiKey: string;
  private model: string;

  constructor() {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) throw new Error('DASHSCOPE_API_KEY is required for QwenVlAdapter');
    this.apiKey = key;
    this.model = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-max';
  }

  async analyzeFrames(input: {
    frames: Array<{ timestamp: number; url: string }>;
    context?: string;
  }): Promise<VisualFrameAnalysis[]> {
    if (!input.frames.length) return [];

    const prompt = buildPrompt(input.frames, input.context);
    const body = {
      model: this.model,
      input: {
        messages: [{
          role: 'user',
          content: [
            { text: prompt },
            ...input.frames.map((f) => ({ image: f.url })),
          ],
        }],
      },
      parameters: { result_format: 'message' },
    };

    const res = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Qwen-VL API ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const content = data?.output?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Qwen-VL: empty response');

    return parseFrameAnalysis(content, input.frames);
  }
}

function buildPrompt(frames: Array<{ timestamp: number; url: string }>, context?: string): string {
  const tsList = frames.map((f, i) => `(${i+1}) ${f.timestamp}s`).join('、');
  return [
    context ? `视频背景：${context}` : '',
    `下面给你 ${frames.length} 张关键帧图，时间点分别为：${tsList}。`,
    '请对每帧返回：sceneDescription（一句话场景描述）、entities（出场人物/物体数组）、onScreenText（屏幕上的文字，如有）。',
    '返回 JSON 数组，每个元素含 timestamp/sceneDescription/entities/onScreenText 字段。',
    '只返回 JSON，不要说别的。',
  ].filter(Boolean).join('\n');
}

function parseFrameAnalysis(
  content: string,
  frames: Array<{ timestamp: number; url: string }>
): VisualFrameAnalysis[] {
  // 1. 尝试直接 JSON.parse
  // 2. 失败的话从内容中抓 JSON 数组片段
  // 3. 还失败 → 回退为单帧通用描述（避免阻塞主流程）
  let parsed: any = null;
  try { parsed = JSON.parse(content); } catch {}
  if (!Array.isArray(parsed)) {
    const m = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch {}
    }
  }
  if (!Array.isArray(parsed)) {
    return frames.map((f) => ({
      timestamp: f.timestamp,
      sceneDescription: '画面理解暂不可用',
      entities: [],
    }));
  }
  return parsed.map((p: any, i: number) => ({
    timestamp: Number(p.timestamp ?? frames[i]?.timestamp ?? 0),
    sceneDescription: String(p.sceneDescription ?? ''),
    entities: Array.isArray(p.entities) ? p.entities.map(String) : [],
    onScreenText: p.onScreenText ? String(p.onScreenText) : undefined,
  }));
}
