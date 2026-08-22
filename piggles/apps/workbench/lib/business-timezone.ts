'use client';

// The zone this business works in.
//
// Anything that stores an hour has to know it. A salon typing "nine o'clock"
// means nine in her salon, and if nothing asks which clock that is, the answer
// defaults to somebody else's — Nia set her week to 09:00-17:30 and her diary
// showed a full head of colour at three in the morning (issue 081).
//
// One reader rather than a default per form: three scheduling forms already
// wanted this, and each had written `'UTC'` by hand.

import { useQuery } from '@wizeworks/query';
import { api } from './api/client';

/** The zone this computer is set to — the overwhelmingly likely answer for
 *  somebody setting up their own shop, and never wrong by seven hours. */
export function thisComputersTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The business's own zone when it has one, otherwise this computer's.
 *
 * Shares the `['tenant', 'business']` key with Business details, so opening one
 * warms the other and a zone changed there is picked up here without a refetch.
 * `undefined` while it loads — a form should hold its field until the answer
 * arrives rather than stamping a guess the person then has to notice and undo.
 */
export function useBusinessTimezone(): string | undefined {
  const { data, isPending } = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<{ timezone: string | null }>('/v1/tenant/business'),
  });
  if (isPending) return undefined;
  return data?.timezone ?? thisComputersTimezone();
}
