import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

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
}));
