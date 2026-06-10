// Live Chat inbox — single conversation thread + CRM context (docs/69 A-5).

import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { ThreadView } from '../_components/thread-view';
import { CustomerContextSidebar } from '../_components/customer-context-sidebar';
import type { ConversationDetailDto, CustomerContextDto, QuickReplyDto } from '../_lib/types';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}): Promise<React.JSX.Element> {
  const { conversationId } = await params;
  const session = await requireSession();

  const [conversation, context, quickReplies] = await Promise.all([
    api.get<ConversationDetailDto>(`/v1/chat/conversations/${conversationId}`),
    api.get<CustomerContextDto>(`/v1/chat/conversations/${conversationId}/context`),
    api.get<QuickReplyDto[]>('/v1/chat/quick-replies').catch(() => [] as QuickReplyDto[]),
  ]);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_300px]">
      <ThreadView
        key={conversationId}
        conversation={conversation}
        currentUserId={session.user.id}
        quickReplies={quickReplies}
      />
      <CustomerContextSidebar context={context} />
    </div>
  );
}
