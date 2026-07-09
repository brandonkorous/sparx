'use client';

// Inbound calendar connections for a resource (docs/79 §8.2, Layer 2). Paste a
// read-only iCal feed URL (the staff member's "secret address" from Google/Outlook/
// Apple) and their outside commitments import as external_busy_blocks, blocking
// sparx slots. Low-fidelity by design — clearly labeled stale; sparx remains the
// source of truth (the DB no-overlap constraint, §8.4).

import { useEffect, useState } from 'react';
import { Badge, Button, Field, FieldControl } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { RefreshCw, Trash2 } from 'lucide-react';

import type { CalendarConnection } from '../../_lib/types';
import {
  createIcalFeedAction,
  deleteCalendarConnectionAction,
  listCalendarConnectionsAction,
  syncCalendarConnectionAction,
} from '../../_lib/actions';
import { CaldavConnectForm } from './caldav-connect-form';
import { OAuthConnectForm } from './oauth-connect-form';

/** A human label for a connection row across kinds (iCal feed vs CalDAV account). */
function connLabel(c: CalendarConnection): string {
  if (c.connectionKind === 'caldav') {
    return c.provider === 'apple_caldav' ? 'Apple iCloud' : 'CalDAV account';
  }
  return `${c.provider} feed`;
}

function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function CalendarConnectionsSection({ resourceId }: { resourceId: string }) {
  const confirm = useConfirm();
  const [connections, setConnections] = useState<CalendarConnection[] | null>(null);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    void listCalendarConnectionsAction(resourceId).then((r) => {
      if (r.ok) setConnections(r.data.filter((c) => c.direction !== 'out'));
    });
  }

  useEffect(refresh, [resourceId]);

  async function add() {
    if (!url.trim()) return;
    setAdding(true);
    const result = await createIcalFeedAction({ resourceId, icalUrl: url.trim() });
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.sync && !result.data.sync.ok) {
      toast.error(result.data.sync.error ?? 'Added, but the first sync failed.');
    } else {
      toast.success('Calendar connected');
    }
    setUrl('');
    refresh();
  }

  async function sync(id: string) {
    setBusyId(id);
    const result = await syncCalendarConnectionAction(id);
    setBusyId(null);
    if (result.ok) {
      toast.success('Synced');
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function remove(c: CalendarConnection) {
    const okToDelete = await confirm({
      title: 'Remove this calendar?',
      description: 'Its imported busy times stop blocking sparx slots immediately.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!okToDelete) return;
    setBusyId(c.id);
    const result = await deleteCalendarConnectionAction(c.id);
    setBusyId(null);
    if (result.ok) {
      toast.success('Calendar removed');
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <OAuthConnectForm resourceId={resourceId} />

      <hr className="border-base-300" />

      <div>
        <p className="text-sm font-medium">Block times from a calendar link</p>
        <p className="text-base-content/70 text-xs">
          Paste a read-only iCal/ICS link (Google/Outlook/Apple &ldquo;secret address&rdquo;).
          Events there will block this resource&rsquo;s sparx availability. Imports refresh
          periodically and can lag a few hours.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Field className="flex-1">
          <FieldControl
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/…/basic.ics"
            aria-label="iCal feed URL"
          />
        </Field>
        <Button
          type="button"
          color="module"
          onClick={() => void add()}
          loading={adding}
          disabled={!url.trim()}
        >
          Add
        </Button>
      </div>

      <hr className="border-base-300" />

      <CaldavConnectForm resourceId={resourceId} onConnected={refresh} />

      {connections === null ? (
        <p className="text-base-content/70 text-xs">Loading…</p>
      ) : connections.length === 0 ? (
        <p className="text-base-content/70 text-xs">No calendars connected yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {connections.map((c) => (
            <li
              key={c.id}
              className="border-base-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium capitalize">{connLabel(c)}</span>
                  <Badge
                    variant="soft"
                    color={
                      c.status === 'active'
                        ? 'success'
                        : c.status === 'error'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="text-base-content/70 text-xs">
                  Synced {relTime(c.lastSyncedAt)}
                  {c.lastError ? ` · ${c.lastError}` : ''}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  shape="square"
                  size="sm"
                  aria-label="Sync now"
                  disabled={busyId === c.id}
                  onClick={() => void sync(c.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  shape="square"
                  size="sm"
                  aria-label="Remove"
                  className="text-danger"
                  disabled={busyId === c.id}
                  onClick={() => void remove(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
