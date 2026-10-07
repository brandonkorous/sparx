'use client';

// Full cart page body. Client component — reads the live cart from context,
// renders editable line items + an order summary with a discount-code field.

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Alert, Button } from '@wizeworks/silicaui-react';
import { cadenceLabel, type RepeatCadence } from '@wizeworks/commerce-schemas';

import { checkoutBlock, lineRule, ruleSentence } from '@/lib/account-buying-rules';
import { ordersClosed } from '@/lib/orders-closed';
import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { QuantityStepper } from './quantity-stepper';
import { RepeatChoice } from './repeat-choice';
import { CoreLine } from './core-choice';
import { CodeField } from './code-field';
import { MadeToOrderSummary } from './made-to-order-summary';
import { SaveCartForAccount } from './account/save-cart-for-account';
import type { StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import { CART_UNREACHABLE_MESSAGE } from '@/lib/shop-reach';

export function CartView({
  /** Whether this website takes money at all. Handed down from the route rather
   *  than read from the cart: it is a fact about the SHOP, not about the basket,
   *  and the basket must not offer to charge a card that will never be charged
   *  (issue 185). */
  paymentMode = 'card',
}: {
  paymentMode?: StorefrontPaymentMode;
} = {}) {
  const {
    lines,
    totals,
    count,
    currency,
    updateItem,
    setRepeat,
    setCoreFirst,
    removeItem,
    appliedDiscountCodes,
    removeDiscount,
    appliedGiftCardCodes,
    removeGiftCard,
    madeToOrder,
    accountRules,
    known,
    unreachable,
  } = useCart();

  // A trade account's rules on this basket (sparx persona issue 086): who may
  // order, each line's case pack, minimum and maximum, and the account minimum.
  // Checkout refuses the same baskets on the server; this says so first.
  // Or a shop that cannot be paid on its website yet (sparx persona issue 131).
  const closed = ordersClosed(paymentMode, accountRules?.paymentTerms);
  const blocked = checkoutBlock(accountRules) ?? closed;

  // Why a quantity change was refused, against the line it was refused on. A
  // shop can run out for the day (issue 026), and a stepper that silently snaps
  // back leaves somebody pressing "+" at a number that will not move.
  const [refused, setRefused] = useState<{ lineId: string; message: string } | null>(null);

  // Changing how often a line repeats can be refused too: the owner may have
  // stopped offering that schedule since it went into the basket (issue 739).
  const changeRepeat = (lineId: string, repeat: RepeatCadence | null) => {
    setRefused(null);
    void setRepeat(lineId, repeat).catch((err: unknown) => {
      setRefused({ lineId, message: (err as Error).message });
    });
  };

  const changeQuantity = (lineId: string, quantity: number) => {
    setRefused(null);
    void updateItem(lineId, quantity).catch((err: unknown) => {
      setRefused({ lineId, message: (err as Error).message });
    });
  };

  // No lines is only "empty" once the cart has answered. Before that it is
  // still loading, or the shop could not be reached to ask, and "Your cart is
  // empty" over a full basket is the wrong thing to tell anybody (persona issue
  // 086). The cart provider asks again by itself.
  if (lines.length === 0 && !known) {
    return unreachable ? (
      <Alert color="warning" role="status" aria-live="polite">
        {CART_UNREACHABLE_MESSAGE}
      </Alert>
    ) : (
      <div className="skeleton h-60" role="status" aria-label="Loading your cart" />
    );
  }

  if (lines.length === 0) {
    return (
      <div className="text-base-content grid min-h-[40vh] place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center">
        <span className="text-[2.5rem] opacity-50" aria-hidden="true">
          🛒
        </span>
        <h2 className="text-base-content text-3xl font-semibold tracking-tight">
          Your cart is empty
        </h2>
        <p className="text-base-content m-0">Browse the catalog and add something you like.</p>
        <Button render={<Link href="/products" className="mt-2" />} color="primary">
          Shop all products
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-[clamp(1.5rem,4vw,3rem)] max-[860px]:grid-cols-1">
      <div>
        {lines.map((line) => (
          <div
            key={line.id}
            className="border-base-300 grid grid-cols-[88px_1fr_auto] items-start gap-4 border-b py-5 max-[520px]:grid-cols-[64px_1fr]"
          >
            {/* Sized by its COLUMN, not by a fixed 88px. The grid narrows its
                first track to 64px on a phone and the tile did not narrow with
                it, so it hung 24px into the text beside it — the first letter of
                every product name and every SKU sat underneath the picture
                (issue 186). `aspect-square` keeps it the shape it was. */}
            <div className="rounded-field bg-base-200 relative aspect-square w-full overflow-hidden">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  sizes="88px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {line.productHandle ? (
                <Link
                  href={`/products/${line.productHandle}`}
                  className="card-title text-base-content no-underline"
                >
                  {line.title}
                </Link>
              ) : (
                <span className="card-title text-base-content">{line.title}</span>
              )}
              {line.variantTitle ? (
                <span className="text-base-content text-sm">{line.variantTitle}</span>
              ) : null}
              {line.sku ? <span className="text-base-content text-sm">SKU: {line.sku}</span> : null}
              {/* A rebuilt part's refundable core deposit (sparx issue 051): charged
                  on top of the price, so it is said beside the part it belongs to. Or,
                  bought by sending the old part first, when it ships (issue 057), with
                  the switch between the two where the part offers both. */}
              <CoreLine
                line={line}
                currency={currency}
                detail
                onSwitch={(coreFirst) => setCoreFirst(line.id, coreFirst)}
              />
              {line.repeatOptions.length > 0 ? (
                <RepeatChoice
                  options={line.repeatOptions}
                  value={line.repeat}
                  showNote={false}
                  onChange={(next) => {
                    changeRepeat(line.id, next);
                  }}
                />
              ) : line.repeat ? (
                <span className="text-base-content text-base">{cadenceLabel(line.repeat)}</span>
              ) : null}
              {ruleSentence(lineRule(accountRules, line.id)) ? (
                <span className="text-base-content text-sm">
                  {ruleSentence(lineRule(accountRules, line.id))}
                </span>
              ) : null}
              <div className="mt-1">
                <QuantityStepper
                  value={line.quantity}
                  min={lineRule(accountRules, line.id)?.start}
                  step={lineRule(accountRules, line.id)?.step}
                  max={lineRule(accountRules, line.id)?.maximum ?? undefined}
                  onChange={(q) => {
                    changeQuantity(line.id, q);
                  }}
                  onRemove={() => removeItem(line.id)}
                />
              </div>
              {/* This line's amount breaks the account's rule: what is wrong and
                  the amounts that would work, on the line itself. */}
              {lineRule(accountRules, line.id)?.problem && refused?.lineId !== line.id ? (
                <span className="text-warning text-sm font-semibold">
                  {lineRule(accountRules, line.id)?.problem}
                </span>
              ) : null}
              {refused?.lineId === line.id ? (
                <span className="text-warning text-sm font-semibold">{refused.message}</span>
              ) : null}
              <button
                type="button"
                onClick={() => removeItem(line.id)}
                className="text-base-content w-fit cursor-pointer border-none bg-transparent p-0 text-left text-sm underline"
              >
                Remove
              </button>
            </div>
            <div className="text-right font-semibold">
              {formatMoney(line.lineTotalCents, currency)}
              <div className="text-base-content text-sm font-normal">
                {formatMoney(line.unitPriceCents, currency)} ea
              </div>
            </div>
          </div>
        ))}
        {/* Keep this basket as a named list on the wholesale account (sparx
            persona issue 086). Nothing for anyone who cannot order on one. */}
        <div className="mt-6 empty:hidden">
          <SaveCartForAccount />
        </div>
      </div>

      <aside className="rounded-box border-base-300 bg-base-100 sticky top-[92px] flex flex-col gap-3 border p-6">
        <h2 className="text-base-content text-2xl font-semibold">Order summary</h2>
        <div className="text-base-content flex justify-between text-sm">
          <span>
            Subtotal ({count} {count === 1 ? 'item' : 'items'})
          </span>
          <span>{formatMoney(totals.subtotalCents, currency)}</span>
        </div>
        {totals.discountTotalCents > 0 ? (
          <div className="text-success flex justify-between text-sm">
            <span>Discount</span>
            <span>−{formatMoney(totals.discountTotalCents, currency)}</span>
          </div>
        ) : null}
        {appliedDiscountCodes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {appliedDiscountCodes.map((code) => (
              <span key={code} className="badge static inline-flex gap-1.5">
                {code}
                <button
                  type="button"
                  aria-label={`Remove ${code}`}
                  onClick={() => removeDiscount(code)}
                  className="cursor-pointer border-none bg-transparent text-inherit"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* A gift card is money already paid, not a saving, so it reads as its own
            line. Leaving it out is what made the summary fail to add up: the rows
            a shopper could see came to more than the total under them. */}
        {/* Refundable core deposits on rebuilt parts (sparx issue 051): inside the
            total, outside the subtotal, so the rows add up only with it named. */}
        {totals.coreChargeTotalCents > 0 ? (
          <div className="text-base-content flex justify-between text-sm">
            <span>Refundable core deposits</span>
            <span>{formatMoney(totals.coreChargeTotalCents, currency)}</span>
          </div>
        ) : null}
        {totals.giftCardAppliedCents > 0 ? (
          <div className="text-success flex justify-between text-sm">
            <span>Gift card</span>
            <span>−{formatMoney(totals.giftCardAppliedCents, currency)}</span>
          </div>
        ) : null}
        {appliedGiftCardCodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {appliedGiftCardCodes.map((code) => (
              <span key={code} className="badge static inline-flex gap-2">
                {code}
                <button
                  type="button"
                  aria-label={`Remove gift card ${code}`}
                  onClick={() => void removeGiftCard()}
                  className="cursor-pointer border-none bg-transparent text-inherit"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {totals.accountCreditAppliedCents > 0 ? (
          <div className="text-success flex justify-between text-sm">
            <span>Credit on your account</span>
            <span>−{formatMoney(totals.accountCreditAppliedCents, currency)}</span>
          </div>
        ) : null}

        <CodeField />

        <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
          <span>Estimated total</span>
          <span>{formatMoney(totals.totalCents, currency)}</span>
        </div>
        <p className="text-base-content m-0 text-sm">
          Shipping &amp; taxes calculated at checkout.
        </p>

        {/* The split, before the button rather than after it — a deposit
            changes what somebody is agreeing to (issue 026). */}
        <MadeToOrderSummary
          madeToOrder={madeToOrder}
          currency={currency}
          paymentMode={paymentMode}
        />
        {blocked ? (
          <Alert
            color={accountRules?.canOrder === false || blocked === closed ? 'info' : 'warning'}
          >
            {blocked}
          </Alert>
        ) : null}
        {blocked ? (
          <Button color="primary" size="lg" className="w-full" disabled>
            Proceed to checkout
          </Button>
        ) : (
          <Button render={<Link href="/checkout" />} color="primary" size="lg" className="w-full">
            Proceed to checkout
          </Button>
        )}
        <Button render={<Link href="/products" />} variant="ghost" className="w-full">
          Continue shopping
        </Button>
      </aside>
    </div>
  );
}
