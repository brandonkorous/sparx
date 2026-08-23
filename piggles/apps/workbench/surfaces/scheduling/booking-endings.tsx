'use client';

// The outcomes nobody wants — a no-show and a cancellation. Rare and hard to
// undo, so they sit under a divider after the work rather than competing with
// Save. Each says WHAT HAPPENS TO THE MONEY for this booking before she commits,
// rather than "any fee in your rules" (issue 112).

import { Button, Text } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faCalendarXmark, faUserXmark } from '@fortawesome/pro-solid-svg-icons';

import { useConfirm } from '../../lib/confirm';
import { cancelMoney, noShowMoney } from './booking-money';
import type { BookingPolicy } from './setup-data';
import { formatWhen, type Booking } from './bookings-data';

interface Action {
  isPending: boolean;
  mutate: (input: never, opts?: { onSuccess: () => void }) => void;
}

export function BookingEndings({
  booking,
  policy,
  noShow,
  cancel,
  onDone,
}: {
  booking: Booking;
  policy: BookingPolicy | undefined;
  noShow: Action;
  cancel: Action;
  onDone: (title: string) => void;
}) {
  const confirmDialog = useConfirm();
  const when = formatWhen(booking.startAt, booking.timezone);

  const onNoShow = async () => {
    const ok = await confirmDialog({
      title: 'Mark as a no-show?',
      description: `This records that the customer did not turn up for the ${when} booking and frees the slot. ${noShowMoney(booking, policy)}`,
      confirmLabel: 'They did not turn up',
      cancelLabel: 'Back',
      color: 'danger',
    });
    if (!ok) return;
    noShow.mutate({ waiveFee: false } as never, {
      onSuccess: () => {
        onDone('Marked as a no-show');
      },
    });
  };

  const onCancel = async () => {
    const ok = await confirmDialog({
      title: `Cancel ${booking.service.name}?`,
      description: `This releases the ${when} slot so someone else can take it, and lets the customer know. ${cancelMoney(booking, policy)} This cannot be undone.`,
      confirmLabel: 'Cancel this booking',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate({ reason: null, waiveFee: false, notifyCustomer: true } as never, {
      onSuccess: () => {
        onDone('Booking cancelled');
      },
    });
  };

  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      {booking.status === 'requested' || booking.status === 'confirmed' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="text-sm">
            They did not turn up. This frees the slot. {noShowMoney(booking, policy)}
          </Text>
          <Button
            size="sm"
            variant="outline"
            color="danger"
            disabled={noShow.isPending}
            onClick={() => {
              void onNoShow();
            }}
          >
            <Icon glyph={faUserXmark} className="size-4" aria-hidden />
            Mark no-show
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          Cancelling releases the slot and lets the customer know. It cannot be undone.
        </Text>
        <Button
          size="sm"
          variant="outline"
          color="danger"
          disabled={cancel.isPending}
          onClick={() => {
            void onCancel();
          }}
        >
          <Icon glyph={faCalendarXmark} className="size-4" aria-hidden />
          Cancel booking
        </Button>
      </div>
    </div>
  );
}
