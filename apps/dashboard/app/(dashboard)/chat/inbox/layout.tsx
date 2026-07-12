// Live Chat inbox — two-pane shell (docs/69 A-5).
//
// Left: the live conversation list. Right: the active thread (or the empty
// state). One shared chat socket (ChatSocketProvider) feeds both panes. The
// module gate + Violet color come from the parent /chat layout, so this layer
// only builds the inbox panes.

import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { ChatSocketProvider } from '../_components/chat-socket-provider';
import { ConversationList } from '../_components/conversation-list';
import type { ConversationSummaryDto } from '../_lib/types';

export const dynamic = 'force-dynamic';

export default async function ChatInboxLayout({
    children,
}: {
    children: React.ReactNode;
}): Promise<React.JSX.Element> {
    const session = await requireSession();
    let conversations: ConversationSummaryDto[] = [];
    try {
        const res = await api.getPaged<ConversationSummaryDto[]>('/v1/chat/conversations?take=50');
        conversations = res.data;
    } catch {
        conversations = [];
    }

    return (
        <ChatSocketProvider>
            <div className="grid h-[calc(100dvh-4rem)] grid-cols-1 md:grid-cols-[320px_1fr] bg-base-100">
                <aside className="border-base-300 overflow-hidden border-r bg-base-200">
                    <ConversationList initial={conversations} currentUserId={session.user.id} />
                </aside>
                <section className="min-w-0 overflow-hidden">{children}</section>
            </div>
        </ChatSocketProvider>
    );
}
