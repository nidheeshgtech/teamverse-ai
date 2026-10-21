import { notFound } from "next/navigation";
import { z } from "zod";
import { Thread } from "./thread";

/** Resolves the [conversationId] param; membership is enforced by RLS when the thread loads. */
export async function ThreadRoute({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!z.uuid().safeParse(conversationId).success) notFound();
  return <Thread key={conversationId} conversationId={conversationId} />;
}
