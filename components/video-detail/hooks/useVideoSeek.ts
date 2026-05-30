"use client";

type Autoplay = 'preserve' | 'force' | 'none';

export function useVideoSeek() {
  function dispatch(time: number, autoplay: Autoplay) {
    window.dispatchEvent(new CustomEvent('video:seek', { detail: { time, autoplay } }));
  }
  return {
    seek: (time: number) => dispatch(time, 'preserve'),
    seekAndPlay: (time: number) => dispatch(time, 'force'),
    seekOnly: (time: number) => dispatch(time, 'none'),
  };
}
