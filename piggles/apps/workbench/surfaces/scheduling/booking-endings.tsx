'use client';

// The outcomes nobody wants — a no-show and a cancellation. Rare and hard to
// undo, so they sit under a divider after the work rather than competing with
// Save.
//
// The two questions themselves live in booking-endings-copy.ts, shared with the
// diary's quick-look modal: each says WHAT HAPPENS TO THE MONEY (issue 112),
// each NAMES THE PERSON (issue 142), and neither can drift from the other.

import { Button, Text } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faCalendarXmark, faUserXmark } from '@fortawesome/pro-solid-svg-icons';

import { useConfirm } from '../../lib/confirm';
import { noShowMoney } from './booking-money';
import { cancelAsk, cancelReach, noShowAsk } from './booking-endings-copy';
import type { BookingPolicy } from './setup-data';
import type { Booking } from './bookings-data';

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

  const onNoShow = async () => {
    if (!(await confirmDialog(noShowAsk(booking, policy)))) return;
    noShow.mutate({ waiveFee: false } as never, {
      onSuccess: () => {
        onDone('Marked as a no-show');
      },
    });
  };

  const onCancel = async () => {
    if (!(await confirmDialog(cancelAsk(booking, policy)))) return;
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
        {/* The standing sentence takes the same branches as the dialog, so the
            screen never promises a message the dialog then withdraws. */}
        <Text className="text-sm">
          Cancelling frees the slot. {cancelReach(booking)} It cannot be undone.
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
