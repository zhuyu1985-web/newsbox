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

  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActiveTab: (t: 'brief' | 'transcript' | 'notes') => void;
  setActiveBriefSubTab: (t: 'chapters' | 'speakers' | 'qa') => void;
  setMiniPlayerVisible: (v: boolean) => void;
  toggleSpeaker: (id: string) => void;
  setNotesEditor: (e: Editor | null) => void;
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
}));
