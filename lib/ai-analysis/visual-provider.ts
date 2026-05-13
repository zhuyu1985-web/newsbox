// lib/ai-analysis/visual-provider.ts
import type { VisualAnalysisProvider } from './types';
import { QwenVlAdapter } from './adapters/qwen-vl';

let cached: VisualAnalysisProvider | null = null;

export function getVisualAnalysisProvider(): VisualAnalysisProvider | null {
  if (cached) return cached;
  const p = process.env.VISUAL_ANALYSIS_PROVIDER ?? 'qwen-vl';
  if (p === 'none') return null;
  if (p !== 'qwen-vl') {
    throw new Error(`unknown VISUAL_ANALYSIS_PROVIDER: ${p}`);
  }
  cached = new QwenVlAdapter();
  return cached;
}

export function _resetVisualProviderCache() { cached = null; }
