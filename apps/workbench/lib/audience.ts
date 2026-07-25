'use client';

// The AUDIENCE NOUN — what this tenant calls the people it serves (docs/136).
//
// The CRM's record is universal: a contact you have a relationship with. The
// WORD is not — a salon has clients, a gym members, a restaurant guests, a
// clinic patients, a publisher subscribers, a charity donors. One per-tenant
// preference (`tenants.settings.audienceNoun`) adapts the CRM's vocabulary so a
// tattoo studio sees "New client → Client", not "Prospect → Retail".
//
// This changes WORDS, never data: the stored customer `type` stays
// prospect/retail/b2b (load-bearing for pricing + A/R). The plural is regular
// (+s) for every noun in the set, so it is derived rather than tabled.

import { useMutation, useQueryClient } from '@sparx/query';
import type { AudienceNoun } from '@sparx/crm-schemas';
import { api } from './api/client';
import { useTenant } from './api/shell-data';

/** The pickable nouns, each with the picker copy that helps a business choose. */
export const AUDIENCE_NOUN_OPTIONS: { value: AudienceNoun; label: string; hint: string }[] = [
  { value: 'customer', label: 'Customers', hint: 'Shops, e-commerce, food, and most businesses.' },
  {
    value: 'client',
    label: 'Clients',
    hint: 'Salons, studios, tattoo, agencies, consultants, trades.',
  },
  { value: 'member', label: 'Members', hint: 'Gyms, clubs, associations, communities.' },
  { value: 'guest', label: 'Guests', hint: 'Restaurants, hospitality, events, venues.' },
  { value: 'patient', label: 'Patients', hint: 'Clinics, dental, wellness, therapy.' },
  { value: 'subscriber', label: 'Subscribers', hint: 'Publishers, media, memberships, content.' },
  { value: 'donor', label: 'Donors', hint: 'Nonprofits and charities.' },
  { value: 'student', label: 'Students', hint: 'Courses, coaching, tutoring, education.' },
];

/** Every form of the noun a surface needs. `one`/`many` lower-case for mid-
 *  sentence, `One`/`Many` capitalised for labels, headings and buttons. */
export interface AudienceVocab {
  key: AudienceNoun;
  one: string;
  many: string;
  One: string;
  Many: string;
}

const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
const KEYS = new Set(AUDIENCE_NOUN_OPTIONS.map((option) => option.value));

/** Resolve any stored value to a full vocab, defaulting unknown/absent to
 *  'customer' so a surface always has words. */
export function resolveAudienceVocab(noun: string | undefined | null): AudienceVocab {
  const key = (noun && KEYS.has(noun as AudienceNoun) ? noun : 'customer') as AudienceNoun;
  return { key, one: key, many: `${key}s`, One: cap(key), Many: `${cap(key)}s` };
}

/** The active tenant's audience vocabulary. Rides the cached `useTenant` read,
 *  so it costs no extra request. */
export function useAudienceVocab(): AudienceVocab {
  const { data } = useTenant();
  return resolveAudienceVocab(data?.audienceNoun);
}

/** Set the tenant's audience noun. Admin-only on the server; invalidates the
 *  tenant read so the whole CRM re-labels at once. */
export function useSetAudienceNoun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (audienceNoun: AudienceNoun) =>
      api.patch<{ audienceNoun: AudienceNoun }>('/v1/tenant/audience', { audienceNoun }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });
}
