export type {
  StorageProvider,
  MediaProcessingCapability,
  StorageBackend,
  StorageKind,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from './types';
export { hasMediaProcessing } from './types';
export { getStorageProvider } from './provider';
export { identifyStorageBackend } from './url';
export { buildStorageKey } from './keys';
