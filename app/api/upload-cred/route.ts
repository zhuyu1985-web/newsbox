import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageProvider, buildStorageKey, type StorageKind } from '@/lib/storage';
import { resolveContentType } from '@/lib/storage/mime';

// Dashboard 文件上传：客户端直传 COS。
// Next.js 16 + Turbopack 对大 multipart body 的 formData() 解析有上限（实测 ~24MB 就崩），
// 所以服务端只签名，文件本体由浏览器 PUT 到 COS，绕开 Next.js 中转层。
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      filename?: string;
      contentType?: string;
      kind?: StorageKind;
    };
    if (!body.filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

    const ext = (body.filename.split('.').pop() || 'bin').toLowerCase();
    const kind: StorageKind = body.kind || inferKind(body.contentType);
    const key = buildStorageKey({ userId: user.id, kind, ext });
    const safeContentType = resolveContentType(body.contentType, body.filename);

    const cred = await getStorageProvider().createUploadCredential({
      key,
      contentType: safeContentType,
      expiresIn: 3600,
    });

    return NextResponse.json({
      key,
      contentType: safeContentType,
      uploadUrl: cred.uploadUrl,
      method: cred.method,
      headers: cred.headers,
      publicUrl: cred.publicUrl,
      expiresAt: cred.expiresAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/upload-cred] failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function inferKind(mime: string | undefined): StorageKind {
  if (!mime) return 'images';
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  return 'images';
}
