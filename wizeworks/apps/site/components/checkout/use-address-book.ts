'use client';

// The signed-in shopper's saved addresses, as checkout uses them: pick one, or
// type a new one and keep it.
//
// Split out because it is state with a lifetime of its own — a fetch, a
// selection, and a write that happens at a completely different moment from
// either. Issue 064.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createAddress, getAddresses, type Address as BookAddress } from '@/lib/customer-client';
import type { Customer } from '@/lib/customer-client';
import type { Address } from '@/lib/checkout-client';
import { toCheckoutAddress } from './saved-addresses';

export interface AddressBook {
  addresses: BookAddress[];
  /** Null = "somewhere else": the shopper is typing one. */
  selectedId: string | null;
  select: (id: string | null) => void;
  addressFor: (id: string | null) => Address | null;
  /** The address to start on — their usual one, once it has loaded. Null until
   *  then, and null for anybody with nothing saved. */
  preferred: Address | null;
  /** There is only an offer to make when there is an account to make it to. */
  canSave: boolean;
  save: boolean;
  setSave: (next: boolean) => void;
  keepIfAsked: (address: Address) => Promise<void>;
}

export function useAddressBook({
  tenantSlug,
  customer,
  contactName,
}: {
  tenantSlug: string;
  customer: Customer | null;
  contactName: string;
}): AddressBook {
  const [addresses, setAddresses] = useState<BookAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [save, setSave] = useState(true);

  useEffect(() => {
    if (!customer) {
      setAddresses([]);
      setSelectedId(null);
      return;
    }
    let live = true;
    getAddresses(tenantSlug)
      .then((rows) => {
        if (!live) return;
        // Billing-only addresses are not somewhere to send an order.
        const usable = rows.filter((a) => a.type !== 'billing');
        setAddresses(usable);
        // Start on the one they marked as theirs, falling back to the only one
        // they have. Nothing saved leaves the form showing, which is right.
        const start = usable.find((a) => a.isDefault) ?? usable[0];
        setSelectedId(start?.id ?? null);
      })
      .catch(() => {
        // An address book we cannot read is not a reason to block a sale. The
        // form below is a complete way to buy something.
        if (live) setAddresses([]);
      });
    return () => {
      live = false;
    };
  }, [customer, tenantSlug]);

  const addressFor = useCallback(
    (id: string | null): Address | null => {
      if (id === null) return null;
      const row = addresses.find((a) => a.id === id);
      return row ? toCheckoutAddress(row, contactName) : null;
    },
    [addresses, contactName]
  );

  const preferred = useMemo(() => addressFor(selectedId), [addressFor, selectedId]);

  const keepIfAsked = useCallback(
    async (address: Address) => {
      // Only a NEW address, only when asked, only when there is an account to
      // put it on. Picking a saved one saves nothing — it is already there.
      if (selectedId !== null || !save || !customer) return;
      try {
        await createAddress(tenantSlug, {
          type: 'shipping',
          recipientName: address.name,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          region: address.region ?? null,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone ?? null,
          // Their first one becomes the one checkout starts on next time.
          isDefault: addresses.length === 0,
        });
      } catch {
        // Swallowed on purpose. The order is the thing the shopper came for,
        // and an address book that would not take a row must never be the
        // reason a sale does not happen.
      }
    },
    [addresses.length, customer, save, selectedId, tenantSlug]
  );

  return {
    addresses,
    selectedId,
    select: setSelectedId,
    addressFor,
    preferred,
    canSave: customer !== null,
    save,
    setSave,
    keepIfAsked,
  };
}
