import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ReaderPageWrapper } from "@/components/reader/ReaderPageWrapper";
import { NoteDetailAuthCheck } from "@/components/notes/note-detail-auth-check";

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <NoteDetailAuthCheck params={params}>
        <ReaderPageWrapper params={params} />
      </NoteDetailAuthCheck>
    </Suspense>
  );
}

