// Shared customer display-name resolution. Detail/list surfaces show a human
// label (full name → company → email) instead of a raw customer id; this is the
// single source of truth for that fallback chain + the Prisma select it needs,
// so every service (returns, carts, subscriptions, …) resolves names identically.

import type { Prisma } from '@sparx/db';

/** The minimal customer columns `customerDisplayName` reads. Spread into a
 *  Prisma `select` so the literal `true`s survive result-type inference. */
export const CUSTOMER_NAME_SELECT = {
  firstName: true,
  lastName: true,
  company: true,
  email: true,
} satisfies Prisma.CustomerSelect;

export interface CustomerNameParts {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

/** Best human label for a customer: full name → company → email. Returns null
 *  when nothing usable exists so the UI can fall back to a short id. */
export function customerDisplayName(c: CustomerNameParts | null): string | null {
  if (!c) return null;
  // First non-empty of: full name → company → email. (`??` won't do — an empty
  // string must fall through to the next candidate, which nullish-coalescing skips.)
  const candidates = [[c.firstName, c.lastName].filter(Boolean).join(' '), c.company, c.email];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
