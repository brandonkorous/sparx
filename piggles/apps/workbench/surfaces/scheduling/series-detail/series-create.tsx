'use client';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../../components/pane-toolbar';
import { FormSection } from '../../../components/form-section';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { CustomerPicker } from '../bookings-customer-picker';
import { SaveFailure } from '@/components/save-failure';
import type { RecurrenceDraft } from '../bookings-data';
import { COLUMN } from './column';
import { RecurrenceFields } from './recurrence-fields';
import { WhatAndWhenSection } from './series-create-fields';
import { useSeriesCreate } from './use-series-create';

/* ══════════════════════════════════════════════════════════════════════════
   SET UP A NEW REPEATING BOOKING
   ══════════════════════════════════════════════════════════════════════════ */

export function SeriesCreate({ ctx }: { ctx: SurfaceContext }) {
  const { draft, create, services, start, canSave, preview, saveError, noServices, submit } =
    useSeriesCreate(ctx);
  const { customer, setCustomer, recurrence, setRecurrence } = draft;

  return (
    <div className={PANE_SHELL}>
      <SeriesCreateToolbar
        noServices={noServices}
        canSave={canSave}
        pending={create.isPending}
        submit={submit}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <SaveFailure title="Could not set this up" message={saveError} />

          {noServices ? <NoServicesAlert ctx={ctx} /> : null}

          <WhatAndWhenSection
            draft={draft}
            start={start}
            services={services}
            noServices={noServices}
          />

          <PatternSection recurrence={recurrence} setRecurrence={setRecurrence} preview={preview} />

          <FormSection
            title="Who it is for (optional)"
            description="Link a customer if every occurrence is for the same person: a standing weekly slot for one client. Leave blank otherwise."
          >
            <CustomerPicker value={customer} onChange={setCustomer} />
          </FormSection>
        </div>
      </div>
    </div>
  );
}

function SeriesCreateToolbar({
  noServices,
  canSave,
  pending,
  submit,
}: {
  noServices: boolean;
  canSave: boolean;
  pending: boolean;
  submit: () => void;
}) {
  return (
    <PaneToolbar
      label="New repeating booking actions"
      status={
        <Text as="span" className="shrink-0 text-sm whitespace-nowrap">
          {/* The bar was empty on its left. The one fact that decides whether
              this form can be used at all is whether there is a service to
              book, and it was only said inside an alert further down. */}
          {noServices ? 'No services to book yet' : 'New repeating booking'}
        </Text>
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={!canSave}
          loading={pending}
          onClick={submit}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          Set it up
        </Button>
      }
    />
  );
}

function NoServicesAlert({ ctx }: { ctx: SurfaceContext }) {
  return (
    <Alert color="info">
      <AlertContent>
        <AlertTitle>Set up something to book first</AlertTitle>
        <AlertDescription>
          A repeating booking creates appointments for one of your services. Add a service first,
          then come back here.
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
  );
}

function PatternSection({
  recurrence,
  setRecurrence,
  preview,
}: {
  recurrence: RecurrenceDraft;
  setRecurrence: (next: RecurrenceDraft) => void;
  preview: string | null;
}) {
  return (
    <FormSection title="The pattern" description="How often it repeats and when it stops.">
      <RecurrenceFields draft={recurrence} onChange={setRecurrence} />
      {preview ? (
        <Alert color="info">
          <AlertContent>
            <AlertDescription>{preview}.</AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Text className="text-sm">
          {recurrence.freq === 'WEEKLY' && recurrence.byDay.length === 0
            ? 'Pick at least one day of the week for the pattern.'
            : 'Finish the pattern to see it in words.'}
        </Text>
      )}
    </FormSection>
  );
}
