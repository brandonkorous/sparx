'use client';

// Putting a document back, and making the pane holding it show that.
//
// Confirmed first. A restore overwrites whatever the author has in front of them
// right now, which is the one thing in this builder that can lose unsaved work —
// and the confirm is where they find out that it can.

import { useCallback, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import type { DocumentRef } from '@wizeworks/studio';
import { useConfirm } from '../../lib/confirm';
import { useStudioBinding } from '../../lib/studio/provider';
import { reloadDocument } from '../../lib/studio/reload-document';
import { useRestoreVersion, type HistorySource } from '../../lib/studio/history-data';

export interface RestoreState {
  /** The entry currently being put back, so only ITS row shows a spinner. */
  pendingId: string | null;
  run: (entryId: string) => Promise<void>;
}

export function useRestore(source: HistorySource, ref: DocumentRef, name: string): RestoreState {
  const { session } = useStudioBinding();
  const confirm = useConfirm();
  const toast = useToast();
  const restore = useRestoreVersion(source);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const run = useCallback(
    async (entryId: string) => {
      const dirty = session?.store(ref)?.dirty ?? false;
      const ok = await confirm({
        title: `Put “${name}” back to this version?`,
        description: dirty
          ? 'You have changes here that aren’t saved. Putting an older version back will replace them, and they will be gone.'
          : 'This replaces what you have open. Your later versions stay in this list, so you can come back to them.',
        confirmLabel: 'Put it back',
        cancelLabel: 'Leave it as it is',
        color: dirty ? 'danger' : 'primary',
      });
      if (!ok) return;

      setPendingId(entryId);
      try {
        await restore.mutateAsync(entryId);
        // The server is the authority for this one write, so the open pane is handed
        // the restored document rather than left holding the one just replaced.
        if (session) await reloadDocument(session, ref);
        toast.add({ title: `“${name}” put back`, type: 'success' });
      } catch {
        toast.add({ title: 'That version could not be put back', type: 'error' });
      } finally {
        setPendingId(null);
      }
    },
    [confirm, name, ref, restore, session, toast]
  );

  return { pendingId, run };
}
