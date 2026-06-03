import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider } from '@/lib/storage';

// P2 #2: 任何 < 50KB 的"视频"几乎可以确定是扩展抓取失败仍上传了占位文件。
// 阈值取得偏宽松(典型短视频 ≥ 数百 KB),只为拦截真正的空文件(0 字节、几 byte 报头等)。
const MIN_VIDEO_BYTES = 50 * 1024;

interface Body {
  jobId: string;
  cosKey: string;
  sizeBytes: number;
  /** B 站等 DASH：音频独立上传完成后回报，与视频 cosKey 同一次请求里一起报 */
  audioCosKey?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.jobId || !body.cosKey) return NextResponse.json({ error: 'jobId + cosKey required' }, { status: 400 });

  // P2 #2: 阈值校验,避免空文件/抓取失败的占位进入 pipeline 浪费转码+ASR 配额
  if (typeof body.sizeBytes !== 'number' || body.sizeBytes < MIN_VIDEO_BYTES) {
    return NextResponse.json(
      { error: `video too small (${body.sizeBytes ?? 'unknown'} bytes < ${MIN_VIDEO_BYTES})` },
      { status: 400 }
    );
  }

  const provider = getStorageProvider();
  // 验证对象真的存在
  const exists = await provider.exists(body.cosKey);
  if (!exists) return NextResponse.json({ error: 'object not found in COS' }, { status: 400 });

  // 双轨：如果声明了 audio key，必须也校验存在；缺一不可
  if (body.audioCosKey) {
    const audioExists = await provider.exists(body.audioCosKey);
    if (!audioExists) return NextResponse.json({ error: 'audio object not found in COS' }, { status: 400 });
  }

  const cosUrl = provider.getPublicUrl(body.cosKey);
  const service = createServiceClient();
  const updates: Record<string, unknown> = {
    download_status: 'done',
    cos_url: cosUrl,
    size_bytes: body.sizeBytes,
  };
  if (body.audioCosKey) {
    updates.audio_cos_key = body.audioCosKey;
    updates.audio_cos_url = provider.getPublicUrl(body.audioCosKey);
  }
  const { error } = await service.from('video_jobs').update(updates).eq('id', body.jobId).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同步 notes.media_url
  const { data: job } = await service.from('video_jobs').select('note_id').eq('id', body.jobId).single();
  if (job?.note_id) await service.from('notes').update({ media_url: cosUrl }).eq('id', job.note_id);

  return NextResponse.json({ ok: true });
}
