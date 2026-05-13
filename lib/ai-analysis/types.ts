/**
 * AI 分析层 · 类型定义
 *
 * 设计要点：
 * - AudioAnalysisProvider：音频/文本分析（首发 Tingwu，未来可换）
 * - VisualAnalysisProvider：视觉分析（Qwen-VL）
 * - 两个 Provider 独立，分别工厂创建
 *
 * 参考：docs/superpowers/specs/2026-05-12-video-and-storage-design.md §5
 */

export type AudioCapability =
  | 'transcript'
  | 'chapters'
  | 'summary'
  | 'key_points'
  | 'qa';

export interface TranscriptSegment {
  start: number;        // 秒
  end: number;          // 秒
  text: string;
  speaker?: string;     // 说话人 ID
}

export interface Chapter {
  start: number;
  end: number;
  title: string;
  summary?: string;
}

export interface QAPair {
  q: string;
  a: string;
  anchorTime?: number;  // 关联的视频时间点（秒），可选
}

export interface AudioAnalysisResult {
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  summary: string;
  keyPoints: string[];
  qaPairs: QAPair[];
  speakers?: Array<{ id: string; label: string }>;
}

export interface AudioSubmitInput {
  mediaUrl: string;
  capabilities: AudioCapability[];
  language?: 'zh' | 'en' | 'auto';
}

export interface AudioPollResult {
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress?: number;
  result?: AudioAnalysisResult;
  error?: { code: string; message: string };
}

export interface AudioAnalysisProvider {
  readonly name: 'tingwu';
  submit(input: AudioSubmitInput): Promise<{ taskId: string }>;
  poll(taskId: string): Promise<AudioPollResult>;
}

export interface VisualFrameAnalysis {
  timestamp: number;
  sceneDescription: string;
  entities: string[];
  onScreenText?: string;
}

export interface VisualAnalysisProvider {
  readonly name: 'qwen-vl';
  analyzeFrames(input: {
    frames: Array<{ timestamp: number; url: string }>;
    context?: string;
  }): Promise<VisualFrameAnalysis[]>;
}
