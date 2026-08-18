'use client';

// A history list, and what a row in one says.
//
// The TIME OF DAY is a row's identity. "3 hours ago" is how you describe one version
// in a sentence; it is not how you tell three of them apart, and three rows all
// reading "3 hours ago" is a list with no information in it. So rows show clock times
// under day headings.
//
// WHO or WHAT saved it is a colour, not a word. A person saving, an assistant saving
// and a restore are three different events; one grey badge on all three asserts they
// are the same thing.

import { Fragment } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import type { HistoryEntry } from '../../lib/studio/history-data';

/** What produced an entry, in words and in a colour that distinguishes it. */
function describe(source: string): {
  label: string;
  tone: 'info' | 'module-ai' | 'warning' | 'success';
} {
  if (source === 'agent') return { label: 'Assistant', tone: 'module-ai' };
  if (source === 'restore') return { label: 'Put back', tone: 'warning' };
  if (source === 'publish') return { label: 'Published', tone: 'success' };
  return { label: 'You saved', tone: 'info' };
}

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function HistoryRows({
  entries,
  action,
  onAction,
  pendingId,
  empty,
}: {
  entries: HistoryEntry[];
  /** The label on each row's button, or null for a read-only list. */
  action: string | null;
  onAction?: (entry: HistoryEntry) => void;
  pendingId?: string | null;
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className="text-base-content px-1 py-6 text-sm">{empty}</p>;
  }

  let lastDay = '';
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const day = DAY.format(new Date(entry.createdAt));
        const heading = day === lastDay ? null : day;
        lastDay = day;
        return (
          <Fragment key={entry.id}>
            {heading ? (
              <li className="text-base-content px-1 pt-3 text-sm font-medium">{heading}</li>
            ) : null}
            <Row
              entry={entry}
              action={action}
              onAction={onAction}
              pending={pendingId === entry.id}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}

function Row({
  entry,
  action,
  onAction,
  pending,
}: {
  entry: HistoryEntry;
  action: string | null;
  onAction?: (entry: HistoryEntry) => void;
  pending: boolean;
}) {
  const { label, tone } = describe(entry.source);
  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span className="text-base-content w-14 shrink-0 text-sm">
        {CLOCK.format(new Date(entry.createdAt))}
      </span>
      <Badge color={tone} variant="soft">
        {label}
      </Badge>
      <span className="ml-auto shrink-0">
        {entry.current ? (
          <span className="text-base-content text-sm">This is what you have now</span>
        ) : action && onAction ? (
          <Button size="sm" color="primary" disabled={pending} onClick={() => onAction(entry)}>
            {pending ? 'Putting back…' : action}
          </Button>
        ) : null}
      </span>
    </li>
  );
}
