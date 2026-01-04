"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle } from "lucide-react";

export function WebView({ url }: { url: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="h-full flex flex-col p-4">
      {hasError ? (
        <Card className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">无法加载原始网页</h3>
          <p className="text-sm text-muted-foreground mb-4">
            该网站可能设置了iframe限制（X-Frame-Options）
          </p>
          <Button onClick={() => window.open(url, "_blank")} variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            在新标签页打开
          </Button>
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          )}
          <iframe
            src={url}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            title="原始网页"
          />
        </Card>
      )}
    </div>
  );
}

