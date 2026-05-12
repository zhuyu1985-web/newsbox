import type { StorageProvider } from '../types';

const NOT_IMPLEMENTED = 'VolcengineTosAdapter is not implemented. Set STORAGE_PROVIDER to "supabase" or "tencent-cos".';

export class VolcengineTosAdapter implements StorageProvider {
  readonly name = 'volcengine-tos' as const;

  constructor() {
    throw new Error(NOT_IMPLEMENTED);
  }

  upload(): never { throw new Error(NOT_IMPLEMENTED); }
  createUploadCredential(): never { throw new Error(NOT_IMPLEMENTED); }
  getPublicUrl(): never { throw new Error(NOT_IMPLEMENTED); }
  delete(): never { throw new Error(NOT_IMPLEMENTED); }
  exists(): never { throw new Error(NOT_IMPLEMENTED); }
}
