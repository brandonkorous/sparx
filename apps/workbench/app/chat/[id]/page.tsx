import { redirectToSurface } from '../../../lib/surface-redirect';

// Legacy deep link from staff chat notifications (services/api-rest chat notify +
// web-push): /chat/<conversationId>. The workbench opens a conversation as the
// `chat.inbox.thread` surface, so translate the path into that `?open=` deep link.
export const dynamic = 'force-dynamic';

export default async function ChatThreadRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectToSurface(`chat.inbox.thread?id=${id}`);
}
