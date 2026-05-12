import { createClient } from '@/lib/supabase/server';
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from '../types';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'user-files';

export class SupabaseAdapter implements StorageProvider {
  readonly name = 'supabase' as const;

  async upload(input: UploadInput): Promise<UploadResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(input.key, input.body as any, {
        contentType: input.contentType,
        upsert: false,
      });
    if (error || !data) throw new Error(`supabase upload failed: ${error?.message}`);

    const url = this.getPublicUrl(data.path);
    const size = sizeOfBody(input.body);
    return { url, key: data.path, size };
  }

  async createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(input.key);
    if (error || !data) throw new Error(`supabase signed upload url failed: ${error?.message}`);

    const publicUrl = this.getPublicUrl(input.key);
    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      publicUrl,
      expiresAt: Date.now() + (input.expiresIn ?? 3600) * 1000,
    };
  }

  getPublicUrl(key: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    return `${base}/storage/v1/object/public/${BUCKET}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).remove([key]);
    if (error) throw new Error(`supabase delete failed: ${error.message}`);
  }

  async exists(key: string): Promise<boolean> {
    const supabase = await createClient();
    const lastSlash = key.lastIndexOf('/');
    const prefix = lastSlash >= 0 ? key.slice(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      search: fileName,
      limit: 1,
    });
    if (error) throw new Error(`supabase list failed: ${error.message}`);
    return (data ?? []).some((f) => f.name === fileName);
  }
}

function sizeOfBody(body: Buffer | ReadableStream | Blob): number {
  if (Buffer.isBuffer(body)) return body.byteLength;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  return 0; // ReadableStream size unknown
}
