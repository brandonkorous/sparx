'use client';

// Slide-in mini-cart. Mounted once in the root layout (inside CartProvider);
// opens when an item is added or the header cart button is clicked.

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Button } from '@wizeworks/silicaui-react';
import { cadenceLabel } from '@wizeworks/commerce-schemas';

import { checkoutBlock, lineRule, ruleSentence } from '@/lib/account-buying-rules';
import { ordersClosed } from '@/lib/orders-closed';
import type { StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { CART_UNREACHABLE_MESSAGE } from '@/lib/shop-reach';
import { CoreLine } from './core-choice';
import { QuantityStepper } from './quantity-stepper';

export function MiniCart({ paymentMode = 'card' }: { paymentMode?: StorefrontPaymentMode }) {
  const {
    drawerOpen,
    closeDrawer,
    lines,
    totals,
    count,
    currency,
    updateItem,
    setCoreFirst,
    removeItem,
    accountRules,
    known,
    unreachable,
  } = useCart();
  // A trade account's rules on the basket (sparx persona issue 086), the same
  // ones the cart page and checkout hold it to.
  // Or a shop that cannot be paid on its website yet (sparx persona issue 131).
  const closed = ordersClosed(paymentMode, accountRules?.paymentTerms);
  const blocked = checkoutBlock(accountRules) ?? closed;

  // Why a quantity change was refused, against the line it was refused on — a
  // shop can run out for the day (issue 026), and a stepper that silently snaps
  // back leaves somebody pressing the same button at a number that will not move.
  const [refused, setRefused] = useState<{ lineId: string; message: string } | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40" role="presentation">
      <button
        type="button"
        aria-label="Close cart"
        className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent"
        onClick={closeDrawer}
      />
      <aside
        className="border-base-300 bg-base-100 absolute top-0 right-0 bottom-0 flex w-[min(420px,92vw)] flex-col border-l"
        aria-label="Shopping cart"
        role="dialog"
        aria-modal="true"
      >
        <div className="border-base-300 flex items-center justify-between border-b px-5 py-4">
          <span className="text-base-content text-2xl font-semibold">Your cart ({count})</span>
          <button
            type="button"
            className="rounded-field text-base-content hover:bg-base-200 relative inline-flex h-10 w-10 cursor-pointer items-center justify-center border-0 bg-transparent transition-colors"
            aria-label="Close cart"
            onClick={closeDrawer}
          >
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 && !known && unreachable ? (
          // Not "Your cart is empty": the cart could not be read yet, and the
          // provider is asking again (persona issue 086).
          <div className="flex-1 px-5 py-6">
            <Alert color="warning" role="status" aria-live="polite">
              {CART_UNREACHABLE_MESSAGE}
            </Alert>
          </div>
        ) : lines.length === 0 ? (
          <div className="text-base-content grid flex-1 place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center">
            <span className="text-[2.5rem] opacity-50" aria-hidden="true">
              🛒
            </span>
            <p className="text-base-content m-0">Your cart is empty.</p>
            <Button type="button" color="primary" onClick={closeDrawer}>
              Keep shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="border-base-300 grid grid-cols-[88px_1fr_auto] items-start gap-4 border-b py-5 max-[520px]:grid-cols-[64px_1fr]"
                >
                  {/* The thumbnail follows its COLUMN. It was a fixed 88px inside a
                      64px column below 520px, so it overhung by 24px and covered the
                      first letter of the product's name. */}
                  <div className="rounded-field bg-base-200 relative size-[88px] shrink-0 overflow-hidden max-[520px]:size-16">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt={line.title}
                        fill
                        sizes="(max-width: 520px) 64px, 88px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {line.productHandle ? (
                      <Link
                        href={`/products/${line.productHandle}`}
                        onClick={closeDrawer}
                        className="card-title text-base-content no-underline"
                      >
                        {line.title}
                      </Link>
                    ) : (
                      <span className="card-title text-base-content">{line.title}</span>
                    )}
                    {line.repeat ? (
                      <span className="text-base-content text-base">
                        {cadenceLabel(line.repeat)}
                      </span>
                    ) : null}
                    {line.variantTitle ? (
                      <span className="text-base-content text-sm">{line.variantTitle}</span>
                    ) : null}
                    {/* The deposit, or "Ready once your old part arrives", and the
                        switch between them where the part can be bought both ways
                        (sparx issues 051, 057). */}
                    <CoreLine
                      line={line}
                      currency={currency}
                      onSwitch={(coreFirst) => setCoreFirst(line.id, coreFirst)}
                    />
                    {ruleSentence(lineRule(accountRules, line.id)) ? (
                      <span className="text-base-content text-sm">
                        {ruleSentence(lineRule(accountRules, line.id))}
                      </span>
                    ) : null}
                    <div>
                      <QuantityStepper
                        value={line.quantity}
                        min={lineRule(accountRules, line.id)?.start}
                        step={lineRule(accountRules, line.id)?.step}
                        max={lineRule(accountRules, line.id)?.maximum ?? undefined}
                        onChange={(q) => {
                          setRefused(null);
                          void updateItem(line.id, q).catch((err: unknown) => {
                            setRefused({ lineId: line.id, message: (err as Error).message });
                          });
                        }}
                        onRemove={() => removeItem(line.id)}
                        small
                      />
                    </div>
                    {refused?.lineId === line.id ? (
                      <span className="text-warning text-sm font-semibold">{refused.message}</span>
                    ) : lineRule(accountRules, line.id)?.problem ? (
                      <span className="text-warning text-sm font-semibold">
                        {lineRule(accountRules, line.id)?.problem}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right font-semibold">
                    {formatMoney(line.lineTotalCents, currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-base-300 flex flex-col gap-3 border-t p-5">
              <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotalCents, currency)}</span>
              </div>
              {/* Not in the subtotal, and charged at checkout: said here so the
                  checkout total is not a surprise (sparx issue 051). */}
              {totals.coreChargeTotalCents > 0 ? (
                <p className="text-base-content m-0 text-sm">
                  Plus {formatMoney(totals.coreChargeTotalCents, currency)} in refundable core
                  deposits, paid back when you return your old parts.
                </p>
              ) : null}
              <p className="text-base-content m-0 text-sm">
                Shipping &amp; taxes calculated at checkout.
              </p>
              {blocked ? (
                <>
                  <Alert
                    color={
                      accountRules?.canOrder === false || blocked === closed ? 'info' : 'warning'
                    }
                  >
                    {blocked}
                  </Alert>
                  <Button color="primary" size="lg" className="w-full" disabled>
                    Checkout
                  </Button>
                </>
              ) : (
                <Button
                  render={<Link href="/checkout" onClick={closeDrawer} />}
                  color="primary"
                  size="lg"
                  className="w-full"
                >
                  Checkout
                </Button>
              )}
              <Button
                render={<Link href="/cart" onClick={closeDrawer} />}
                variant="outline"
                className="w-full"
              >
                View cart
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
