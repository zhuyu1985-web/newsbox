import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import type { QAPair } from '@/lib/ai-analysis/types';

export type TranslationLang = 'en' | 'ja' | 'ko' | 'auto-zh';
export type TranslationMode = 'bilingual' | 'target-only';
export type VideoDetailTab = 'brief' | 'transcript' | 'qa' | 'notes';
export type BriefSubTab = 'chapters' | 'speakers';
export type MobileSheetKey = VideoDetailTab | 'more';
export type TranscriptMarkerFilterKind = 'important' | 'question' | 'todo';

/**
 * AI 兜底生成（enrich）后会回传新数据，落库需要刷新页面才能看到。
 * 用 overrides 让前端立刻拿到新值，避免 reload 跳屏。
 * 下次进入页面（重新拉 prop）这些 override 自动作废 — 不持久化。
 */
export interface AudioOverrides {
  keywords?: string[];
  qaPairs?: QAPair[];
  speakerSummaries?: Array<{ speakerId: string; points: string[] }>;
}

interface VideoDetailState {
  currentTime: number;
  isPlaying: boolean;
  activeTab: VideoDetailTab;
  activeBriefSubTab: BriefSubTab;
  miniPlayerVisible: boolean;
  audioMode: boolean;
  audioOverrides: AudioOverrides;
  selectedSpeakers: Set<string>;
  notesEditor: Editor | null;
  showMarkedTranscriptOnly: boolean;
  selectedTranscriptMarkerKinds: TranscriptMarkerFilterKind[];
  // 原文搜索
  searchOpen: boolean;
  searchQuery: string;
  searchMatches: number[];          // 命中片段在 transcript 数组中的下标
  searchCurrentMatch: number;       // 当前命中在 searchMatches 中的下标；-1 表示无
  // 翻译
  translationOpen: boolean;
  translationTarget: TranslationLang | null;        // null = 未翻译
  translationMode: TranslationMode;
  translations: Record<number, string>;              // 索引 -> 译文
  translationLoading: boolean;
  // 移动端底部抽屉
  mobileSheetOpen: MobileSheetKey | null;

  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActiveTab: (t: VideoDetailTab) => void;
  setActiveBriefSubTab: (t: BriefSubTab) => void;
  setMiniPlayerVisible: (v: boolean) => void;
  setAudioMode: (v: boolean) => void;
  mergeAudioOverrides: (patch: AudioOverrides) => void;
  toggleSpeaker: (id: string) => void;
  setNotesEditor: (e: Editor | null) => void;
  setShowMarkedTranscriptOnly: (v: boolean) => void;
  toggleTranscriptMarkerKind: (kind: TranscriptMarkerFilterKind) => void;
  // 原文搜索 setters
  setSearchOpen: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchMatches: (indices: number[]) => void;
  setSearchCurrentMatch: (i: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  // 翻译 setters
  setTranslationOpen: (v: boolean) => void;
  setTranslationTarget: (t: TranslationLang | null) => void;
  setTranslationMode: (m: TranslationMode) => void;
  setTranslations: (map: Record<number, string>) => void;
  setTranslationLoading: (v: boolean) => void;
  clearTranslations: () => void;
  // 移动端底部抽屉 setter
  setMobileSheetOpen: (v: MobileSheetKey | null) => void;
}

const VIDEO_DETAIL_TABS: VideoDetailTab[] = ['brief', 'transcript', 'qa', 'notes'];

function parseVideoDetailTab(value: string | null): VideoDetailTab {
  return VIDEO_DETAIL_TABS.includes(value as VideoDetailTab)
    ? (value as VideoDetailTab)
    : 'brief';
}

export const useVideoDetailStore = create<VideoDetailState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  activeTab: (typeof sessionStorage !== 'undefined'
    ? parseVideoDetailTab(sessionStorage.getItem('video-detail.activeTab'))
    : 'brief'),
  activeBriefSubTab: 'chapters',
  miniPlayerVisible: false,
  audioMode: false,
  audioOverrides: {},
  selectedSpeakers: new Set(),
  notesEditor: null,
  showMarkedTranscriptOnly: false,
  selectedTranscriptMarkerKinds: [],

  searchOpen: false,
  searchQuery: '',
  searchMatches: [],
  searchCurrentMatch: -1,

  translationOpen: false,
  translationTarget: null,
  translationMode: 'bilingual',
  translations: {},
  translationLoading: false,

  mobileSheetOpen: null,

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setActiveTab: (t) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('video-detail.activeTab', t);
    set({ activeTab: t });
  },
  setActiveBriefSubTab: (t) => set({ activeBriefSubTab: t }),
  setMiniPlayerVisible: (v) => set({ miniPlayerVisible: v }),
  setAudioMode: (v) => set({ audioMode: v }),
  mergeAudioOverrides: (patch) =>
    set((s) => ({ audioOverrides: { ...s.audioOverrides, ...patch } })),
  toggleSpeaker: (id) => set((s) => {
    const next = new Set(s.selectedSpeakers);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedSpeakers: next };
  }),
  setNotesEditor: (e) => set({ notesEditor: e }),
  setShowMarkedTranscriptOnly: (v) => set({ showMarkedTranscriptOnly: v }),
  toggleTranscriptMarkerKind: (kind) => set((s) => {
    const selected = s.selectedTranscriptMarkerKinds;
    const next = selected.includes(kind)
      ? selected.filter((item) => item !== kind)
      : [...selected, kind];
    return {
      selectedTranscriptMarkerKinds: next,
      showMarkedTranscriptOnly: true,
    };
  }),

  setSearchOpen: (v) => set({ searchOpen: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchMatches: (indices) => set({
    searchMatches: indices,
    searchCurrentMatch: indices.length > 0 ? 0 : -1,
  }),
  setSearchCurrentMatch: (i) => set({ searchCurrentMatch: i }),
  nextMatch: () => set((s) => {
    if (s.searchMatches.length === 0) return {};
    return { searchCurrentMatch: (s.searchCurrentMatch + 1) % s.searchMatches.length };
  }),
  prevMatch: () => set((s) => {
    if (s.searchMatches.length === 0) return {};
    const next = s.searchCurrentMatch - 1;
    return { searchCurrentMatch: next < 0 ? s.searchMatches.length - 1 : next };
  }),

  setTranslationOpen: (v) => set({ translationOpen: v }),
  setTranslationTarget: (t) => set({ translationTarget: t }),
  setTranslationMode: (m) => set({ translationMode: m }),
  setTranslations: (map) => set({ translations: map }),
  setTranslationLoading: (v) => set({ translationLoading: v }),
  clearTranslations: () => set({
    translations: {},
    translationTarget: null,
  }),

  setMobileSheetOpen: (v) => set({ mobileSheetOpen: v }),
}));
