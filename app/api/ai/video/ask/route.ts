import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { askVideoQuestion } from '@/lib/ai-analysis/qa-service';
import type { TranscriptSegment } from '@/lib/ai-analysis/types';

interface Body {
  noteId: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.noteId || !body.question) return NextResponse.json({ error: 'noteId + question required' }, { status: 400 });

  const service = createServiceClient();
  const { data: job } = await service
    .from('video_jobs')
    .select('audio_result')
    .eq('note_id', body.noteId)
    .eq('user_id', user.id)
    .single();
  const audioResult = job?.audio_result as { transcript?: TranscriptSegment[] } | null;
  if (!audioResult?.transcript?.length) return NextResponse.json({ error: 'transcript not ready' }, { status: 400 });

  try {
    const r = await askVideoQuestion({
      transcript: audioResult.transcript,
      question: body.question,
      history: body.history,
    });
    return NextResponse.json({ answer: r.answer });
  } catch (err) {
    console.error('[ai/video/ask]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'qa failed' }, { status: 500 });
  }
}
