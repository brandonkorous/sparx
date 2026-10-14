'use client';

// The moves on a conversation: who handles it, and whether it is open, resolved
// or spam. Moved out of thread.tsx (sparx persona issue 234) unchanged.

import { useToast } from '@wizeworks/silicaui-react';

import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { chatErrorMessage, useUpdateConversation } from './data';

type Status = 'open' | 'resolved' | 'spam';

/** The update invalidates the thread this pane is showing, so its refetch
 *  re-renders here; toasts are deferred a macrotask out of that commit to stay
 *  clear of React's flushSync guard. */
function useStatusWrite(id: string) {
  const toast = useToast();
  const update = useUpdateConversation(id);
  const write = (status: Status, success: string, failure: string) => {
    update.mutate(
      { status },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({ title: success, type: 'success' });
          });
        },
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({ title: failure, description: chatErrorMessage(error, ''), type: 'error' });
          });
        },
      }
    );
  };
  return { write, update };
}

function useAssign(id: string) {
  const toast = useToast();
  const update = useUpdateConversation(id);
  return (next: string) => {
    update.mutate(
      { assignedToId: next === '' ? null : next },
      {
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({
              title: 'Could not change who this is assigned to',
              description: chatErrorMessage(error, 'Nothing was changed.'),
              type: 'error',
            });
          });
        },
      }
    );
  };
}

export function useThreadMoves(id: string) {
  const confirm = useConfirm();
  const { write, update } = useStatusWrite(id);
  const assign = useAssign(id);
  const markSpam = async () => {
    const ok = await confirm({
      title: 'Mark this conversation as spam?',
      description:
        'It moves out of your open queue into Spam, and its reply box is turned off. You can move it back later if it turns out to be genuine.',
      confirmLabel: 'Mark as spam',
      cancelLabel: 'Leave it',
      color: 'danger',
    });
    if (ok) write('spam', 'Moved to spam', 'Could not mark this as spam');
  };
  return {
    pending: update.isPending,
    assign,
    resolve: () => {
      write('resolved', 'Marked as resolved', 'Could not resolve this conversation');
    },
    reopen: () => {
      write('open', 'Reopened', 'Could not reopen this conversation');
    },
    markSpam,
  };
}

export type ThreadMoves = ReturnType<typeof useThreadMoves>;
