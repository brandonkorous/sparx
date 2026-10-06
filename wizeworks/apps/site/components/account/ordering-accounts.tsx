'use client';

// The wholesale accounts the signed-in shopper can ORDER on: those where they
// are the primary contact or a buyer (sparx persona issue 086). Add to quote
// request, Save this cart and Order again are offered only to them; a viewer or
// an approver sees none of those actions, and the server refuses them too.
//
// Empty, and never fetched, for a visitor who is not signed in or a site that
// does not offer wholesale.

import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { getB2bAccounts, ORDERING_ROLES, type B2bAccountEntry } from '@/lib/customer-client';

export interface OrderingAccounts {
  accounts: B2bAccountEntry[];
  /** False until the read has answered, so nothing flickers in and out. */
  ready: boolean;
}

export function useOrderingAccounts(): OrderingAccounts {
  const { tenantSlug, status, offers, customer } = useCustomer();
  const [state, setState] = useState<OrderingAccounts>({ accounts: [], ready: false });
  const customerId = customer?.id ?? null;

  useEffect(() => {
    // Not known yet, or the shop could not be reached to ask (persona issue
    // 086): keep waiting rather than answering "no trade accounts".
    if (status === 'loading' || status === 'unreachable') return;
    if (status !== 'authenticated' || !offers.b2b) {
      setState({ accounts: [], ready: true });
      return;
    }
    let active = true;
    getB2bAccounts(tenantSlug)
      .then((accounts) => {
        if (!active) return;
        setState({ accounts: accounts.filter((a) => ORDERING_ROLES.has(a.role)), ready: true });
      })
      .catch(() => active && setState({ accounts: [], ready: true }));
    return () => {
      active = false;
    };
  }, [tenantSlug, status, offers.b2b, customerId]);

  return state;
}
