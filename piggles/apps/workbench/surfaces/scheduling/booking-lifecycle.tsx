'use client';

// Moving a booking forward — confirm, check in, complete. Its position and its
// moves, so it lives in the toolbar rather than among the fields.

import { Button, useToast } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faCheckCircle, faCheckDouble, faRightToBracket } from '@fortawesome/pro-solid-svg-icons';

import type { Booking } from './bookings-data';

interface Step {
  isPending: boolean;
  mutate: (input: undefined, opts: { onSuccess: () => void }) => void;
}

export function BookingLifecycle({
  booking,
  confirm,
  checkIn,
  complete,
  busy,
}: {
  booking: Booking;
  confirm: Step;
  checkIn: Step;
  complete: Step;
  busy: boolean;
}) {
  const toast = useToast();
  const run = (step: Step, title: string) => () => {
    step.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title, type: 'success' });
      },
    });
  };

  return (
    <>
      {booking.status === 'requested' ? (
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={confirm.isPending}
          disabled={busy}
          onClick={run(confirm, 'Booking confirmed')}
        >
          <Icon glyph={faCheckCircle} className="size-4" aria-hidden />
          Confirm
        </Button>
      ) : null}
      {booking.status === 'confirmed' ? (
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={checkIn.isPending}
          disabled={busy}
          onClick={run(checkIn, 'Checked in')}
        >
          <Icon glyph={faRightToBracket} className="size-4" aria-hidden />
          Check in
        </Button>
      ) : null}
      {booking.status === 'confirmed' || booking.status === 'in_progress' ? (
        <Button
          color="success"
          variant={booking.status === 'in_progress' ? 'solid' : 'outline'}
          size="sm"
          className={booking.status === 'in_progress' ? 'ml-auto' : undefined}
          loading={complete.isPending}
          disabled={busy}
          onClick={run(complete, 'Booking completed')}
        >
          <Icon glyph={faCheckDouble} className="size-4" aria-hidden />
          Complete
        </Button>
      ) : null}
    </>
  );
}
