'use client';

// Everything the booking pane knows and can do, in one place.
//
// Split out of booking-manage.tsx when that file grew a "what reaches them"
// section: the pane was carrying eight mutations, four pieces of local state and
// three handlers alongside its markup, and the markup is the part somebody reads
// when they want to change how the screen looks.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { usePolicy } from './setup-data';
import {
  customerName,
  fromLocalInputValue,
  isTerminalBooking,
  schedulingErrorMessage,
  toLocalInputValue,
  useCancelBooking,
  useCheckInBooking,
  useCompleteBooking,
  useConfirmBooking,
  useCustomer,
  useNoShowBooking,
  useRescheduleBooking,
  useUpdateBooking,
  type Booking,
} from './bookings-data';

export function useBookingManage(ctx: SurfaceContext, booking: Booking) {
  const toast = useToast();
  const id = booking.id;

  const update = useUpdateBooking(id);
  const confirm = useConfirmBooking(id);
  const checkIn = useCheckInBooking(id);
  const complete = useCompleteBooking(id);
  const noShow = useNoShowBooking(id);
  const cancel = useCancelBooking(id);
  const reschedule = useRescheduleBooking(id);

  const bookedCustomer = useCustomer(booking.customerId);
  // The money rules THIS booking was taken under, so the screen can say what
  // happens rather than "any fee in your rules" (issue 112).
  const policy = usePolicy(booking.policyId ?? 'new');

  const [notes, setNotes] = useState(booking.notes ?? '');
  const [staffNotes, setStaffNotes] = useState(booking.staffNotes ?? '');
  const [rescheduleLocal, setRescheduleLocal] = useState(toLocalInputValue(booking.startAt));

  useEffect(() => {
    ctx.setTitle(booking.service.name || 'Booking');
  }, [ctx, booking.service.name]);

  const notesChanged = notes !== (booking.notes ?? '') || staffNotes !== (booking.staffNotes ?? '');
  useDirtySource(notesChanged, 'This booking has unsaved notes. Close anyway?');

  const rescheduleIso = fromLocalInputValue(rescheduleLocal);
  const rescheduleMoved = rescheduleIso !== null && rescheduleIso !== booking.startAt;

  // ONE message, the most specific one — the latest action that failed.
  const actionError = useMemo(() => {
    const failed = [confirm, checkIn, complete, noShow, cancel, reschedule].find((m) => m.isError);
    if (!failed) return null;
    return schedulingErrorMessage(failed.error, 'That did not go through. Nothing was changed.');
  }, [confirm, checkIn, complete, noShow, cancel, reschedule]);

  const guestName = booking.attendees.find((a) => a.guestName?.trim())?.guestName ?? null;
  const who = guestName ?? (booking.customerId ? customerName(bookedCustomer.data) : null);

  const saveNotes = (): void => {
    if (!notesChanged) return;
    update.mutate(
      {
        notes: notes.trim() ? notes.trim() : null,
        staffNotes: staffNotes.trim() ? staffNotes.trim() : null,
      },
      {
        onSuccess: () => {
          toast.add({ title: 'Notes saved', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save the notes',
            description: schedulingErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  /** A one-line success note. Exposed instead of the toast manager itself, whose
   *  inferred type reaches into a transitive dependency and cannot be named here. */
  const notifyDone = (title: string): void => {
    toast.add({ title, type: 'success' });
  };

  const doReschedule = (): void => {
    if (!rescheduleIso || !rescheduleMoved) return;
    reschedule.mutate(
      { startAt: rescheduleIso, resourceIds: [], notifyCustomer: true },
      {
        onSuccess: () => {
          toast.add({ title: 'Booking moved', type: 'success' });
        },
      }
    );
  };

  return {
    id,
    notifyDone,
    update,
    confirm,
    checkIn,
    complete,
    noShow,
    cancel,
    reschedule,
    bookedCustomer,
    policy,
    notes,
    setNotes,
    staffNotes,
    setStaffNotes,
    notesChanged,
    rescheduleLocal,
    setRescheduleLocal,
    rescheduleMoved,
    actionError,
    guestName,
    who,
    saveNotes,
    doReschedule,
    terminal: isTerminalBooking(booking.status),
    lifecycleBusy:
      confirm.isPending || checkIn.isPending || complete.isPending || reschedule.isPending,
  };
}
