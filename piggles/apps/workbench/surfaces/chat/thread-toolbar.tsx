'use client';

// The bar over a conversation: its state, the one lifecycle move that fits it,
// and the rest as labelled rows. Moved out of thread.tsx (sparx persona issue
// 234) unchanged.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faBan, faCircleCheck, faRotate, faUserCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { statusLabel, statusTone, type ConversationDetail } from './data';
import type { ThreadMoves } from './thread-moves';

function LifecycleButton({ status, moves }: { status: string; moves: ThreadMoves }) {
  if (status === 'resolved' || status === 'spam') {
    return (
      <Button
        size="sm"
        variant="outline"
        color="neutral"
        loading={moves.pending}
        onClick={moves.reopen}
      >
        <Icon glyph={faRotate} className="size-4" aria-hidden />
        {status === 'spam' ? 'Not spam' : 'Reopen'}
      </Button>
    );
  }
  return (
    <Button size="sm" color="module" loading={moves.pending} onClick={moves.resolve}>
      <Icon glyph={faCircleCheck} className="size-4" aria-hidden />
      Resolve
    </Button>
  );
}

/** The rows in the overflow: assign to me (unless it is already theirs) and
 *  mark as spam (unless it already is). */
function overflowActions(
  conversation: ConversationDetail,
  viewerId: string | null,
  moves: ThreadMoves
) {
  const isSpam = conversation.status === 'spam';
  const assignToMe =
    viewerId && conversation.assignedToId !== viewerId
      ? [
          {
            label: 'Assign to me',
            icon: faUserCheck,
            onClick: () => {
              moves.assign(viewerId);
            },
          },
        ]
      : [];
  const spam = isSpam
    ? []
    : [
        {
          label: 'Mark as spam',
          icon: faBan,
          tone: 'danger' as const,
          onClick: () => {
            void moves.markSpam();
          },
        },
      ];
  return [...assignToMe, ...spam];
}

export function ThreadToolbar(props: {
  conversation: ConversationDetail;
  viewerId: string | null;
  moves: ThreadMoves;
  refresh: { isFetching: boolean; updatedAt: number; onRefresh: () => void };
}) {
  const { conversation, viewerId, moves, refresh } = props;
  return (
    // VALUES rather than an ellipsis menu: as actions they arrive as labelled rows
    // in the overflow popover. scripts/check-toolbar-glyph.mjs holds the line.
    <PaneToolbar
      label="Conversation actions"
      actions={overflowActions(conversation, viewerId, moves)}
      refresh={
        <RefreshButton
          isFetching={refresh.isFetching}
          updatedAt={refresh.updatedAt}
          onRefresh={refresh.onRefresh}
        />
      }
    >
      <Badge color={statusTone(conversation.status)} variant="soft" size="sm">
        {statusLabel(conversation.status)}
      </Badge>
      <div className="flex-1" />
      <LifecycleButton status={conversation.status} moves={moves} />
    </PaneToolbar>
  );
}
