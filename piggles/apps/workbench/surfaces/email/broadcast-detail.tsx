'use client';

// One broadcast — write it, or open one to see how it did. Create and edit share
// the same shape, so this is a PANE in two states, never a create modal:
// `{ id: 'new' }` starts a new broadcast, `{ id }` opens an existing one.
//
// A broadcast is editable ONLY while it is a draft. The moment it is sent or
// scheduled it becomes read-only, so the pane has two faces: the COMPOSER (this
// file, plus the field groups it renders) and the REVIEW (broadcast-review).
//
// The audience owns a business, not a mailing platform. Nothing here says
// "segment", "builder email" or "verified domain" without saying what it means:
// "who it goes to", "what you're sending", "the address it comes from".

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, Text } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBroadcast, type Broadcast } from './broadcasts-data';
import { BroadcastComposeBody } from './broadcast-compose-body';
import { BroadcastComposeToolbar } from './broadcast-compose-toolbar';
import { useBroadcastComposer } from './broadcast-compose-state';
import { BroadcastReview } from './broadcast-review';
import { COLUMN } from './broadcast-draft';
import { SaveFailure } from '@/components/save-failure';

/* ── The pane router ──────────────────────────────────────────────────────── */

export function BroadcastDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  if (id === 'new') return <BroadcastComposer ctx={ctx} />;
  return <LoadBroadcast ctx={ctx} id={id} />;
}

function LoadBroadcast({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: broadcast,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useBroadcast(id);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="broadcast"
            title="Could not load this broadcast"
            description="This is a problem reaching the server, or the broadcast no longer exists. Nothing has been changed."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !broadcast) return <PaneWaiting />;

  // Only a draft is editable; everything past that is read-only.
  if (broadcast.status === 'draft') return <BroadcastComposer ctx={ctx} broadcast={broadcast} />;
  return (
    <BroadcastReview
      ctx={ctx}
      broadcast={broadcast}
      isFetching={isFetching}
      updatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

/* ── The composer (new draft, or editing a draft) ─────────────────────────── */

function BroadcastComposer({ ctx, broadcast }: { ctx: SurfaceContext; broadcast?: Broadcast }) {
  // All state and every derived fact lives in the hook; this is only layout.
  const { toolbar, body, serverError } = useBroadcastComposer(ctx, broadcast);
  return (
    <div className={PANE_SHELL}>
      <BroadcastComposeToolbar {...toolbar} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {broadcast ? null : (
            <Text>
              One email to a whole audience at once. Choose who it goes to and what it says, then
              send it now or pick a time.
            </Text>
          )}

          <SaveFailure title="That didn’t go through" message={serverError} />

          <BroadcastComposeBody {...body} />
        </div>
      </div>
    </div>
  );
}
