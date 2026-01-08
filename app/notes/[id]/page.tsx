import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ReaderPageWrapper } from "@/components/reader/ReaderPageWrapper";
import { ReaderSkeleton } from "@/components/reader/ReaderSkeleton";
import { NoteDetailAuthCheck } from "@/components/notes/note-detail-auth-check";

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <NoteDetailAuthCheck params={params}>
        <ReaderPageWrapper params={params} />
      </NoteDetailAuthCheck>
    </Suspense>
  );
}

