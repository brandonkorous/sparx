'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { useBookingZone } from '../booking-zone';
import { FormSection } from '../../../components/form-section';
import type { useSchedulingServices } from '../bookings-data';
import { bookingTypeLabel, type ServiceLite } from '../bookings-data';
import { instantFromWall, wallProblem } from '../../../lib/wall-clock';

/** The service and the first start: everything else is worked out from the pattern. */
export function WhatAndWhenSection({
  draft,
  start,
  services,
  noServices,
}: {
  draft: {
    serviceId: string;
    setServiceId: (id: string) => void;
    startLocal: string;
    setStartLocal: (value: string) => void;
  };
  start: ReturnType<typeof useSeriesStart>;
  services: { isLoading: boolean };
  noServices: boolean;
}) {
  const { serviceId, setServiceId, startLocal, setStartLocal } = draft;
  const { serviceList, chosenService, clock, startProblem } = start;
  return (
    <FormSection
      title="What repeats, and from when"
      description="Choose the service and the first time it happens. Everything after is worked out from the pattern below."
    >
      <ServiceField
        serviceId={serviceId}
        setServiceId={setServiceId}
        serviceList={serviceList}
        chosenService={chosenService}
        services={services}
        noServices={noServices}
      />
      <FirstStartField
        startLocal={startLocal}
        setStartLocal={setStartLocal}
        startProblem={startProblem}
        clock={clock}
      />
    </FormSection>
  );
}

/** Which service the series books. */
function ServiceField({
  serviceId,
  setServiceId,
  serviceList,
  chosenService,
  services,
  noServices,
}: {
  serviceId: string;
  setServiceId: (id: string) => void;
  serviceList: ServiceLite[];
  chosenService: ServiceLite | null;
  services: { isLoading: boolean };
  noServices: boolean;
}) {
  return (
    <Field>
      <FieldLabel>What is being booked</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            aria-label="What is being booked"
            value={serviceId}
            disabled={services.isLoading || noServices}
            onChange={(event) => {
              setServiceId(event.target.value);
            }}
          >
            <option value="">Choose a service…</option>
            {serviceList.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {chosenService ? (
        <FieldDescription>
          {bookingTypeLabel(chosenService.bookingType)} · {chosenService.durationMinutes} minutes
          each
        </FieldDescription>
      ) : null}
    </Field>
  );
}

/** When the first occurrence starts, typed on the place's clock. */
function FirstStartField({
  startLocal,
  setStartLocal,
  startProblem,
  clock,
}: {
  startLocal: string;
  setStartLocal: (value: string) => void;
  startProblem: string | null;
  clock: ReturnType<typeof useBookingZone>;
}) {
  return (
    <Field invalid={startProblem !== null}>
      <FieldLabel>First one starts</FieldLabel>
      <FieldControl
        render={
          <Input
            color={startProblem ? 'error' : 'module'}
            type="datetime-local"
            className="max-w-xs"
            value={startLocal}
            disabled={clock.zone === undefined}
            onChange={(event) => {
              setStartLocal(event.target.value);
            }}
          />
        }
      />
      {startProblem ? (
        <FieldError match>{startProblem}</FieldError>
      ) : (
        <FieldDescription>The day and time of the first occurrence. {clock.hint}</FieldDescription>
      )}
    </Field>
  );
}

/** The chosen service and the first start, read on the right clock. */
export function useSeriesStart(
  services: ReturnType<typeof useSchedulingServices>,
  serviceId: string,
  startLocal: string
) {
  const serviceList = services.data?.items ?? [];
  const chosenService = serviceList.find((s) => s.id === serviceId) ?? null;
  // On the clock of the place it happens at, which is the clock every occurrence
  // will be booked on (sparx persona issue 086), never this computer's.
  const clock = useBookingZone(chosenService?.locationId);
  const startIso = clock.zone ? instantFromWall(startLocal, clock.zone) : null;
  const startProblem = clock.zone ? wallProblem(startLocal, clock.zone) : null;
  return { serviceList, chosenService, clock, startIso, startProblem };
}
