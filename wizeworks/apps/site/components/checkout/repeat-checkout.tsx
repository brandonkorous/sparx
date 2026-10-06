'use client';

// The three things checkout has to say about a repeat delivery (issue 739).
//
//   before the steps   — a repeat needs an account, so a shopper who is not
//                        signed in is asked to sign in BEFORE typing an address,
//                        not refused at the last button.
//   at payment         — what repeats and what paying now agrees to.
//   on confirmation    — where the repeat order lives now.
//
// The server refuses each case on its own (no account, collection only). These
// say it first, in the shopper's words, while there is still something to do
// about it.

import Link from 'next/link';
import { cadenceWords } from '@wizeworks/commerce-schemas';
import { Alert, Button } from '@wizeworks/silicaui-react';

import type { CartLine } from '../cart-provider';

/** "Linen Shirtdress, every month" — one line per repeat in the basket. */
function RepeatList({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {lines.map((line) =>
        line.repeat ? (
          <li key={line.id} className="text-base-content text-base">
            <strong>{line.title}</strong>
            {line.variantTitle ? ` (${line.variantTitle})` : ''}, {cadenceWords(line.repeat)}
          </li>
        ) : null
      )}
    </ul>
  );
}

export function RepeatNeedsSignIn({ lines }: { lines: CartLine[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base-content text-2xl font-semibold">Sign in to set up your repeat</h2>
      <RepeatList lines={lines} />
      <p className="text-base-content m-0 text-base">
        A repeat delivery lives in your account. That is where you pause it, skip one or cancel it,
        so you need to be signed in to start one. If you do not have an account yet, you can make
        one in a minute.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          color="primary"
          render={<Link href={`/account/login?redirect=${encodeURIComponent('/checkout')}`} />}
        >
          Sign in
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/account/register?redirect=${encodeURIComponent('/checkout')}`} />}
        >
          Make an account
        </Button>
      </div>
      <p className="text-base-content m-0 text-base">
        Or <Link href="/cart">go back to your basket</Link> and choose Buy once instead.
      </p>
    </div>
  );
}

export function RepeatNeedsDelivery({ lines }: { lines: CartLine[] }) {
  return (
    <Alert color="warning">
      <div className="flex flex-col gap-2">
        <strong>This shop only offers collection, and a repeat has to be delivered.</strong>
        <RepeatList lines={lines} />
        <span>
          <Link href="/cart">Go back to your basket</Link> and choose Buy once for these.
        </span>
      </div>
    </Alert>
  );
}

export function RepeatTerms({ lines }: { lines: CartLine[] }) {
  return (
    <Alert color="info">
      <div className="flex flex-col gap-2">
        <strong>On repeat</strong>
        <RepeatList lines={lines} />
        <span>
          Paying now also saves how you paid, so each delivery after this one is charged
          automatically: the same price for the items, plus postage and tax when it goes out. You
          can pause, skip or cancel any time from your account.
        </span>
      </div>
    </Alert>
  );
}

export function RepeatConfirmed({ lines }: { lines: CartLine[] }) {
  return (
    <div className="text-base-content flex w-full max-w-[420px] flex-col gap-2 text-left">
      <strong>Your repeat</strong>
      <RepeatList lines={lines} />
      <p className="m-0">
        It starts once your payment is confirmed, and you will find it under{' '}
        <Link href="/account/repeat-orders">Repeat orders</Link> in your account. That is where you
        pause it, skip one or cancel it.
      </p>
    </div>
  );
}
