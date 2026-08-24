'use client';

// COLLECTION — the whole step for a shop that hands orders over in person.
//
// There is no form on it. That is the point of issue 064: a customer collecting
// a bun over a counter used to fill in seven address fields, press a button,
// and be told the only option was to come and get it. Nothing on this screen is
// asked for, because everything a handover needs was already given on the
// contact step.

import { Button } from '@wizeworks/silicaui-react';

import type { ShippingRate } from '@/lib/checkout-client';
import { RateChoices } from './rate-choices';

export function CollectionStep({
  rates,
  chosen,
  onChoose,
  currency,
  contactName,
  contactPhone,
  onBack,
  onSubmit,
  busy,
}: {
  rates: ShippingRate[];
  chosen: ShippingRate | null;
  onChoose: (rate: ShippingRate) => void;
  currency: string;
  contactName: string;
  contactPhone: string;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">
        How you&rsquo;ll get your order
      </h2>

      <RateChoices
        rates={rates}
        chosen={chosen}
        onChoose={onChoose}
        currency={currency}
        legend="Ready for you to collect"
      />

      {/* Reads back what the counter will actually have, so nobody wonders
          whether they were supposed to give an address somewhere. */}
      <p className="text-base-content">
        {contactName ? (
          <>
            We&rsquo;ll put this aside under <strong>{contactName}</strong>.
          </>
        ) : (
          <>We&rsquo;ll have this ready for you.</>
        )}{' '}
        {contactPhone
          ? `We'll call ${contactPhone} when it's ready.`
          : "We'll email you when it's ready."}
      </p>

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" color="primary" size="lg" className="flex-1" disabled={busy}>
          {busy ? 'Loading…' : 'Continue to payment'}
        </Button>
      </div>
    </form>
  );
}
