'use client';

// WHAT'S IN IT — the basket's lines and what they come to.
//
// One card, because the totals are the sum of the rows above them.

import { Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { cartMoney as money, type CartDetail } from './carts-data';

function MoneyRow({
  label,
  cents,
  currency,
  emphasis = false,
}: {
  label: string;
  cents: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between gap-4',
        emphasis ? 'text-lg font-semibold' : 'text-base',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="tabular-nums">{money(cents, currency)}</span>
    </div>
  );
}

export function CartLines({ cart }: { cart: CartDetail }) {
  return (
    <FormSection title="What’s in it">
      {cart.items.length === 0 ? (
        <Text>This cart is empty — every line was removed before they left.</Text>
      ) : (
        <ul className="flex flex-col">
          {cart.items.map((item) => (
            <li
              key={item.cartItemId}
              className="border-base-300 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-medium">{item.name}</span>
                <span className="font-mono text-sm break-all">{item.sku}</span>
                <span className="text-sm">
                  {item.quantity} × {money(item.unitPriceCents, cart.currency)}
                </span>
              </div>
              <span className="text-base font-medium tabular-nums">
                {money(item.subtotalCents, cart.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
        <MoneyRow label="Items" cents={cart.totals.subtotalCents} currency={cart.currency} />
        {cart.totals.discountTotalCents > 0 ? (
          <MoneyRow
            label="Discount"
            cents={-cart.totals.discountTotalCents}
            currency={cart.currency}
          />
        ) : null}
        {cart.totals.shippingTotalCents > 0 ? (
          <MoneyRow
            label="Delivery"
            cents={cart.totals.shippingTotalCents}
            currency={cart.currency}
          />
        ) : null}
        {cart.totals.taxTotalCents > 0 ? (
          <MoneyRow label="Tax" cents={cart.totals.taxTotalCents} currency={cart.currency} />
        ) : null}
        <MoneyRow
          label="Cart total"
          cents={cart.totals.totalCents}
          currency={cart.currency}
          emphasis
        />
      </div>

      {cart.appliedDiscountCodes.length > 0 ? (
        <Text className="text-sm">Codes applied: {cart.appliedDiscountCodes.join(', ')}</Text>
      ) : null}
    </FormSection>
  );
}
