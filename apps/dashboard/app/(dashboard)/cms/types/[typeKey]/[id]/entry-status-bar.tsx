'use client';

// The entry's status + publish actions (docs/51 §6). EditEntryForm owns ALL the
// state (status, autosave, the schedule/conflict machinery); this is purely
// presentational and gets rendered in one of two places:
//
//   · 'card' — the standalone Status card atop the form. Used on the drawer / any
//              surface without a live preview (the original layout, unchanged).
//   · 'bar'  — a compact horizontal cluster the live-preview workspace PORTALS into
//              its builder-style toolbar, so status + Publish sit alongside the view
//              controls (parity with the site studio's toolbar — docs/builder/03 §2.8).
//
// Same actions, same handlers, two arrangements — so moving status into the toolbar
// is a layout switch, not a second copy of the logic.

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardHeader, Heading, Stack, Text } from '@sparx/ui';
import { CalendarClock, History } from 'lucide-react';
import { PreviewButton } from '../../../[id]/preview-button';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'invalid'; count: number }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string };

export interface EntryStatusBarProps {
  /** 'card' = the standalone Status card; 'bar' = the toolbar cluster. */
  layout: 'card' | 'bar';
  status: string;
  saveState: SaveState;
  /** A publish/schedule transition is in flight — disables the action buttons. */
  pending: boolean;
  /** Routable types get a Preview link; non-routable ones (no URL) don't. */
  routable: boolean;
  entryId: string;
  slug: string;
  typeKey: string;
  tenantSlug: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  onTogglePublish: () => void;
  /** Open the schedule-publish modal (owned by EditEntryForm). */
  onSchedule: () => void;
  /** Conflict resolution (two-tab edit): drop my edits / force-save over theirs. */
  onDiscardConflict: () => void;
  onKeepConflict: () => void;
}

export function EntryStatusBar({
  layout,
  status,
  saveState,
  pending,
  routable,
  entryId,
  slug,
  typeKey,
  tenantSlug,
  publishedAt,
  scheduledAt,
  onTogglePublish,
  onSchedule,
  onDiscardConflict,
  onKeepConflict,
}: EntryStatusBarProps) {
  const published = status === 'published';

  const statusBadge = <Badge color={published ? 'success' : 'outline'}>{status}</Badge>;

  const indicator = (
    <AutosaveIndicator
      state={saveState}
      onDiscardMine={onDiscardConflict}
      onKeepMine={onKeepConflict}
    />
  );

  const actions = (
    <>
      {routable && (
        <PreviewButton entryId={entryId} slug={slug} typeKey={typeKey} tenantSlug={tenantSlug} />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        asChild
        leftIcon={<History className="h-3.5 w-3.5" />}
      >
        <Link href={`/cms/${entryId}/revisions`}>Revisions</Link>
      </Button>
      {!published && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
          onClick={onSchedule}
          disabled={pending}
        >
          Schedule
        </Button>
      )}
      <Button
        type="button"
        color={published ? 'neutral' : 'module'}
        variant={published ? 'outline' : 'solid'}
        size="sm"
        onClick={onTogglePublish}
        disabled={pending}
      >
        {published ? 'Unpublish' : 'Publish'}
      </Button>
    </>
  );

  if (layout === 'bar') {
    // Compact toolbar cluster: status + autosave + actions, right-aligned next to
    // the workspace's view controls. The publish timestamp rides along only on wide
    // viewports (it's reference, not an action) so the bar stays uncluttered.
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {statusBadge}
        {indicator}
        {(publishedAt ?? scheduledAt) && (
          <Text size="xs" variant="muted" className="hidden 2xl:inline-flex">
            {scheduledAt
              ? `Scheduled ${scheduledAt.toLocaleString()}`
              : `Published ${publishedAt!.toLocaleString()}`}
          </Text>
        )}
        {actions}
      </div>
    );
  }

  return (
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Stack direction="row" align="center" gap={2} wrap>
            <Heading level={3}>Status</Heading>
            {statusBadge}
            {indicator}
          </Stack>
          <Stack direction="row" align="center" gap={2} wrap>
            {actions}
          </Stack>
        </Stack>
      </CardHeader>
      {(publishedAt ?? scheduledAt) && (
        <CardContent>
          <Stack gap={1}>
            {scheduledAt && (
              <Text size="sm" variant="muted">
                Scheduled for {scheduledAt.toLocaleString()}
              </Text>
            )}
            {publishedAt && (
              <Text size="sm" variant="muted">
                Last published {publishedAt.toLocaleString()}
              </Text>
            )}
          </Stack>
        </CardContent>
      )}
    </Card>
  );
}

// Status pill next to the Status badge — same contract as the Pages editor's, plus
// an `invalid` state for the client-side autosave pre-validation skip.
function AutosaveIndicator({
  state,
  onDiscardMine,
  onKeepMine,
}: {
  state: SaveState;
  onDiscardMine: () => void;
  onKeepMine: () => void;
}) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'saving') {
    return (
      <Text size="xs" variant="muted" aria-live="polite">
        Saving…
      </Text>
    );
  }
  if (state.kind === 'saved') {
    return (
      <Text size="xs" variant="muted" aria-live="polite">
        Saved {state.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    );
  }
  if (state.kind === 'invalid') {
    return (
      <Text size="xs" variant="muted" aria-live="polite">
        {state.count === 1 ? '1 field needs attention' : `${state.count} fields need attention`}{' '}
        before autosave
      </Text>
    );
  }
  if (state.kind === 'conflict') {
    return (
      <Stack direction="row" align="center" gap={2}>
        <Text size="xs" variant="danger" aria-live="polite">
          Someone else saved this entry since you started editing.
        </Text>
        <Button type="button" variant="ghost" size="xs" onClick={onDiscardMine}>
          Discard mine
        </Button>
        <Button type="button" color="module" variant="outline" size="xs" onClick={onKeepMine}>
          Keep mine (force save)
        </Button>
      </Stack>
    );
  }
  return (
    <Text size="xs" variant="danger" aria-live="polite">
      Autosave failed: {state.message}
    </Text>
  );
}
