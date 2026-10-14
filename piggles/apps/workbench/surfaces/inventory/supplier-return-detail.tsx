'use client';

// ONE RETURN: put it together, send it, then chase the credit. Create and edit
// are the same surface, so `{id:'new'}` renders the same pane that `{id}` does.

import { useEffect } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSupplierReturn } from './supplier-returns-data';
import { NewReturn } from './supplier-return-new';
import { ExistingReturn } from './supplier-return-existing';

export function SupplierReturnDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  const isNew = id === 'new';

  const existing = useSupplierReturn(id);
  const data = existing.data;

  // The tab's name, once the record is here. Panes that skipped this put identical
  // words on every tab they opened. [[feedback_a_fix_leaves_its_neighbour_behind]]
  useEffect(() => {
    if (data) ctx.setTitle(data.number);
  }, [data, ctx]);

  if (isNew) return <NewReturn ctx={ctx} />;

  if (existing.isError) {
    // A 404 (removed, or another business's id) and a failed request say
    // different things; the shared screen reads which from the error rather
    // than calling every one a connection problem (persona issue 226).
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={existing.error}
          noun="return"
          title="Could not load that return"
          description="This is a problem reaching the server. The return itself is unaffected. Try again in a moment."
          onRetry={() => {
            void existing.refetch();
          }}
        />
      </div>
    );
  }
  if (existing.isLoading || !data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the return…" />
      </div>
    );
  }

  return <ExistingReturn ctx={ctx} id={id} />;
}
