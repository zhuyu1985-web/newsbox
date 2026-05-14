"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message { role: 'user' | 'assistant'; content: string; }

export function QAPanel({ noteId, prebuiltQAs }: {
  noteId: string;
  prebuiltQAs: Array<{ q: string; a: string }>;
}) {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    setHistory(h => [...h, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/video/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, question: q, history }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { answer } = await res.json();
      setHistory(h => [...h, { role: 'assistant', content: answer }]);
    } catch (err) {
      setHistory(h => [...h, { role: 'assistant', content: `失败：${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* 预生成 Q&A */}
      {prebuiltQAs.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium mb-2">
            预生成问答 ({prebuiltQAs.length})
          </summary>
          <div className="space-y-2 mt-2">
            {prebuiltQAs.map((qa, i) => (
              <div key={i} className="text-sm border-l-2 border-muted pl-2">
                <div className="font-medium">{qa.q}</div>
                <div className="text-muted-foreground">{qa.a}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 聊天历史 */}
      <div className="flex-1 overflow-auto space-y-2">
        {history.length === 0 && (
          <div className="text-sm text-muted-foreground text-center mt-8">
            问关于这个视频的问题
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`text-sm p-2 rounded ${
              m.role === 'user' ? 'bg-blue-50 ml-8 dark:bg-blue-950' : 'bg-muted'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="text-sm text-muted-foreground">思考中...</div>
        )}
      </div>

      {/* 输入 */}
      <div className="flex gap-2 border-t pt-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="问关于这个视频的问题..."
        />
        <Button onClick={send} disabled={loading}>发送</Button>
      </div>
    </div>
  );
}
