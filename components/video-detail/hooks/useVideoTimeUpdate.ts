"use client";
import { useEffect } from 'react';

export function useVideoTimeUpdate(callback: (time: number) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ time: number }>;
      if (typeof ce.detail?.time === 'number') callback(ce.detail.time);
    };
    window.addEventListener('video:timeupdate', handler);
    return () => window.removeEventListener('video:timeupdate', handler);
  }, [callback]);
}
