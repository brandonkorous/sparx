'use client';

// The address on Business details, as an offer to a stock location that has none.
//
// The first location is made when Stock is switched on, and it copies the
// business address only if one exists THEN. Juniper Row typed hers into Business
// details two weeks later, so her Main Warehouse kept "US" and nothing else, and
// 57 of 58 such locations in the database had no full address (issue 929). The
// address is offered on screen, never copied behind her back: the location is
// where parcels leave from, and that may not be where the business is registered.
//
// Shares the `['tenant', 'business']` key with Business details, so it is
// usually already cached.

import { useQuery } from '@wizeworks/query';
import { api } from './api/client';

export interface BusinessAddress {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
}

/** Undefined while loading or when it could not be read. */
export function useBusinessAddress(): BusinessAddress | undefined {
  const { data } = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<BusinessAddress>('/v1/tenant/business'),
  });
  return data;
}
