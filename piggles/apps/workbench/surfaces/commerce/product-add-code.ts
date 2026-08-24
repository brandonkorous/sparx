'use client';

// The two sentences the Add form says about a product code.
//
// Both exist because of issue 176: a code that was already in use got as far as
// the save, the product was written, its price was refused, and the person was
// told "was added without a price" — about a price she had typed. One outcome,
// two causes, and the message named the wrong one and then prescribed a remedy
// that fails the same way.
//
// So: say WHICH product has the code, before the save where possible, and say
// what actually happened when it is not.

import { productErrorMessage, isSkuConflict, type SkuCheck } from './products-data';

/**
 * Why a code she typed will not save — or `null` when it will, or when nobody
 * has answered yet.
 *
 * `undefined` check data is the unanswered case and must stay silent: a form
 * that says "that code is free" on the strength of a request still in flight is
 * making a measurement it does not have.
 */
export function codeTaken(check: SkuCheck | undefined): string | null {
  const owner = check?.owner;
  if (!owner) return null;
  // A retired holder still owns the code — the unique index has no notion of
  // deleted — but she cannot go and look at it, so pointing her at it by name
  // would send her hunting for a product that is not in her catalog.
  if (owner.retired) {
    return `A retired product is still using this code. Try ${check.free} instead.`;
  }
  return `“${owner.productTitle}” is already using this code. Try ${check.free} instead.`;
}

export interface HalfCreatedToast {
  title: string;
  description: string;
  type: 'warning';
}

/**
 * What to say when the product was written and its price was not.
 *
 * The generic version of this said "was added without a price · Set its price
 * here", which is false about what she did and wrong about what to do next: the
 * price cannot be saved until the code is changed, so following the advice fails
 * again with no more explanation than the first time.
 */
export function halfCreatedToast(error: unknown, name: string): HalfCreatedToast {
  if (isSkuConflict(error)) {
    return {
      title: `${name} was added, but its code is already in use`,
      description:
        'Another product has that code, so the price could not be saved against it. Give this one a different code here and the price will save with it.',
      type: 'warning',
    };
  }
  return {
    title: `${name} was added, but its price was not`,
    description: productErrorMessage(error, 'Set its price here — nobody can buy it until you do.'),
    type: 'warning',
  };
}
