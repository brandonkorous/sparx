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
  toast,
  useConfirm,
} from '@sparx/ui';
import { Ban, Check, CheckCheck, LogIn, MoreHorizontal, UserX } from 'lucide-react';

import type { ActionResult } from '../../_lib/actions';
import {
  cancelBookingAction,
  checkInBookingAction,
  completeBookingAction,
  confirmBookingAction,
  noShowBookingAction,
} from '../../_lib/actions';
import type { BookingStatus } from '../../_lib/types';

const TERMINAL: BookingStatus[] = ['completed', 'cancelled', 'no_show'];

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  if (TERMINAL.includes(status)) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
        {status === 'requested' ? (
          <DropdownMenuItem
            onSelect={() => void run(() => confirmBookingAction(id), 'Booking confirmed')}
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm
          </DropdownMenuItem>
        ) : null}
        {status === 'confirmed' || status === 'requested' ? (
          <DropdownMenuItem onSelect={() => void run(() => checkInBookingAction(id), 'Checked in')}>
            <LogIn className="mr-2 h-4 w-4" />
            Check in
          </DropdownMenuItem>
        ) : null}
        {status === 'in_progress' || status === 'confirmed' ? (
          <DropdownMenuItem
            onSelect={() => void run(() => completeBookingAction(id), 'Booking completed')}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Complete
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void noShow()}>
          <UserX className="mr-2 h-4 w-4" />
          No-show
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void cancel()} className="text-[var(--color-danger)]">
          <Ban className="mr-2 h-4 w-4" />
          Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
