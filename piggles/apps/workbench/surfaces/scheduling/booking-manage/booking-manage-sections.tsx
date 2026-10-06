'use client';

import { Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../../components/form-section';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import type { useBookingManage } from '../booking-manage-state';
import { BookingNotices } from '../booking-notices';
import { BookingTimeline } from '../booking-timeline';
import { BookingServiceRecord } from '../booking-service-record';
import { BookingMove, BookingNotes } from '../booking-editing';
import { depositLine } from '../booking-money';
import { BookingMoneyLine } from '../booking-money-line';
import { BookingWho } from '../booking-who';
import { BookingEndings } from '../booking-endings';
import { bookingResourceLabel, bookingTypeLabel, formatWhen, type Booking } from '../bookings-data';

/** Everything `useBookingManage` hands the pane. */
export type BookingManageState = ReturnType<typeof useBookingManage>;

/** When it is, who it is with and for, and where the money stands. */
export function BookingSummary({
  booking,
  who,
  policy,
}: {
  booking: Booking;
  who: BookingManageState['who'];
  policy: BookingManageState['policy'];
}) {
  return (
    <div className="flex flex-col gap-1">
      <Text className="text-base">
        {bookingTypeLabel(booking.bookingType)} · {formatWhen(booking.startAt, booking.timezone)}
      </Text>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span>With {bookingResourceLabel(booking)}</span>
        {who ? (
          <>
            <span aria-hidden>·</span>
            <span>For {who}</span>
          </>
        ) : null}
      </div>
      <BookingMoneyLine money={depositLine(booking, policy.data)} />
    </div>
  );
}

/** Who the booking is for, and moving it to another time while it is still live. */
export function BookingWhoAndMove({
  ctx,
  booking,
  state,
}: {
  ctx: SurfaceContext;
  booking: Booking;
  state: BookingManageState;
}) {
  const { bookedCustomer, guestName, terminal, reschedule, doReschedule } = state;
  const { rescheduleLocal, setRescheduleLocal, rescheduleClock, rescheduleMoved } = state;
  return (
    <>
      <BookingWho
        ctx={ctx}
        customerId={booking.customerId}
        customer={bookedCustomer.data}
        guestName={guestName}
      />

      {!terminal ? (
        <BookingMove
          rescheduleLocal={rescheduleLocal}
          setRescheduleLocal={setRescheduleLocal}
          clock={rescheduleClock}
          moved={rescheduleMoved}
          isPending={reschedule.isPending}
          onMove={doReschedule}
        />
      ) : null}
    </>
  );
}

/** The two notes, then the vehicle and parts of a trade visit. */
export function BookingNotesAndRecord({
  ctx,
  booking,
  state,
}: {
  ctx: SurfaceContext;
  booking: Booking;
  state: BookingManageState;
}) {
  const { notes, setNotes, staffNotes, setStaffNotes, notesChanged, update, saveNotes } = state;
  return (
    <>
      <BookingNotes
        notes={notes}
        setNotes={setNotes}
        staffNotes={staffNotes}
        setStaffNotes={setStaffNotes}
        changed={notesChanged}
        isPending={update.isPending}
        onSave={saveNotes}
      />

      {/* The vehicle and the parts, for a trade account's visit (sparx persona issue 086). */}
      <BookingServiceRecord ctx={ctx} booking={booking} />
    </>
  );
}

/** What the customer has been told, then what has happened. */
export function BookingRecordSections({
  id,
  booking,
  terminal,
}: {
  id: string;
  booking: Booking;
  terminal: boolean;
}) {
  // Whether anything CAN be sent is a question about an ACCOUNT, not a person: the
  // engine reaches nobody on a booking with no `customerId`. A name is not an address.
  const reachable = Boolean(booking.customerId);

  return (
    <>
      {/* What the CUSTOMER has been told, as opposed to what happened. It sits
          above the history because "will they be reminded" is a question about
          tomorrow, and the history is a question about yesterday. */}
      {/* "This customer" is only true when there is one: without an account the
          copy reads as a delivery failure rather than nobody to deliver to. */}
      <FormSection
        title="What reaches them"
        description={
          reachable
            ? 'Everything this customer is told about their booking, sent and still to come.'
            : 'Nobody on this booking has an account, so there is no address to send a confirmation or a reminder to.'
        }
      >
        <BookingNotices
          bookingId={id}
          timezone={booking.timezone}
          reachable={reachable}
          stillAhead={!terminal && new Date(booking.startAt).getTime() > Date.now()}
        />
      </FormSection>

      {/* The change history — what has happened to this booking, and the old
          values its own row no longer keeps. Read-only, newest first. */}
      <FormSection
        title="History"
        description="Everything that has happened to this booking, most recent first."
      >
        <BookingTimeline bookingId={id} timezone={booking.timezone} />
      </FormSection>
    </>
  );
}

/** The two ways a live booking can end badly, under a divider. */
export function BookingEndingsFor({
  booking,
  state,
}: {
  booking: Booking;
  state: BookingManageState;
}) {
  const { policy, noShow, cancel, notifyDone } = state;
  return (
    <BookingEndings
      booking={booking}
      policy={policy.data}
      noShow={noShow}
      cancel={cancel}
      onDone={notifyDone}
    />
  );
}
