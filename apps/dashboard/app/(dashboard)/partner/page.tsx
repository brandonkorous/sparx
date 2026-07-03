import { api } from '@/lib/api-rest-client';

import type { PartnerOverview, PartnerProfile } from './_lib/types';
import { getPartnerAccess } from './_lib/access';
import { PartnerJoinLanding } from './_components/join-landing';
import { PartnerAccessLocked } from './_components/partner-access-locked';
import { PartnerOverviewDashboard } from './_components/overview-dashboard';

// Partner Portal — Overview (docs/114 §B.7). The portal root, gated on the
// existence of a `partners` row (NOT a module, D8) AND the user's role. Three
// states resolve the whole screen:
//   • the org hasn't joined     → the "Become a Sparx Partner" recruit/upsell landing
//   • joined, but this member can't operate it (not owner/admin/partner)
//                                → the "ask an owner/admin" access-locked state
//   • joined + operator         → the Finance-style KPI dashboard
// `profile` is viewer-gated so every member can learn whether the org is a
// partner; `overview` (earnings) is ops-gated, so only operators fetch it.

export const dynamic = 'force-dynamic';

export default async function PartnerOverviewPage() {
  const [{ canOperate, canJoin }, profile] = await Promise.all([
    getPartnerAccess(),
    api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null),
  ]);

  if (!profile) return <PartnerJoinLanding canJoin={canJoin} />;
  if (!canOperate) return <PartnerAccessLocked />;

  const overview = await api.get<PartnerOverview | null>('/v1/partner/overview').catch(() => null);
  if (!overview) return <PartnerAccessLocked />;

  return <PartnerOverviewDashboard overview={overview} />;
}
