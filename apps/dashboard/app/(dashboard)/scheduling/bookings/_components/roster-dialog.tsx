'use client';

// Class session roster (docs/79 §7.2) — the attendee list for a class booking, with
// per-attendee check-in / cancel and a quick add-a-seat. Seats over capacity show
// as waitlisted and auto-promote when one frees.

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';
import { Check, UserPlus, X } from 'lucide-react';

import type { ClassAttendee } from '../../_lib/types';
import {
  addAttendeeAction,
  listSessionAttendeesAction,
  updateAttendeeAction,
} from '../../_lib/actions';

const STATUS_COLOR: Record<string, string> = {
  booked: 'success',
  checked_in: 'info',
  attended: 'neutral',
  waitlisted: 'warning',
  cancelled: 'danger',
  no_show: 'danger',
};

export function RosterDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [roster, setRoster] = useState<ClassAttendee[] | null>(null);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    void listSessionAttendeesAction(bookingId).then((r) => {
      if (r.ok) setRoster(r.data);
    });
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId]);

  async function add() {
    if (!guestName.trim()) return;
    setBusy(true);
    const result = await addAttendeeAction(bookingId, { guestName: guestName.trim() });
    setBusy(false);
    if (result.ok) {
      toast.success(result.data.waitlisted ? 'Added to the waitlist (session full)' : 'Added');
      setGuestName('');
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function setStatus(a: ClassAttendee, status: string) {
    setBusy(true);
    const result = await updateAttendeeAction(a.id, { status });
    setBusy(false);
    if (result.ok) refresh();
    else toast.error(result.error);
  }

  const active = (roster ?? []).filter((a) => !['cancelled', 'no_show'].includes(a.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div>
          <DialogTitle>Roster</DialogTitle>
        </div>
        <div className="flex flex-col gap-3 px-1 py-2">
          <div className="flex items-center gap-2">
            <Field className="flex-1">
              <FieldControl
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Add attendee by name"
                aria-label="Attendee name"
              />
            </Field>
            <Button
              type="button"
              color="module"
              onClick={() => void add()}
              loading={busy}
              disabled={!guestName.trim()}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {roster === null ? (
            <p className="text-base-content/70 text-xs">Loading…</p>
          ) : active.length === 0 ? (
            <p className="text-base-content/70 text-xs">No one&rsquo;s booked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((a) => (
                <li
                  key={a.id}
                  className="border-base-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="truncate text-sm font-medium">
                      {a.guestName ?? 'Customer'}
                      {a.partySize > 1 ? ` · ${a.partySize}` : ''}
                    </span>
                    <div>
                      <Badge variant="soft" color={STATUS_COLOR[a.status] ?? 'neutral'}>
                        {a.status}
                        {a.status === 'waitlisted' && a.waitlistPosition
                          ? ` #${a.waitlistPosition}`
                          : ''}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {a.status === 'booked' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void setStatus(a, 'checked_in')}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Check in
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      shape="square"
                      size="sm"
                      aria-label="Remove from roster"
                      className="text-danger"
                      disabled={busy}
                      onClick={() => void setStatus(a, 'cancelled')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
