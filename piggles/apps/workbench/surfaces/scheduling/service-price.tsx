'use client';

// What a service costs, and which rule set it follows.
//
// Split from service-basics.tsx when the rule-set field grew a consequence line —
// see `ServiceRules` below for why that line exists.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MoneyTextInput } from '../../components/money-input';
import { policySummary, reminderSummary, type BookingPolicy } from './setup-data';
import { CURRENCIES, type Draft } from './service-detail';

export interface PolicyList {
  data?: { items: BookingPolicy[] };
  isPending: boolean;
}

export function ServicePrice({
  draft,
  policies,
  priceProblem,
  onSet,
}: {
  draft: Draft;
  policies: PolicyList;
  priceProblem: string | null;
  onSet: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <>
      <FormSection title="What it costs" description="The price a customer pays for this service.">
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
      </FormSection>

      <ServiceRules draft={draft} policies={policies} onSet={onSet} />
    </>
  );
}

/**
 * Which rule set this service follows — and what picking none actually costs.
 *
 * A rule set carries THREE things: the deposit, the cancellation terms, and the
 * REMINDERS. This field used to sit under "What it costs", describe itself as
 * "the deposit and cancellation terms", and offer "No deposit or cancellation
 * rules" as its empty option — all three of which are true and none of which
 * mention the third thing. So a salon owner set up "1 day before" under Booking
 * rules, chose the sensible-sounding "no deposit or cancellation rules" for her
 * $65 haircut, and no reminder was ever scheduled for the service carrying most
 * of her bookings. Nothing on any screen said so; a booking with no rule set
 * simply lays no reminder rows and looks identical to one that does.
 */
function ServiceRules({
  draft,
  policies,
  onSet,
}: {
  draft: Draft;
  policies: PolicyList;
  onSet: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const chosen = (policies.data?.items ?? []).find((policy) => policy.id === draft.policyId);
  return (
    <FormSection
      title="The rules it follows"
      description="What a customer agrees to when they book this, and what reaches them before they turn up."
    >
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
              <option value="">No rules — and no reminders</option>
              {(policies.data?.items ?? []).map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </NativeSelect>
          }
        />
        {chosen ? (
          <FieldDescription>
            {policySummary(chosen)} · {reminderSummary(chosen)}. Change any of it under Booking
            rules.
          </FieldDescription>
        ) : (
          <FieldStatus status="warning">
            Nobody booking this gets a reminder. Reminders live in a rule set alongside deposits and
            cancellation terms, so a service with no rule set sends nothing before the appointment.
            Pick one, or make one under Booking rules.
          </FieldStatus>
        )}
      </Field>
    </FormSection>
  );
}
