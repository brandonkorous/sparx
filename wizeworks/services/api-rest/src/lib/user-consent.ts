// A person's cookie/tracking consent, on their own `users` row.
//
// It lives in `users.preferences.consent`, the per-user blob that also carries
// view defaults and tour outcomes; the merge below keeps every key it does not
// own. The row is written under the person's HOME business: RLS lets a member
// read their own row from a business they joined, never write it there
// (sparx persona issue 122).
//
// Three states, and the absence of the key is one of them: absent is "never
// asked", which re-asks; `analytics: false` is "asked, declined". Nothing here
// writes a default: a value lands only when a person answers.

import { withTenant } from '@wizeworks/db';

export interface ConsentRecord {
  analytics: boolean;
  /** ISO time of the answer. Empty on an older record that carried none. */
  at: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readConsent(userId: string, homeTenantId: string): Promise<ConsentRecord | null> {
  return withTenant({ tenantId: homeTenantId }, async (tx) => {
    const row = await tx.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const consent = record(record(row?.preferences).consent);
    return typeof consent.analytics === 'boolean'
      ? { analytics: consent.analytics, at: typeof consent.at === 'string' ? consent.at : '' }
      : null;
  });
}

export async function writeConsent(
  userId: string,
  homeTenantId: string,
  analytics: boolean
): Promise<ConsentRecord> {
  const consent = { analytics, at: new Date().toISOString() };
  await withTenant({ tenantId: homeTenantId }, async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    await tx.user.update({
      where: { id: userId },
      data: { preferences: { ...record(before?.preferences), consent } },
    });
  });
  return consent;
}
