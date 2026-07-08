'use client';

// The entry's status + publish actions (docs/51 §6). EditEntryForm owns ALL the
// state (status, the schedule machinery); this is purely presentational and gets
// rendered in one of two places:
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
import { statusLabel, statusTone } from '@sparx/ui';
import { Badge, Button, Card, CardBody } from 'silicaui-react';
import { CalendarClock, History } from 'lucide-react';
import { PreviewButton } from '../../../[id]/preview-button';

export interface EntryStatusBarProps {
  /** 'card' = the standalone Status card; 'bar' = the toolbar cluster. */
  layout: 'card' | 'bar';
  status: string;
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
}

export function EntryStatusBar({
  layout,
  status,
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
}: EntryStatusBarProps) {
  const published = status === 'published';

  const statusBadge = (
    <Badge color={statusTone(status)} variant="soft">
      {statusLabel(status)}
    </Badge>
  );

  // In the header/toolbar (anything but the standalone card) the secondary actions
  // go icon-only with tooltips so the cluster fits one compact row; the card has
  // room for full labels.
  const compact = layout !== 'card';
  const actions = (
    <>
      {routable && (
        <PreviewButton
          iconOnly={compact}
          entryId={entryId}
          slug={slug}
          typeKey={typeKey}
          tenantSlug={tenantSlug}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Revisions"
        title={compact ? 'Revisions' : undefined}
        iconStart={compact ? undefined : <History className="h-3.5 w-3.5" />}
        render={<Link href={`/cms/${entryId}/revisions`} />}
      >
        {compact ? <History className="h-3.5 w-3.5" /> : 'Revisions'}
      </Button>
      {!published && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Schedule publish"
          title={compact ? 'Schedule publish' : undefined}
          iconStart={compact ? undefined : <CalendarClock className="h-3.5 w-3.5" />}
          onClick={onSchedule}
          disabled={pending}
        >
          {compact ? <CalendarClock className="h-3.5 w-3.5" /> : 'Schedule'}
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
    // Compact toolbar cluster: status + actions, right-aligned next to the
    // workspace's view controls. The publish timestamp rides along only on wide
    // viewports (it's reference, not an action) so the bar stays uncluttered.
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {statusBadge}
        {actions}
      </div>
    );
  }

  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">Status</h3>
            {statusBadge}
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">{actions}</div>
        </div>
        {(publishedAt ?? scheduledAt) && (
          <div className="flex flex-col gap-1">
            {scheduledAt && (
              <p className="text-base-content/70 text-sm">
                Scheduled for {scheduledAt.toLocaleString()}
              </p>
            )}
            {publishedAt && (
              <p className="text-base-content/70 text-sm">
                Last published {publishedAt.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
