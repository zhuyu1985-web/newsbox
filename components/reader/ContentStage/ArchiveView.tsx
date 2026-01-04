"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Download, Calendar } from "lucide-react";

interface WebArchive {
  id: string;
  snapshot_url: string;
  screenshot_url: string | null;
  archived_at: string;
  original_url: string;
}

export function ArchiveView({ noteId }: { noteId: string }) {
  const [archive, setArchive] = useState<WebArchive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchive();
  }, [noteId]);

  const loadArchive = async () => {
    // TODO: 从API加载存档数据
    setLoading(false);
  };

  const handleCreateArchive = async () => {
    // TODO: 创建存档
    console.log("Creating archive...");
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">加载存档中...</div>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无网页存档</h3>
          <p className="text-sm text-muted-foreground mb-4">
            创建网页快照，永久保存内容用于证据留存
          </p>
          <Button onClick={handleCreateArchive}>
            <Archive className="h-4 w-4 mr-2" />
            创建存档
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* 存档信息栏 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                存档于 {new Date(archive.archived_at).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {archive.screenshot_url && (
              <Button variant="outline" size="sm">
                查看截图
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出HTML
            </Button>
          </div>
        </div>
      </Card>

      {/* 存档内容 */}
      <Card className="flex-1 overflow-hidden">
        <iframe
          src={archive.snapshot_url}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          title="网页存档"
        />
      </Card>
    </div>
  );
}

