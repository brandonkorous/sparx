'use client';

// Everything the diary's quick-look modal KNOWS and DOES, with no JSX in it:
// the six mutations, the pending new time, which moves this booking's state
// allows, and the two confirms. Split from calendar-booking-modal.tsx, which
// after this owns only what the modal LOOKS like (RULE #0.5).

import { useEffect, useState } from 'react';

import { useConfirm } from '../../lib/confirm';
import { cancelAsk, noShowAsk, type Ask } from './booking-endings-copy';
import { usePolicy } from './setup-data';
import { thisComputersTimezone } from '../../lib/business-timezone';
import {
  instantFromWall,
  wallClockHint,
  wallProblem,
  wallValue,
  type WallClockBox,
} from '../../lib/wall-clock';
import { isTerminalBooking, type Booking } from './bookings-data';
import {
  calendarErrorMessage,
  useCancel,
  useCheckIn,
  useComplete,
  useConfirm as useConfirmBooking,
  useNoShow,
  useReschedule,
} from './calendar-data';

/** The six things that can happen to a booking, in one shape so the flags, the
 *  in-flight map and the handlers below all key off the same six names. */
export interface Moves {
  confirm: boolean;
  checkIn: boolean;
  complete: boolean;
  noShow: boolean;
  cancel: boolean;
  reschedule: boolean;
}

/** Which moves this booking's state allows. Pure: the same answer the full pane
 *  reaches, kept out of the hook so neither grows past reading in one piece. */
export function movesFor(booking: Booking): Moves {
  const status = booking.status;
  return {
    confirm: status === 'requested' || status === 'waitlisted',
    checkIn: status === 'confirmed',
    complete: status === 'in_progress',
    noShow: status === 'confirmed' || status === 'in_progress',
    cancel: !isTerminalBooking(status),
    reschedule: status === 'requested' || status === 'confirmed',
  };
}

function useMutations(id: string) {
  return {
    confirm: useConfirmBooking(id),
    checkIn: useCheckIn(id),
    complete: useComplete(id),
    noShow: useNoShow(id),
    cancel: useCancel(id),
    reschedule: useReschedule(id),
  };
}

type Mutations = ReturnType<typeof useMutations>;

function busyOf(m: Mutations): Moves {
  return {
    confirm: m.confirm.isPending,
    checkIn: m.checkIn.isPending,
    complete: m.complete.isPending,
    noShow: m.noShow.isPending,
    cancel: m.cancel.isPending,
    reschedule: m.reschedule.isPending,
  };
}

export type Acts = Record<
  'confirm' | 'checkIn' | 'complete' | 'move' | 'noShow' | 'cancel',
  () => void
>;

function actsFor(
  m: Mutations,
  movedTo: string | null,
  ask: (q: Ask, run: () => void) => void,
  questions: { noShow: Ask; cancel: Ask }
): Acts {
  return {
    confirm: () => {
      m.confirm.mutate({});
    },
    checkIn: () => {
      m.checkIn.mutate({});
    },
    complete: () => {
      m.complete.mutate({});
    },
    move: () => {
      if (movedTo) m.reschedule.mutate({ startAt: movedTo });
    },
    noShow: () => {
      ask(questions.noShow, () => {
        m.noShow.mutate({});
      });
    },
    cancel: () => {
      ask(questions.cancel, () => {
        m.cancel.mutate({});
      });
    },
  };
}

export interface CalendarBookingState {
  when: string;
  setWhen: (value: string) => void;
  /** Whose clock the move box is on: the booking's own. */
  whenClock: WallClockBox;
  moves: Moves;
  busy: Moves;
  canMove: boolean;
  anyPending: boolean;
  actionError: string | null;
  act: Acts;
}

export function useCalendarBooking(booking: Booking): CalendarBookingState {
  const confirmDialog = useConfirm();
  // The booking's own rules, so the two confirms can say what happens to the
  // money rather than "any fee in your rules" (issue 112 — the pane learned this
  // and the modal did not).
  const policy = usePolicy(booking.policyId ?? 'new');
  const m = useMutations(booking.id);
  const all = Object.values(m);

  // The pending new time, on the booking's OWN clock, the one its block, its
  // header and the customer's emails use (sparx persona issue 086). Re-seeds from
  // the booking whenever its start moves, so after a successful reschedule the
  // field shows the time it now sits at.
  const zone = booking.timezone;
  const startWall = wallValue(booking.startAt, zone);
  const [when, setWhen] = useState(startWall);
  useEffect(() => {
    setWhen(startWall);
  }, [startWall]);

  const movedTo = instantFromWall(when, zone);
  // ONE message, the most specific one — the latest action that was refused,
  // named verbatim by the server (a clash, a closed hour).
  const failed = all.find((one) => one.isError);
  const ask = (question: Ask, run: () => void) => {
    void confirmDialog(question).then((ok) => {
      if (ok) run();
    });
  };

  return {
    when,
    setWhen,
    moves: movesFor(booking),
    busy: busyOf(m),
    whenClock: {
      zone,
      hint: wallClockHint(zone, thisComputersTimezone()),
      problem: wallProblem(when, zone),
    },
    // Compared as the box reads, so the second 1:30 AM of the night the clocks go
    // back does not count as a move just by being shown.
    canMove: movedTo !== null && when !== startWall && !m.reschedule.isPending,
    anyPending: all.some((one) => one.isPending),
    actionError: failed
      ? calendarErrorMessage(failed.error, 'That did not go through. Nothing was changed.')
      : null,
    act: actsFor(m, movedTo, ask, {
      noShow: noShowAsk(booking, policy.data),
      cancel: cancelAsk(booking, policy.data),
    }),
  };
}
