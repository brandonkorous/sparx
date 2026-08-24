'use client';

// The zone this business works in.
//
// Anything that stores an hour has to know it. A salon typing "nine o'clock"
// means nine in her salon, and if nothing asks which clock that is, the answer
// defaults to somebody else's — Nia set her week to 09:00-17:30 and her diary
// showed a full head of color at three in the morning (issue 081).
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
 * What the business ACTUALLY has on file, absence included.
 *
 * Three answers, and they are three different things:
 * `undefined` still loading · `null` nobody has set one · a string, they did.
 *
 * Anything that has to TELL somebody where a time came from needs the middle
 * one, and `useBusinessTimezone` below cannot give it — folding "not set" into
 * the device's zone is exactly what makes an unset value read as a chosen one
 * (issue 178).
 *
 * Shares the `['tenant', 'business']` key with Business details, so opening one
 * warms the other and a zone changed there is picked up here without a refetch.
 */
export function useBusinessZone(): string | null | undefined {
  const { data, isPending } = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<{ timezone: string | null }>('/v1/tenant/business'),
  });
  if (isPending) return undefined;
  return data?.timezone ?? null;
}

/**
 * The business's own zone when it has one, otherwise this computer's.
 *
 * For a form that must STAMP a value and has nowhere to explain itself.
 * `undefined` while it loads — a form should hold its field until the answer
 * arrives rather than stamping a guess the person then has to notice and undo.
 */
export function useBusinessTimezone(): string | undefined {
  const zone = useBusinessZone();
  if (zone === undefined) return undefined;
  return zone ?? thisComputersTimezone();
}
