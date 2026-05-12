import { nanoid } from 'nanoid';
import type { StorageKind } from './types';

const USER_ID_RE = /^[A-Za-z0-9_-]+$/;

export function buildStorageKey(input: {
  userId: string;
  kind: StorageKind;
  ext: string;
}): string {
  if (!USER_ID_RE.test(input.userId)) {
    throw new Error(`invalid userId: must match [A-Za-z0-9_-]+`);
  }
  const normalizedExt = input.ext.replace(/^\./, '').toLowerCase();
  if (!normalizedExt) throw new Error('ext is required');

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');

  return `${input.userId}/${input.kind}/${yyyy}/${mm}/${dd}/${nanoid(12)}.${normalizedExt}`;
}
