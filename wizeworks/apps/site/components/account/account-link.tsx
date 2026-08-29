'use client';

// The header's account control — "Sign in" to a visitor, her own name once she is
// signed in. Mounted by the `site.account-link` host core.
//
// It exists because the navbar's secondary slot was a stamped link, so every site on
// the platform told a signed-in customer to sign in, above her own name, and left her
// no route back to her orders (issue 291). The session is already in scope: the chrome
// renders inside <CustomerProvider>, so this reads it rather than fetching anything.

import Link from 'next/link';

import { useCustomer } from '@/components/customer-provider';
import type { Customer } from '@/lib/customer-client';

/** While the session is still resolving we do not yet know which of the two labels is
 *  true, so neither is shown. "Account" is correct either way — `/account` sends a
 *  visitor to the sign-in form and a customer to her account — which avoids both a
 *  flash of the wrong word and a control that pops into existence. */
const RESOLVING = 'Account';

/** Her name if she gave one, otherwise her email. Written as early returns rather than
 *  `??`: a BLANK first name has to fall through, and an account created with an empty
 *  name would otherwise render an empty control in the header. */
function displayName(customer: Customer | null): string {
  const first = customer?.firstName?.trim();
  if (first) return first;
  const email = customer?.email?.trim();
  if (email) return email;
  return RESOLVING;
}

export function AccountLink({ className }: { className?: string }) {
  const { customer, status } = useCustomer();

  if (status === 'authenticated') {
    const name = displayName(customer);
    return (
      <Link href="/account" className={className} title="Your orders and details">
        {name}
      </Link>
    );
  }

  const label = status === 'loading' ? RESOLVING : 'Sign in';
  const href = status === 'loading' ? '/account' : '/account/login';
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
