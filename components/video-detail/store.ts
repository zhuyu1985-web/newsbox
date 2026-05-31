import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

export type TranslationLang = 'en' | 'ja' | 'ko' | 'auto-zh';
export type TranslationMode = 'bilingual' | 'target-only';

interface VideoDetailState {
  currentTime: number;
  isPlaying: boolean;
  activeTab: 'brief' | 'transcript' | 'notes';
  activeBriefSubTab: 'chapters' | 'speakers' | 'qa';
  miniPlayerVisible: boolean;
  selectedSpeakers: Set<string>;
  notesEditor: Editor | null;
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
  mobileSheetOpen: 'brief' | 'transcript' | 'notes' | 'more' | null;

  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActiveTab: (t: 'brief' | 'transcript' | 'notes') => void;
  setActiveBriefSubTab: (t: 'chapters' | 'speakers' | 'qa') => void;
  setMiniPlayerVisible: (v: boolean) => void;
  toggleSpeaker: (id: string) => void;
  setNotesEditor: (e: Editor | null) => void;
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
  setMobileSheetOpen: (v: 'brief' | 'transcript' | 'notes' | 'more' | null) => void;
}

export const useVideoDetailStore = create<VideoDetailState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  activeTab: (typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('video-detail.activeTab') as any) || 'brief'
    : 'brief'),
  activeBriefSubTab: 'chapters',
  miniPlayerVisible: false,
  selectedSpeakers: new Set(),
  notesEditor: null,

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
  toggleSpeaker: (id) => set((s) => {
    const next = new Set(s.selectedSpeakers);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedSpeakers: next };
  }),
  setNotesEditor: (e) => set({ notesEditor: e }),

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
