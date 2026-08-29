'use client';

// One group of products — create it (hand-picked or automatic), then manage it.
//
// Create and manage are the same surface: `{ id: 'new' }` builds it, `{ id }`
// manages it. The one real fork is the KIND of group, chosen once at
// creation and fixed thereafter (the server refuses a manual↔automatic flip
// because it would throw away the other kind's data):
//
//   • MANUAL   — a list you hand-pick. The product picker is the whole job.
//   • AUTOMATIC — rules choose the products for you. The rule editor is the job,
//                 and after saving you can ask for the matches to be re-checked.
//
// A group has no draft/publish lifecycle — it is live the moment it exists —
// so there is no publish button, just Save.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCollection } from './collections-data';
import { CollectionEditor } from './collection-editor';

export function CollectionDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <CollectionEditor ctx={ctx} id="new" />
  ) : (
    <CollectionLoader ctx={ctx} id={id} />
  );
}

function CollectionLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: collection,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useCollection(id);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="group"
            title="Could not load this group"
            description="This is a problem reaching the server. The group itself is unaffected — nothing has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !collection) {
    return <PaneWaiting />;
  }

  return (
    <CollectionEditor
      ctx={ctx}
      id={id}
      collection={collection}
      isFetching={isFetching}
      updatedAt={collection ? dataUpdatedAt : undefined}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}
