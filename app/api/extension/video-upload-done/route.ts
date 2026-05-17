import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider } from '@/lib/storage';

interface Body { jobId: string; cosKey: string; sizeBytes: number; }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.jobId || !body.cosKey) return NextResponse.json({ error: 'jobId + cosKey required' }, { status: 400 });

  const provider = getStorageProvider();
  // 验证对象真的存在
  const exists = await provider.exists(body.cosKey);
  if (!exists) return NextResponse.json({ error: 'object not found in COS' }, { status: 400 });

  const cosUrl = provider.getPublicUrl(body.cosKey);
  const service = createServiceClient();
  const { error } = await service.from('video_jobs').update({
    download_status: 'done',
    cos_url: cosUrl,
    size_bytes: body.sizeBytes,
  }).eq('id', body.jobId).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同步 notes.media_url
  const { data: job } = await service.from('video_jobs').select('note_id').eq('id', body.jobId).single();
  if (job?.note_id) await service.from('notes').update({ media_url: cosUrl }).eq('id', job.note_id);

  return NextResponse.json({ ok: true });
}
