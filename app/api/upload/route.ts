import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageProvider, buildStorageKey, type StorageKind } from '@/lib/storage';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const kindRaw = form.get('kind') as string | null;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const kind: StorageKind = (kindRaw as StorageKind) || inferKind(file.type);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = buildStorageKey({ userId: user.id, kind, ext });

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const result = await getStorageProvider().upload({
      key,
      body: buf,
      contentType: file.type || 'application/octet-stream',
    });
    return NextResponse.json({ url: result.url, key: result.key, size: result.size });
  } catch (err) {
    console.error('[api/upload] upload failed', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `upload failed: ${message}` }, { status: 500 });
  }
}

function inferKind(mime: string): StorageKind {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  return 'images';
}
