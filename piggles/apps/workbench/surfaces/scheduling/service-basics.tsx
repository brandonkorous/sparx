'use client';

// What a service IS: what it is called and how long it runs. Lifted out of
// service-detail.tsx to keep that file inside the size rule once the requirements
// section grew a skills field (issue 088); price and rules moved on again to
// service-price.tsx when the rule-set field grew a consequence line (issue 127).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { BOOKING_TYPES, type BookingType } from './setup-data';
import type { Draft } from './service-draft';
import { ServicePrice, type PolicyList } from './service-price';

/** A non-negative integer from a number input, falling back when it is cleared. */
function intOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function ServiceBasics({
  isNew,
  draft,
  policies,
  priceProblem,
  onSet,
}: {
  isNew: boolean;
  draft: Draft;
  policies: PolicyList;
  priceProblem: string | null;
  onSet: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const typeHint = BOOKING_TYPES.find((entry) => entry.value === draft.bookingType)?.hint;
  const durationOk = draft.durationMinutes >= 1;
  return (
    <>
      <FormSection
        title={isNew ? 'New service' : 'What it is'}
        description={
          isNew
            ? 'Give the service a name a customer will recognise, and say what kind of booking it is.'
            : undefined
        }
      >
        <Field>
          <FieldLabel>Service name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.name}
                placeholder="Full color & cut"
                onChange={(event) => {
                  onSet('name', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>What a customer sees when they book.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>What kind of booking</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                value={draft.bookingType}
                aria-label="What kind of booking"
                onChange={(event) => {
                  onSet('bookingType', event.target.value as BookingType);
                }}
              >
                {BOOKING_TYPES.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </NativeSelect>
            }
          />
          {typeHint ? <FieldDescription>{typeHint}</FieldDescription> : null}
        </Field>

        <Field>
          <FieldLabel>Description (optional)</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={3}
                value={draft.description}
                placeholder="What is included, what to bring, anything a customer should know."
                onChange={(event) => {
                  onSet('description', event.target.value);
                }}
              />
            }
          />
        </Field>

        {draft.bookingType === 'class' ? (
          <Field>
            <FieldLabel>How many people can book each session</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={1}
                  className="max-w-32 tabular-nums"
                  value={String(draft.capacity)}
                  onChange={(event) => {
                    onSet('capacity', intOr(Number(event.target.value), 1) || 1);
                  }}
                />
              }
            />
            <FieldDescription>
              The most people who can join one session — the class fills up at this number.
            </FieldDescription>
          </Field>
        ) : null}
      </FormSection>

      <FormSection
        title="How long it takes"
        description="How long the booking lasts, and any gap you need before or after it."
      >
        <div className="grid gap-4 @md:grid-cols-2">
          <Field>
            <FieldLabel>Length (minutes)</FieldLabel>
            <FieldControl
              render={
                <Input
                  color={durationOk ? 'module' : 'error'}
                  type="number"
                  min={1}
                  className="max-w-32 tabular-nums"
                  value={String(draft.durationMinutes)}
                  onChange={(event) => {
                    onSet('durationMinutes', intOr(Number(event.target.value), 0));
                  }}
                />
              }
            />
            <FieldDescription>How long the booking itself runs.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Offer start times every (minutes)</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={1}
                  className="max-w-32 tabular-nums"
                  value={String(draft.slotIntervalMin)}
                  onChange={(event) => {
                    onSet('slotIntervalMin', intOr(Number(event.target.value), 15) || 15);
                  }}
                />
              }
            />
            <FieldDescription>
              How far apart the bookable slots sit — every 15 minutes, on the hour, and so on.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Gap before (minutes)</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={0}
                  className="max-w-32 tabular-nums"
                  value={String(draft.bufferBeforeMin)}
                  onChange={(event) => {
                    onSet('bufferBeforeMin', intOr(Number(event.target.value), 0));
                  }}
                />
              }
            />
            <FieldDescription>Time to set up, kept free before the booking.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Gap after (minutes)</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={0}
                  className="max-w-32 tabular-nums"
                  value={String(draft.bufferAfterMin)}
                  onChange={(event) => {
                    onSet('bufferAfterMin', intOr(Number(event.target.value), 0));
                  }}
                />
              }
            />
            <FieldDescription>Time to tidy up, kept free after the booking.</FieldDescription>
          </Field>
        </div>
      </FormSection>

      <ServicePrice draft={draft} policies={policies} priceProblem={priceProblem} onSet={onSet} />
    </>
  );
}
