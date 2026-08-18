// A tenant's INBOUND partner relationship (docs/114 §B.7) — "who referred / has a
// stake in MY account", the mirror of the partner's own outbound practice
// (service.ts). The referral + partner rows live in the PARTNER's tenant scope,
// so a referred tenant can't read them under normal RLS; a tenant is legitimately
// entitled to know whether it has a Sparx partner, so this resolves the partner
// via `withSystem` (RLS-escaped, platform scope) and returns only the non-
// sensitive, client-facing projection — never the partner's commission terms.

import { withSystem } from '@wizeworks/db';

export interface ReferredByPartner {
  partnerId: string;
  displayName: string;
  /** informal | registered | certified — the partner's current tier. */
  tier: string;
  /** ISO timestamp of when this tenant signed up under the partner's link. */
  referredAt: string;
  /** pending | active | churned | forfeited — the referral's lifecycle. */
  referralStatus: string;
  /** Whether the partner has a public `/partners/:id` profile to link to
   *  (active + directory-visible). A pending partner is still named, just not
   *  linkable. */
  directoryListed: boolean;
}

export interface PartnerRelationship {
  referredBy: ReferredByPartner | null;
}

export const partnerRelationshipService = {
  /** The partner (if any) that referred this tenant. Suspended partners are
   *  treated as no relationship — the tie is dormant and shouldn't be surfaced. */
  async forReferredTenant(referredTenantId: string): Promise<PartnerRelationship> {
    const referral = await withSystem((tx) =>
      tx.partnerReferral.findUnique({
        where: { referredTenantId },
        select: { partnerId: true, signupAt: true, status: true },
      })
    );
    if (!referral) return { referredBy: null };

    const partner = await withSystem((tx) =>
      tx.partner.findUnique({
        where: { id: referral.partnerId },
        select: { id: true, displayName: true, tier: true, status: true, directoryVisible: true },
      })
    );
    if (!partner || partner.status === 'suspended') return { referredBy: null };

    return {
      referredBy: {
        partnerId: partner.id,
        displayName: partner.displayName,
        tier: partner.tier,
        referredAt: referral.signupAt.toISOString(),
        referralStatus: referral.status,
        directoryListed: partner.status === 'active' && partner.directoryVisible,
      },
    };
  },
};
