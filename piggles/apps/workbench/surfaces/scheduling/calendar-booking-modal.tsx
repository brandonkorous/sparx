'use client';

// ONE BOOKING, opened from the diary: a quick-look MODAL, not a pane, because the
// point is to glance at a booking WITHOUT losing sight of the week behind it. It
// holds no draft: every move is a direct mutation or a named confirm.

// Same shape as the full booking pane (bookings-detail.tsx): header, grouped
// sections, then actions in four fixed roles. Parts, actions, state and the confirm
// wording (booking-endings-copy, issue 142) each live in their own sibling file.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowUpRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneScope } from '../../lib/dock/window-boundary';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { BookingTimeline } from './booking-timeline';
import { useBooking, type Booking } from './bookings-data';
import { useCalendarBooking } from './calendar-booking-state';
import { EndingsRow, LifecycleRow, MoveSection } from './calendar-booking-actions';
import { ModalHeader, Section } from './calendar-booking-parts';
import { SaveFailure } from '@/components/save-failure';
import { PaneLoadError } from '../../components/pane-load-error';

interface CalendarBookingModalProps {
  // The booking to show, or null when nothing is selected (modal closed).
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: SurfaceContext;
}

export function CalendarBookingModal({
  bookingId,
  open,
  onOpenChange,
  ctx,
}: CalendarBookingModalProps) {
  return (
    // PaneScope confines the backdrop to the calendar pane, so in a multi-pane
    // layout opening a booking dims THIS diary, not the whole app.
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          {bookingId ? (
            <ModalBody bookingId={bookingId} ctx={ctx} onClose={() => onOpenChange(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

function ModalBody({
  bookingId,
  ctx,
  onClose,
}: {
  bookingId: string;
  ctx: SurfaceContext;
  onClose: () => void;
}) {
  const { data: booking, isPending, isError, error, refetch } = useBooking(bookingId);

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <DialogTitle className="text-xl font-semibold">Booking</DialogTitle>
        <PaneLoadError
          title="Could not load this booking"
          description="This is a problem reaching the server, or the booking no longer exists. Your diary is unaffected."
          error={error}
          noun="booking"
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  if (isPending || !booking) {
    return (
      <div className="flex flex-col gap-4">
        <DialogTitle className="text-xl font-semibold">Booking</DialogTitle>
        <Text className="text-base" role="status">
          Loading…
        </Text>
      </div>
    );
  }

  return <LoadedModal booking={booking} ctx={ctx} onClose={onClose} />;
}

function LoadedModal({
  booking,
  ctx,
  onClose,
}: {
  booking: Booking;
  ctx: SurfaceContext;
  onClose: () => void;
}) {
  const openFullBooking = () => {
    // The deep, durable place: close the quick-look and hand off to its own pane.
    onClose();
    ctx.open('scheduling.bookings.detail', { id: booking.id });
  };

  return (
    <>
      <ModalHeader booking={booking} />
      <LoadedModalSections booking={booking} />
      <DialogFooter>
        {/* The dismiss half, COLORLESS: a bare `.btn` is theme-correct without naming
            `neutral`, which is not mine to choose (root RULE #4). */}
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
        <Button color="module" variant="soft" size="sm" onClick={openFullBooking}>
          <Icon glyph={faArrowUpRight} className="size-4" aria-hidden />
          Open full booking
        </Button>
      </DialogFooter>
    </>
  );
}

function LoadedModalSections({ booking }: { booking: Booking }) {
  const state = useCalendarBooking(booking);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
      <SaveFailure title="That did not go through" message={state.actionError} />

      {booking.status === 'cancelled' && booking.cancellationReason ? (
        <Alert color="error">
          <AlertContent>
            <AlertTitle>Canceled</AlertTitle>
            <AlertDescription>{booking.cancellationReason}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <LifecycleRow
        moves={state.moves}
        busy={state.busy}
        anyPending={state.anyPending}
        act={state.act}
      />

      {state.moves.reschedule ? (
        <MoveSection
          when={state.when}
          clock={state.whenClock}
          setWhen={state.setWhen}
          canMove={state.canMove}
          busy={state.busy.reschedule}
          onMove={state.act.move}
        />
      ) : null}

      {/* Change history: the old versions the booking row no longer keeps. */}
      <Section title="Change history">
        <BookingTimeline bookingId={booking.id} timezone={booking.timezone} />
      </Section>

      <EndingsRow
        moves={state.moves}
        busy={state.busy}
        anyPending={state.anyPending}
        act={state.act}
      />
    </div>
  );
}

export default CalendarBookingModal;
