'use client';

// The entry's status + publish actions (docs/51 §6). EditEntryForm owns ALL the
// state (status, the schedule machinery); this is purely presentational and gets
// PORTALED into whichever chrome hosts the current presentation:
//
//   · the live-preview workspace's builder-style toolbar (parity with the site
//     studio's toolbar — docs/builder/03 §2.8), or
//   · the shared detail chrome's header slot (drawer/modal, or the full-page
//     shell when there's no live-preview template) — parity with Product/Page.
//
// Same actions, same handlers, always the same compact horizontal cluster —
// only which DOM node it portals into changes (see EditEntryForm).

import * as React from 'react';
import Link from 'next/link';
import { statusLabel, statusTone, useConfirm } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { CalendarClock, History } from 'lucide-react';
import { PreviewButton } from '../../../[id]/preview-button';

export interface EntryStatusBarProps {
  status: string;
  /** A publish/schedule transition is in flight — disables the action buttons. */
  pending: boolean;
  /** Routable types get a Preview link; non-routable ones (no URL) don't. */
  routable: boolean;
  entryId: string;
  slug: string;
  typeKey: string;
  tenantSlug: string | null;
  onTogglePublish: () => void;
  /** Open the schedule-publish modal (owned by EditEntryForm). */
  onSchedule: () => void;
}

export function EntryStatusBar({
  status,
  pending,
  routable,
  entryId,
  slug,
  typeKey,
  tenantSlug,
  onTogglePublish,
  onSchedule,
}: EntryStatusBarProps) {
  const published = status === 'published';
  const confirm = useConfirm();

  // Publish is a forward action (draft → live); Unpublish takes a live entry
  // off the site immediately, so — unlike Publish — it's gated.
  function handleTogglePublish() {
    if (!published) {
      onTogglePublish();
      return;
    }
    void (async () => {
      const ok = await confirm({
        title: 'Unpublish this entry?',
        description:
          'It’ll come down from your site immediately. You can publish it again any time.',
        confirmLabel: 'Unpublish',
        tone: 'warning',
      });
      if (ok) onTogglePublish();
    })();
  }

  const statusBadge = (
    <Badge color={statusTone(status)} variant="soft">
      {statusLabel(status)}
    </Badge>
  );

  // Always the compact header/toolbar treatment now — secondary actions go
  // icon-only with tooltips so the cluster fits one row alongside Save.
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {statusBadge}
      {routable && (
        <PreviewButton
          iconOnly
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
        title="Revisions"
        render={<Link href={`/cms/${entryId}/revisions`} />}
      >
        <History className="h-3.5 w-3.5" />
      </Button>
      {!published && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Schedule publish"
          title="Schedule publish"
          onClick={onSchedule}
          disabled={pending}
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        type="button"
        color={published ? 'neutral' : 'module'}
        variant={published ? 'outline' : 'solid'}
        size="sm"
        onClick={handleTogglePublish}
        disabled={pending}
      >
        {published ? 'Unpublish' : 'Publish'}
      </Button>
    </div>
  );
}
