import { describe, it, expect, vi } from 'vitest';
import { buildStorageKey } from '@/lib/storage/keys';

describe('buildStorageKey', () => {
  it('produces well-formed key with all segments', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T10:00:00Z'));

    const key = buildStorageKey({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      kind: 'videos',
      ext: 'mp4',
    });

    expect(key).toMatch(
      /^550e8400-e29b-41d4-a716-446655440000\/videos\/2026\/05\/12\/[a-zA-Z0-9_-]{12}\.mp4$/
    );

    vi.useRealTimers();
  });

  it('rejects userId with path traversal characters', () => {
    expect(() => buildStorageKey({ userId: '../etc', kind: 'images', ext: 'jpg' }))
      .toThrow(/invalid userId/i);
  });

  it('normalizes ext (strip leading dot, lowercase)', () => {
    const key = buildStorageKey({ userId: 'u', kind: 'images', ext: '.JPG' });
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('rejects empty ext', () => {
    expect(() => buildStorageKey({ userId: 'u', kind: 'images', ext: '' })).toThrow();
  });
});
