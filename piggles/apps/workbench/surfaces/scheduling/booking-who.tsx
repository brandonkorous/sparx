'use client';

// WHO the appointment is for, on the appointment.
//
// The pane already fetched this person and used them for a name (issue 111). An
// allergy, a phone number and "third visit" are what decide how the next hour
// goes, and they were four screens away.

import { Button, Text } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faArrowUpRightFromSquare } from '@fortawesome/pro-solid-svg-icons';

import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCustomerActivities } from '../crm/customer-activity-data';
import { customerName, type CustomerLite } from './bookings-data';

const NOTES_SHOWN = 3;

/** A guest with no account — the walk-in somebody wrote down. Nothing to link to
 *  and nothing on file, so the block says only what it knows. */
function GuestOnly({ name }: { name: string }) {
  return (
    <FormSection title="Who it is for" description="Booked without an account.">
      <Text className="text-base font-medium">{name}</Text>
    </FormSection>
  );
}

function ContactLine({ customer }: { customer: CustomerLite }) {
  const bits = [customer.phone, customer.email].filter(Boolean) as string[];
  if (bits.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : null}
      {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : null}
    </div>
  );
}

/** What the salon has written down about this person. Newest first, a few of
 *  them — the rest are on their record, which the heading opens. */
function TheirNotes({ customerId }: { customerId: string }) {
  const activities = useCustomerActivities(customerId, 25);
  const notes = (activities.data ?? [])
    .filter((entry) => entry.type === 'note' && entry.description?.trim())
    .slice(0, NOTES_SHOWN);

  if (activities.isLoading) {
    return (
      <Text className="text-sm" role="status">
        Looking up what you know about them…
      </Text>
    );
  }
  if (notes.length === 0) {
    return <Text className="text-sm">Nothing written down about them yet.</Text>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="border-warning border-l-2 pl-3 text-sm">
          {note.description}
        </li>
      ))}
    </ul>
  );
}

export function BookingWho({
  ctx,
  customerId,
  customer,
  guestName,
}: {
  ctx: SurfaceContext;
  customerId: string | null;
  customer: CustomerLite | undefined;
  guestName: string | null;
}) {
  if (!customerId) {
    return guestName ? <GuestOnly name={guestName} /> : null;
  }
  const name = customer ? customerName(customer) : (guestName ?? 'This customer');
  return (
    <FormSection
      title="Who it is for"
      description="What you know about them, where you are about to serve them."
      action={
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            ctx.open('crm.customer.detail', { id: customerId });
          }}
        >
          <Icon glyph={faArrowUpRightFromSquare} className="size-4" aria-hidden />
          Open their record
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        <Text className="text-base font-medium">{name}</Text>
        {customer ? <ContactLine customer={customer} /> : null}
      </div>
      <TheirNotes customerId={customerId} />
    </FormSection>
  );
}
