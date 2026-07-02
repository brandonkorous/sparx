import { api } from '@/lib/api-rest-client';

import type { PartnerOverview } from './_lib/types';
import { PartnerJoinLanding } from './_components/join-landing';
import { PartnerOverviewDashboard } from './_components/overview-dashboard';

// Partner Portal — Overview (docs/114 §B.7). The portal root, gated on the
// existence of a `partners` row (NOT a module, D8). `GET /v1/partner/overview`
// returns the KPI bundle for a partner or `null` for a tenant that hasn't joined,
// so this one read decides the whole screen: a non-partner gets the "Become a
// Sparx Partner" join landing; a partner gets the Finance-style KPI dashboard.

export const dynamic = 'force-dynamic';

export default async function PartnerOverviewPage() {
  const overview = await api.get<PartnerOverview | null>('/v1/partner/overview').catch(() => null);

  if (!overview) {
    return <PartnerJoinLanding />;
  }

  return <PartnerOverviewDashboard overview={overview} />;
}
