'use client';

// The country on Business details, as a starting value for a NEW place the
// business itself runs (a stock location, a place it takes bookings).
//
// A new location used to open on "No country", and the save then refused it for
// lacking one, while Business details already said "US" (sparx persona issue
// 043). The value is shown in the field before anything is saved, so the owner
// sees it and can change it; it is never stamped on a place behind their back.
//
// Shares the `['tenant', 'business']` key with Business details and the
// business-timezone read, so it is usually already cached.

import { useQuery } from '@wizeworks/query';
import { api } from './api/client';

/** `undefined` while loading · `''` when Business details has no country · else
 *  the two-letter code. */
export function useBusinessCountry(): string | undefined {
  const { data, isPending } = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<{ country: string | null }>('/v1/tenant/business'),
  });
  if (isPending) return undefined;
  return data?.country ?? '';
}
