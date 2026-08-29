'use client';

// Asking the platform to put its own improvements into the saved header and footer,
// and making whoever is looking at it see that.
//
// Two halves, and the second is the one that is easy to miss. The repair is a SERVER
// write, so an open studio pane is still holding the tree it fetched when it opened —
// `useLayout` reads at `staleTime: Infinity` and the editor copies that into its own
// store once. Invalidating the query is not enough: the store is the authority for
// everything except this. So the open document is reset from the server, exactly as a
// restore does and for the same reason (issue 315).
//
// Its own file rather than a second export from `layout-data`, because
// `reload-document` imports from there and the two would form a cycle.

import { useCallback } from 'react';
import { useQueryClient } from '@wizeworks/query';

import { useStudioBinding } from './provider';
import { LAYOUT_KEY, useRepairLayout, type LayoutRow } from './layout-data';
import { reloadDocument } from './reload-document';

export interface RepairChrome {
  run: () => Promise<void>;
  pending: boolean;
}

/** Apply the repair, then hand the repaired chrome to any pane holding the old one. */
export function useRepairChrome(): RepairChrome {
  const repair = useRepairLayout();
  const queryClient = useQueryClient();
  const { session } = useStudioBinding();

  const run = useCallback(async () => {
    await repair.mutateAsync();
    // No pane open, or the session is still resolving: nothing is holding a stale tree,
    // and the next open reads the repaired one.
    const row = queryClient.getQueryData<LayoutRow>(LAYOUT_KEY);
    if (!session || !row) return;
    await reloadDocument(session, { kind: 'layout', id: row.layoutId });
  }, [queryClient, repair, session]);

  return { run, pending: repair.isPending };
}
