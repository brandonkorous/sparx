// URL slugs for the partner surfaces — bootcamps (§B.5) and partner profiles
// (§B.6). One convention, one implementation: this was `slugify` + `uniqueSlug`
// living privately inside bootcamp-service.ts, and partners needing the same
// thing is exactly the moment a second copy would have been written.
//
// The `exists` callback is what keeps it shared: the two callers differ only in
// which table they probe, not in how a slug is shaped or how a collision is
// broken. Behaviour is unchanged for bootcamps — same normalisation, same 120
// char cap, same 6 attempts, same widening suffix.

import { randomBytes } from 'node:crypto';

/** Lowercase, unicode-aware, every run of non-alphanumerics collapsed to a
 *  single `-`, trimmed, capped at 120 characters. `fallback` covers a name that
 *  normalises to nothing at all (punctuation, or a script with no alphanumerics
 *  under NFKD). */
export function slugify(value: string, fallback: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || fallback
  );
}

/**
 * A slug that is free according to `exists`, preferring the bare base.
 *
 * Six attempts widening from a 4-hex-char suffix, then one 8-char suffix that is
 * returned unchecked — the same shape as `uniqueReferralCode` in service.ts, and
 * for the same reason: at that point looping is less useful than more entropy.
 *
 * Note what `exists` can and cannot see. Both callers probe through RLS, where
 * the visible set is "published/active rows, plus this tenant's own" — so a
 * collision against another tenant's DRAFT bootcamp or PENDING partner is
 * invisible here and surfaces as a unique-violation on insert instead. That is
 * the pre-existing shape of every mint on these tables (referral codes included)
 * and the unique index remains the real guarantee; this function's job is to
 * make the common case produce a readable URL, not to be the constraint.
 */
export async function uniqueSlug(
  value: string,
  fallback: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(value, fallback);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
    if (!(await exists(slug))) return slug;
  }
  return `${base}-${randomBytes(4).toString('hex')}`;
}
