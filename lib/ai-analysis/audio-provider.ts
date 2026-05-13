// lib/ai-analysis/audio-provider.ts
import type { AudioAnalysisProvider } from './types';
import { TingwuAdapter } from './adapters/tingwu';

let cached: AudioAnalysisProvider | null = null;

export function getAudioAnalysisProvider(): AudioAnalysisProvider {
  if (cached) return cached;
  const p = process.env.AUDIO_ANALYSIS_PROVIDER ?? 'tingwu';
  if (p !== 'tingwu') {
    throw new Error(`unknown AUDIO_ANALYSIS_PROVIDER: ${p}`);
  }
  cached = new TingwuAdapter();
  return cached;
}

export function _resetAudioProviderCache() { cached = null; }
