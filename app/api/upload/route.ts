import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageProvider, buildStorageKey, type StorageKind } from '@/lib/storage';
import { resolveContentType } from '@/lib/storage/mime';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[api/upload] formData parse failed:', msg);
      return NextResponse.json({ error: `formData parse failed: ${msg}` }, { status: 413 });
    }

    const file = form.get('file') as File | null;
    const kindRaw = form.get('kind') as string | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    console.log('[api/upload] received file', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    const kind: StorageKind = (kindRaw as StorageKind) || inferKind(file.type);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const key = buildStorageKey({ userId: user.id, kind, ext });

    const contentType = resolveContentType(file.type, file.name);

    let buf: Buffer;
    try {
      buf = Buffer.from(await file.arrayBuffer());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[api/upload] arrayBuffer failed:', msg);
      return NextResponse.json({ error: `arrayBuffer failed: ${msg}` }, { status: 500 });
    }

    try {
      const result = await getStorageProvider().upload({ key, body: buf, contentType });
      return NextResponse.json({ url: result.url, key: result.key, size: result.size });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api/upload] cos upload failed:', message, err);
      return NextResponse.json({ error: `upload failed: ${message}` }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/upload] FATAL:', message, err);
    return NextResponse.json({ error: `fatal: ${message}` }, { status: 500 });
  }
}

function inferKind(mime: string): StorageKind {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  return 'images';
}

