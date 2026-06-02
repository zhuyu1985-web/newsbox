// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoSeek } from '@/components/video-detail/hooks/useVideoSeek';

describe('useVideoSeek', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches video:seek with preserve autoplay by default', () => {
    const listener = vi.fn();
    window.addEventListener('video:seek', listener);

    const { result } = renderHook(() => useVideoSeek());
    act(() => result.current.seek(123));

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 123, autoplay: 'preserve' });

    window.removeEventListener('video:seek', listener);
  });

  it('seekAndPlay forces autoplay', () => {
    const listener = vi.fn();
    window.addEventListener('video:seek', listener);

    const { result } = renderHook(() => useVideoSeek());
    act(() => result.current.seekAndPlay(99));

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 99, autoplay: 'force' });

    window.removeEventListener('video:seek', listener);
  });
});
