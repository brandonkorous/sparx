'use client';

// Checking a mailbox now, and disconnecting one. Moved out of mailboxes-list.tsx
// (sparx persona issue 236) unchanged.

import { useToast } from '@wizeworks/silicaui-react';

import { useConfirm } from '../../lib/confirm';
import { productCopy } from '../../lib/product';
import { mailboxErrorMessage, useDisconnectMailbox, useSyncMailbox } from './mailboxes-data';
import type { MailboxRowMoves } from './mailboxes-table';

function useSyncNow() {
  const toast = useToast();
  const sync = useSyncMailbox();
  const runSync = (id: string) => {
    sync.mutate(id, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.add({
            title: 'Could not check that mailbox',
            description: result.error ?? 'Try again in a moment.',
            type: 'error',
          });
          return;
        }
        toast.add({
          title:
            result.stored === 0
              ? 'Nothing new from anyone on your list'
              : `${String(result.stored)} new ${result.stored === 1 ? 'message' : 'messages'} added`,
          type: 'success',
        });
      },
      onError: (err: unknown) => {
        toast.add({
          title: 'Could not check that mailbox',
          description: mailboxErrorMessage(err, 'Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };
  return { runSync, syncing: sync.isPending };
}

function useDisconnect() {
  const toast = useToast();
  const confirm = useConfirm();
  const disconnect = useDisconnectMailbox();
  return async (id: string, address: string) => {
    const ok = await confirm({
      title: `Disconnect ${address}?`,
      description: productCopy(
        'crm.mailbox.disconnect',
        'Piggles stops reading new email from this mailbox and stops sending through it. The conversations already on your customers’ records are kept: disconnecting a mailbox has never meant deleting a year of correspondence.'
      ),
      confirmLabel: 'Disconnect it',
      cancelLabel: 'Keep it connected',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(id, {
      onSuccess: () => {
        toast.add({ title: 'Mailbox disconnected', type: 'success' });
      },
      onError: () => {
        toast.add({ title: 'Could not disconnect that mailbox', type: 'error' });
      },
    });
  };
}

export function useMailboxMoves(): MailboxRowMoves {
  const { runSync, syncing } = useSyncNow();
  const remove = useDisconnect();
  return {
    syncing,
    onSync: runSync,
    onRemove: (id, address) => {
      void remove(id, address);
    },
  };
}
