'use client';

// The three sections a service IS: what it is called, how long it runs, what it
// costs. Lifted out of service-detail.tsx to keep that file inside the size rule
// once the requirements section grew a skills field (issue 088).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MoneyTextInput } from '../../components/money-input';
import { BOOKING_TYPES, type BookingPolicy, type BookingType } from './setup-data';
import { CURRENCIES, type Draft } from './service-detail';

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
  policies: { data?: { items: BookingPolicy[] }; isPending: boolean };
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

      <FormSection
        title="What it costs"
        description="The price a customer pays, and which deposit rules apply."
      >
        <div className="grid gap-4 @md:grid-cols-2">
          <Field>
            <FieldLabel>Price</FieldLabel>
            <FieldControl
              render={
                <MoneyTextInput
                  color="module"
                  className="max-w-40"
                  aria-label="Price"
                  text={draft.price}
                  onTextChange={(text) => {
                    onSet('price', text);
                  }}
                />
              }
            />
            {priceProblem ? (
              <FieldStatus status="error">{priceProblem}</FieldStatus>
            ) : (
              <FieldDescription>Leave blank for a free booking.</FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel>Currency</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  className="max-w-32"
                  value={draft.currency}
                  aria-label="Currency"
                  onChange={(event) => {
                    onSet('currency', event.target.value);
                  }}
                >
                  {CURRENCIES.map((code: string) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Booking rules</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                value={draft.policyId}
                aria-label="Booking rules"
                disabled={policies.isPending}
                onChange={(event) => {
                  onSet('policyId', event.target.value);
                }}
              >
                <option value="">No deposit or cancellation rules</option>
                {(policies.data?.items ?? []).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </NativeSelect>
            }
          />
          <FieldDescription>
            The deposit and cancellation terms a customer agrees to when booking this service. Set
            these up under Booking rules.
          </FieldDescription>
        </Field>
      </FormSection>
    </>
  );
}
