// Cookie-consent helpers shared between the public consent routes and the
// tenant-payload fanout (docs/42 §4). Kept here (not in a route module) so the
// config shape has one definition both readers agree on.

import type { TxClient } from '@sparx/db';

export const CONSENT_CATEGORIES = [
  'strictly_necessary',
  'preferences',
  'analytics',
  'marketing',
] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export const CONSENT_MODES = ['off', 'gdpr', 'ccpa'] as const;
export type ConsentMode = (typeof CONSENT_MODES)[number];

// Categories that require consent. `strictly_necessary` is always on and never
// gates the banner; the banner only appears when the tenant has turned on one
// of these.
const NON_ESSENTIAL: readonly ConsentCategory[] = ['preferences', 'analytics', 'marketing'];

/** The product rule: a blocking/CCPA banner shows only when the tenant runs in
 *  a consent mode AND has enabled at least one non-essential category. A store
 *  with only strictly-necessary cookies gets the quiet "Manage cookies" notice
 *  instead (decided storefront-side from `bannerEnabled=false`). */
export function computeBannerEnabled(mode: string, activeCategories: string[]): boolean {
  return (
    mode !== 'off' && activeCategories.some((c) => NON_ESSENTIAL.includes(c as ConsentCategory))
  );
}

export interface PublicConsentConfig {
  mode: ConsentMode;
  /** All known categories, for the preference-center UI to render rows. */
  categories: readonly ConsentCategory[];
  /** The non-essential categories this tenant actually uses. */
  activeCategories: string[];
  bannerEnabled: boolean;
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug: string;
  policyVersion: string;
}

/** Read ONE SITE's public consent config (docs/131 §3.9), falling back to
 *  mode='off' defaults when no settings row exists (the common case until a
 *  business configures it). Must be called inside `withTenant` so RLS scopes the
 *  read.
 *
 *  There is deliberately no fallback to a sibling site: mode='off' means "we
 *  have not set up a banner here", which is true and safe, whereas inheriting
 *  another business's GDPR configuration would show its banner, its policy
 *  version, and its name to people who never visited it. */
export async function readPublicConsentConfig(
  tx: TxClient,
  tenantId: string,
  propertyId: string
): Promise<PublicConsentConfig> {
  const row = await tx.consentSettings.findUnique({
    where: { tenantId_propertyId: { tenantId, propertyId } },
  });
  const mode = (row?.mode ?? 'off') as ConsentMode;
  const activeCategories = Array.isArray(row?.activeCategories)
    ? (row.activeCategories as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];
  return {
    mode,
    categories: CONSENT_CATEGORIES,
    activeCategories,
    bannerEnabled: computeBannerEnabled(mode, activeCategories),
    bannerTitle: row?.bannerTitle ?? null,
    bannerBody: row?.bannerBody ?? null,
    policyPageSlug: row?.policyPageSlug ?? 'cookie-policy',
    policyVersion: row?.policyVersion ?? '1',
  };
}
