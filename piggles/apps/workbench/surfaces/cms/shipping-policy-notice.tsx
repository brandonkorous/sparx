'use client';

// Told only when there is a reason to tell them.
//
// The shipping policy is OPTIONAL, because selling is not shipping — a bakery
// taking collection orders has a shop and posts nothing. This notice is the
// other half of that: a business that DOES post things, and has no policy
// saying how long it takes and what it costs, should hear about it.
//
// It says WHY it is asking. "You have set up delivery charges" is a fact she
// recognises and can act on; a bare "you should add a shipping policy" reads as
// nagging from software that does not know her business, and gets dismissed.

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import type { ShippingEvidence } from './legal-data';

/** What we saw, in her words rather than the column's. */
function reason(because: ShippingEvidence | null): string {
  if (because === 'orders-shipped') return 'You have sent orders out to people.';
  if (because === 'delivery-rates') return 'You have set up delivery charges.';
  return 'It looks like you send orders out.';
}

export function ShippingPolicyNotice({ because }: { because: ShippingEvidence | null }) {
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>{reason(because)}</AlertTitle>
        <AlertDescription>
          People buying from you will want to know how long delivery takes and what it costs, and
          there is no shipping policy on your site yet. It is under <strong>Optional pages</strong>{' '}
          below — add it, make the wording fit how you actually deliver, then publish it.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
