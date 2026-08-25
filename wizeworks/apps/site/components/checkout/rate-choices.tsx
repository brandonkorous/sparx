'use client';

// The list of ways an order can leave — shared by the delivery step and the
// collection step, because they are the same choice asked in two situations.

import { formatMoney } from '@/lib/format';
import type { ShippingRate } from '@/lib/checkout-client';

export function RateChoices({
  rates,
  chosen,
  onChoose,
  currency,
  legend,
}: {
  rates: ShippingRate[];
  chosen: ShippingRate | null;
  onChoose: (rate: ShippingRate) => void;
  currency: string;
  legend: string;
}) {
  if (rates.length === 0) return null;
  return (
    <fieldset className="rounded-box border-base-300 m-0 flex flex-col gap-2 border p-4">
      {/* Not "Shipping method": a shop that has not set delivery up offers
          collection here, and heading it Shipping would describe the one thing
          it is not. */}
      <legend className="text-base-content px-2 text-2xl font-semibold">{legend}</legend>
      {rates.map((rate) => (
        <label
          key={rate.rateRef}
          className="rounded-field border-base-300 has-[input:checked]:border-primary has-[input:checked]:bg-primary/[0.06] flex cursor-pointer items-center gap-3 border p-3"
        >
          <input
            type="radio"
            name="rate"
            className="radio"
            checked={chosen?.rateRef === rate.rateRef}
            onChange={() => onChoose(rate)}
          />
          <span className="flex-1">
            <strong>{rate.service}</strong>
            {rate.estimatedDays != null ? (
              <span className="text-base-content">
                {' '}
                · {rate.estimatedDays} {rate.estimatedDays === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </span>
          <span>{rate.amountCents === 0 ? 'Free' : formatMoney(rate.amountCents, currency)}</span>
        </label>
      ))}
    </fieldset>
  );
}
