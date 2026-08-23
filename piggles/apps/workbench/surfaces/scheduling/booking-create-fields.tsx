'use client';

// The form half of taking a booking — what, when, who it is for, and a note.
// Split out of `bookings-detail.tsx` so each file holds one job (RULE #0.5).

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CustomerPicker } from './bookings-customer-picker';
import { BookingResourcePicker } from './booking-resource-picker';
import {
  bookingTypeLabel,
  formatMoney,
  type CustomerLite,
  type ResourceLite,
  type ServiceLite,
} from './bookings-data';

/** Everything the form edits. Owned by the pane, so its toolbar can tell whether
 *  the booking can be taken yet. */
export interface BookingDraft {
  serviceId: string;
  setServiceId: (value: string) => void;
  startLocal: string;
  setStartLocal: (value: string) => void;
  customer: CustomerLite | null;
  setCustomer: (value: CustomerLite | null) => void;
  partySize: string;
  setPartySize: (value: string) => void;
  resourceIds: string[];
  toggleResource: (id: string) => void;
  notes: string;
  setNotes: (value: string) => void;
}

function serviceLabel(service: ServiceLite): string {
  return service.name;
}

export function BookingCreateFields({
  ctx,
  draft,
  serviceList,
  servicesLoading,
  noServices,
  resourceList,
  resourcesLoading,
  saveError,
}: {
  ctx: SurfaceContext;
  draft: BookingDraft;
  serviceList: ServiceLite[];
  servicesLoading: boolean;
  noServices: boolean;
  resourceList: ResourceLite[];
  resourcesLoading: boolean;
  saveError: string | null;
}) {
  const {
    serviceId,
    setServiceId,
    startLocal,
    setStartLocal,
    customer,
    setCustomer,
    partySize,
    setPartySize,
    resourceIds,
    toggleResource,
    notes,
    setNotes,
  } = draft;
  const chosenService = serviceList.find((s) => s.id === serviceId) ?? null;
  return (
    <>
      {saveError ? (
        <Alert color="error">
          <AlertContent>
            <AlertTitle>Could not take this booking</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {noServices ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>Set up something to book first</AlertTitle>
            <AlertDescription>
              A booking is a time against one of your services. Add a service — what people can book
              you for, and how long it takes — and it will appear here to choose.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="info"
            variant="soft"
            onClick={() => {
              ctx.open('scheduling.services.list');
            }}
          >
            Set up a service
          </Button>
        </Alert>
      ) : null}

      <FormSection
        title="What and when"
        description="Pick what is being booked and the time it starts. The finish time is worked out from how long the service takes."
      >
        <Field>
          <FieldLabel>What is being booked</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module"
                aria-label="What is being booked"
                value={serviceId}
                disabled={servicesLoading || noServices}
                onChange={(event) => {
                  setServiceId(event.target.value);
                }}
              >
                <option value="">Choose a service…</option>
                {serviceList.map((service) => (
                  <option key={service.id} value={service.id}>
                    {serviceLabel(service)}
                  </option>
                ))}
              </NativeSelect>
            }
          />
          {chosenService ? (
            <FieldDescription>
              {bookingTypeLabel(chosenService.bookingType)} · {chosenService.durationMinutes}{' '}
              minutes
              {chosenService.priceCents > 0
                ? ` · ${formatMoney(chosenService.priceCents, chosenService.currency)}`
                : ''}
            </FieldDescription>
          ) : (
            <FieldDescription>The service this time is set aside for.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>Starts</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="datetime-local"
                className="max-w-xs"
                value={startLocal}
                onChange={(event) => {
                  setStartLocal(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>The day and time it begins, in your own time zone.</FieldDescription>
        </Field>
      </FormSection>
      <FormSection
        title="Who it is for"
        description="Link the customer this is booked for, so it shows on their record and their reminders reach them. Leave it blank for a booking with no account — a walk-in you are writing down."
      >
        <CustomerPicker value={customer} onChange={setCustomer} />

        <Field>
          <FieldLabel>How many people (optional)</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="number"
                min={1}
                className="max-w-32"
                value={partySize}
                placeholder="1"
                onChange={(event) => {
                  setPartySize(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            For a table or a group — how many are coming. Leave blank for one.
          </FieldDescription>
        </Field>
      </FormSection>
      <BookingResourcePicker
        resourceList={resourceList}
        loading={resourcesLoading}
        resourceIds={resourceIds}
        toggleResource={toggleResource}
      />

      <FormSection
        title="A note (optional)"
        description="Anything the customer should see about this booking — where to park, what to bring."
      >
        <Textarea
          color="module"
          rows={3}
          value={notes}
          placeholder="Please arrive five minutes early."
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
      </FormSection>
    </>
  );
}
