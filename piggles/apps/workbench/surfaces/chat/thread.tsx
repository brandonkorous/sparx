'use client';

// One conversation — the messages, who you are talking to, and the moves you can
// make on it.
//
// A PANE opened BESIDE the inbox, never a modal. It is a durable thing you return
// to and deep-link, comparing two conversations side by side is useful, and above
// all opening it must not cost the operator their view of the queue — the whole
// reason it docks alongside rather than taking over.
//
// Opening it clears the staff-unread flag (mark-read on mount), so arriving here
// is what marks the conversation read for the row in the inbox and the count on
// it. Live-ish without a socket: the detail query polls, so a reply typed by the
// visitor — or by a teammate in another window — appears within seconds.
//
// Deliberately NOT EditorLayout: there is no form with a summary rail here. One
// column — a compact "who is this" card, the messages, and the composer pinned at
// the bottom — which is what a chat actually is. The card, the messages, the
// reply box, the moves and the toolbar are files of their own (sparx persona
// issue 234, which also gave the messages the room the card used to take).

import { useEffect, useRef } from 'react';
import { Select, Text } from '@wizeworks/silicaui-react';

import { PANE_SHELL } from '../../components/pane-toolbar';
import { useTeamRoster } from '../../lib/api/team';
import { useSites, useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { conversationName, useConversation, useMarkRead, type ConversationDetail } from './data';
import { useChatLive, useTypingIndicator } from './live';
import { Composer } from './thread-composer';
import { ContextCard } from './thread-context-card';
import { ThreadMessages } from './thread-messages';
import { useThreadMoves, type ThreadMoves } from './thread-moves';
import { ConversationLoadError, ConversationLoading, NoConversation } from './thread-states';
import { ThreadToolbar } from './thread-toolbar';

/** The pane's title, the unread flag cleared once, and the newest message kept in
 *  view as messages arrive. */
function useThreadEffects(ctx: SurfaceContext, id: string, data: ConversationDetail | undefined) {
  const markRead = useMarkRead(id);
  const scrollRef = useRef<HTMLOListElement | null>(null);
  const markedRef = useRef(false);
  const lastCountRef = useRef(0);
  const { setTitle } = ctx;
  useEffect(() => {
    if (data) setTitle(conversationName(data));
  }, [data, setTitle]);
  // Once, when the thread first loads with unread inbound messages. A ref rather
  // than a dependency, so a poll that re-reports the same count fires no write.
  useEffect(() => {
    if (!data || markedRef.current) return;
    markedRef.current = true;
    if (data.unreadStaff > 0) markRead.mutate();
  }, [data, markRead]);
  // Only when the count actually grew, so a background poll doesn't yank a
  // scrolled-up reader down.
  useEffect(() => {
    const count = data?.messages.length ?? 0;
    if (count > lastCountRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = count;
  }, [data?.messages.length]);
  return scrollRef;
}

/** Assigning lives here, beside the identity, rather than crowding the action
 *  bar: it is a property of the conversation, not a lifecycle move. */
function AssignRow({
  conversation,
  moves,
}: {
  conversation: ConversationDetail;
  moves: ThreadMoves;
}) {
  const { members } = useTeamRoster();
  const items: Record<string, string> = { '': 'Unassigned' };
  for (const member of members) items[member.userId] = member.name ?? member.email;
  // A saved assignee who has since left the team still needs a label, or the
  // Select shows a blank current value.
  if (conversation.assignedToId && !items[conversation.assignedToId]) {
    items[conversation.assignedToId] = 'A former teammate';
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Text as="span" className="text-sm font-medium">
        Assigned to
      </Text>
      <div className="min-w-40">
        <Select
          size="sm"
          color="module"
          aria-label="Who is handling this conversation"
          value={conversation.assignedToId ?? ''}
          items={items}
          onValueChange={(next) => {
            moves.assign(next as string);
          }}
        />
      </div>
    </div>
  );
}

export function ChatThreadSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  // Hold the socket open for this thread and join its room, so inbound messages,
  // status changes, and the visitor's typing arrive live rather than on a poll.
  useChatLive(id);
  const otherTyping = useTypingIndicator(id === '' ? undefined : id);
  const query = useConversation(id);
  const { data } = query;
  const { data: sites } = useSites();
  const viewerId = useViewer().data?.userId ?? null;
  const moves = useThreadMoves(id);
  const scrollRef = useThreadEffects(ctx, id, data);
  const refetch = () => {
    void query.refetch();
  };

  if (id === '') return <NoConversation />;
  if (query.isPending) return <ConversationLoading />;
  if (query.isError || !data)
    return <ConversationLoadError error={query.error} onRetry={refetch} />;

  const siteName = data.propertyId
    ? (sites?.find((s) => s.id === data.propertyId)?.name ?? null)
    : null;
  const refresh = {
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    onRefresh: refetch,
  };
  return (
    <div className={PANE_SHELL}>
      <ThreadToolbar conversation={data} viewerId={viewerId} moves={moves} refresh={refresh} />
      {/* Scrolls as a whole only when the pane is too short for the card, the
          messages' floor and the reply box together: nothing is ever cut off. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [&>*]:shrink-0">
        <ContextCard conversation={data} siteName={siteName} ctx={ctx} />
        <AssignRow conversation={data} moves={moves} />
        <ThreadMessages
          scrollRef={scrollRef}
          conversation={data}
          viewerId={viewerId}
          otherTyping={otherTyping}
        />
        <Composer id={id} disabled={data.status === 'spam'} />
      </div>
    </div>
  );
}
