'use client';

// Lifecycle + reschedule actions for a booking detail. Teleported into the
// surface frame's header via DetailHeaderSlot (docs/86 §5.1) so the same body
// drives the drawer, modal, and full-page chrome — the status badge and the
// next-step actions ride the frame header, never an in-body "Status" card.
// Reuses the same server actions as the list's quick menu; adds the reschedule
// flow (pick a new open slot) the list never exposed.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import {
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  LogIn,
  MoreHorizontal,
  Users,
  UserX,
} from 'lucide-react';

import { DetailHeaderSlot } from '../../../../_components/detail-header-slot';
import type { ActionResult } from '../../../_lib/actions';
import {
  cancelBookingAction,
  checkInBookingAction,
  completeBookingAction,
  confirmBookingAction,
  noShowBookingAction,
} from '../../../_lib/actions';
import type { BookingStatus, BookingType } from '../../../_lib/types';
import { statusColor, STATUS_LABEL } from '../../../_lib/format';
import { RosterDialog } from '../../_components/roster-dialog';
import { RescheduleModal } from './reschedule-modal';

const TERMINAL: BookingStatus[] = ['completed', 'cancelled', 'no_show'];

export function BookingDetailActions({
  id,
  status,
  bookingType,
  serviceId,
  startAt,
}: {
  id: string;
  status: BookingStatus;
  bookingType: BookingType;
  serviceId: string;
  startAt: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const isClass = bookingType === 'class';
  const terminal = TERMINAL.includes(status);

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
      description:
        'The slot is released immediately and becomes bookable again. If this is within the cancellation window, a fee may apply per policy.',
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
    <>
      <DetailHeaderSlot>
        <Badge color={statusColor(status)} variant="soft">
          {STATUS_LABEL[status] ?? status}
        </Badge>

        {status === 'requested' ? (
          <Button
            size="sm"
            color="module"
            disabled={busy}
            iconStart={<Check className="h-4 w-4" />}
            onClick={() => void run(() => confirmBookingAction(id), 'Booking confirmed')}
          >
            Confirm
          </Button>
        ) : null}
        {status === 'confirmed' || status === 'requested' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            iconStart={<LogIn className="h-4 w-4" />}
            onClick={() => void run(() => checkInBookingAction(id), 'Checked in')}
          >
            Check in
          </Button>
        ) : null}
        {status === 'in_progress' || status === 'confirmed' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            iconStart={<CheckCheck className="h-4 w-4" />}
            onClick={() => void run(() => completeBookingAction(id), 'Booking completed')}
          >
            Complete
          </Button>
        ) : null}
        {!terminal ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            iconStart={<CalendarClock className="h-4 w-4" />}
            onClick={() => setRescheduleOpen(true)}
          >
            Reschedule
          </Button>
        ) : null}

        {(!terminal || isClass) && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                shape="square"
                size="sm"
                aria-label="More actions"
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
              {!terminal ? (
                <>
                  <DropdownMenuItem onClick={() => void noShow()}>
                    <UserX className="mr-2 h-4 w-4" />
                    No-show
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void cancel()} className="text-danger">
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </DetailHeaderSlot>

      <RescheduleModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        id={id}
        serviceId={serviceId}
        startAt={startAt}
        onDone={() => router.refresh()}
      />
      {isClass ? (
        <RosterDialog bookingId={id} open={rosterOpen} onOpenChange={setRosterOpen} />
      ) : null}
    </>
  );
}
