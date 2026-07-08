'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { Ban, Check, CheckCheck, LogIn, MoreHorizontal, Users, UserX } from 'lucide-react';

import type { ActionResult } from '../../_lib/actions';
import {
  cancelBookingAction,
  checkInBookingAction,
  completeBookingAction,
  confirmBookingAction,
  noShowBookingAction,
} from '../../_lib/actions';
import type { BookingStatus, BookingType } from '../../_lib/types';
import { RosterDialog } from './roster-dialog';

const TERMINAL: BookingStatus[] = ['completed', 'cancelled', 'no_show'];

export function BookingActions({
  id,
  status,
  bookingType,
}: {
  id: string;
  status: BookingStatus;
  bookingType?: BookingType;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  // A class session always exposes its roster (even when terminal — to review who
  // attended); other booking types hide actions once terminal.
  const isClass = bookingType === 'class';
  if (TERMINAL.includes(status) && !isClass) {
    return null;
  }

  async function run(fn: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (result.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: 'Cancel this booking?',
      description: 'The slot is released immediately and becomes bookable again.',
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (ok) await run(() => cancelBookingAction(id), 'Booking cancelled');
  }

  async function noShow() {
    const ok = await confirm({
      title: 'Mark as no-show?',
      description: 'Releases the slot and records a no-show (a fee may apply per policy).',
      confirmLabel: 'Mark no-show',
      tone: 'warning',
    });
    if (ok) await run(() => noShowBookingAction(id), 'Marked as no-show');
  }

  const terminal = TERMINAL.includes(status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            shape="square"
            size="sm"
            aria-label="Booking actions"
            disabled={busy}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isClass ? (
            <DropdownMenuItem onClick={() => setRosterOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Roster
            </DropdownMenuItem>
          ) : null}
          {isClass && !terminal ? <DropdownMenuSeparator /> : null}
          {!terminal ? renderLifecycle() : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {isClass ? (
        <RosterDialog bookingId={id} open={rosterOpen} onOpenChange={setRosterOpen} />
      ) : null}
    </>
  );

  function renderLifecycle() {
    return (
      <>
        {status === 'requested' ? (
          <DropdownMenuItem
            onClick={() => void run(() => confirmBookingAction(id), 'Booking confirmed')}
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm
          </DropdownMenuItem>
        ) : null}
        {status === 'confirmed' || status === 'requested' ? (
          <DropdownMenuItem onClick={() => void run(() => checkInBookingAction(id), 'Checked in')}>
            <LogIn className="mr-2 h-4 w-4" />
            Check in
          </DropdownMenuItem>
        ) : null}
        {status === 'in_progress' || status === 'confirmed' ? (
          <DropdownMenuItem
            onClick={() => void run(() => completeBookingAction(id), 'Booking completed')}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Complete
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void noShow()}>
          <UserX className="mr-2 h-4 w-4" />
          No-show
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void cancel()} className="text-[var(--color-danger)]">
          <Ban className="mr-2 h-4 w-4" />
          Cancel
        </DropdownMenuItem>
      </>
    );
  }
}
