'use client';

// WHO the appointment is for, on the appointment.
//
// The pane used to say "For A customer" in the line under the heading and stop
// there. The booking read now carries the person, named (issue 138), and the
// customer record carries how to reach them, which the API always returned and
// nothing ever asked for (issue 111). A phone number is what you need when a
// customer is ten minutes late, and it was four screens away: open the CRM, find
// them, open their record. An allergy or a "prefers the window seat" written on
// their record decides how the next hour goes, and that was further still.
//
// Three honest faces, because an absent answer that renders as nothing renders
// exactly like a correct one:
//   · a linked customer: their name, how to reach them, what you know about them
//   · a guest with no account: the name somebody wrote down, and nothing else
//   · nobody at all: said out loud, with what that costs

import { Button, Text } from '@wizeworks/silicaui-react';
import { ExternalLink, Mail, Phone } from 'lucide-react';

import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCustomerActivities } from '../crm/customer-activity-data';
import { bookedCustomerName, customerName, useCustomer, type Booking } from './bookings-data';

const NOTES_SHOWN = 3;

/** A guest with no account, the walk-in somebody wrote down. Nothing to link to
 *  and nothing on file, so the section says only what it knows. */
function GuestOnly({ name }: { name: string }) {
  return (
    <FormSection title="Who it is for" description="Booked without an account.">
      <Text className="text-base font-medium">{name}</Text>
    </FormSection>
  );
}

/** No account and no name. Says so, and says what it costs: a reminder needs
 *  somewhere to go. */
function NobodyNamed() {
  return (
    <FormSection title="Who it is for" description="Nobody is recorded on this booking.">
      <Text className="text-base">
        It was taken without an account and without a name, so no confirmation or reminder can reach
        anyone, and it will not show on anybody&apos;s record. You can write who it was in the
        private note below.
      </Text>
    </FormSection>
  );
}

/** How to reach them, as the things you press to do it. A number you have to
 *  copy into a phone by hand is a number nobody rings. */
function ContactButtons({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) {
    return <Text className="text-base">No phone number or email on their record.</Text>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <Button
          size="sm"
          variant="outline"
          color="module"
          // eslint-disable-next-line jsx-a11y/anchor-has-content -- content is the Button's children; the anchor is the render target, and the a11y rule can't see through Button's render prop.
          render={<a href={`tel:${phone}`} />}
        >
          <Phone className="size-4" aria-hidden />
          {phone}
        </Button>
      ) : null}
      {email ? (
        <Button
          size="sm"
          variant="outline"
          color="module"
          className="max-w-full"
          // eslint-disable-next-line jsx-a11y/anchor-has-content -- content is the Button's children; the anchor is the render target, and the a11y rule can't see through Button's render prop.
          render={<a href={`mailto:${email}`} />}
        >
          <Mail className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{email}</span>
        </Button>
      ) : null}
    </div>
  );
}

/** What the business has written down about this person. Newest first, a few of
 *  them; the rest are on their record, which the section's button opens. Silent
 *  when the notes cannot be read (the CRM app is off, or the read failed): the
 *  section is about the booking, and an error about a different app's data
 *  would be the loudest thing on it. */
function TheirNotes({ customerId }: { customerId: string }) {
  const activities = useCustomerActivities(customerId, 25);
  if (activities.isError) return null;
  if (activities.isPending) {
    return (
      <Text className="text-base" role="status">
        Looking up what you know about them…
      </Text>
    );
  }
  const notes = activities.data
    .filter((entry) => entry.type === 'note' && entry.description?.trim())
    .slice(0, NOTES_SHOWN);
  if (notes.length === 0) {
    return <Text className="text-base">Nothing written down about them yet.</Text>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="border-warning border-l-2 pl-3 text-base">
          {note.description}
        </li>
      ))}
    </ul>
  );
}

export function BookingWho({ ctx, booking }: { ctx: SurfaceContext; booking: Booking }) {
  const guestName = booking.attendees.find((a) => a.guestName?.trim())?.guestName?.trim() ?? null;
  // The CRM record adds the company and keeps the phone current after an edit
  // on their record; the booking's own `customer` is what names them when the
  // CRM app is off, since that read does not need it.
  const record = useCustomer(booking.customerId);

  if (!booking.customerId) return guestName ? <GuestOnly name={guestName} /> : <NobodyNamed />;

  const onFile = record.data;
  const name = onFile
    ? customerName(onFile)
    : booking.customer
      ? bookedCustomerName(booking.customer)
      : (guestName ?? 'A customer');
  const phone = onFile ? onFile.phone : (booking.customer?.phone ?? null);
  const email = onFile ? onFile.email : (booking.customer?.email ?? null);
  const customerId = booking.customerId;

  return (
    <FormSection
      title="Who it is for"
      description="How to reach them, and what you know about them."
      action={
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            ctx.open('crm.customer.detail', { id: customerId }, { target: 'beside' });
          }}
        >
          <ExternalLink className="size-4" aria-hidden />
          Open their record
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">
          {name}
          {onFile?.company?.trim() && onFile.company.trim() !== name ? (
            <span className="font-normal"> · {onFile.company.trim()}</span>
          ) : null}
        </Text>
        <ContactButtons phone={phone} email={email} />
      </div>
      <TheirNotes customerId={customerId} />
    </FormSection>
  );
}
