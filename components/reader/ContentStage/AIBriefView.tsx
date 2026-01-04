"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AIBrief {
  summary: string;
  key_facts: string[];
  key_people: string[];
  conclusion: string;
}

export function AIBriefView({ noteId }: { noteId: string }) {
  const [brief, setBrief] = useState<AIBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: 从API加载AI速览数据
    setLoading(false);
  }, [noteId]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">生成AI速览中...</div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无AI速览</h3>
          <p className="text-sm text-muted-foreground mb-4">
            点击生成AI速览，快速了解文章核心内容
          </p>
          <Button>
            <Sparkles className="h-4 w-4 mr-2" />
            生成AI速览
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* 极简卡片布局 - TODO: 完善设计 */}
        <Card className="p-6">
          <h3 className="font-semibold mb-3">核心摘要</h3>
          <p className="text-muted-foreground">{brief.summary}</p>
        </Card>
      </div>
    </div>
  );
}

