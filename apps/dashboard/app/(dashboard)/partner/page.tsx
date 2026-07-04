import { api } from '@/lib/api-rest-client';

import type { PartnerOverview, PartnerProfile } from './_lib/types';
import { getPartnerAccess } from './_lib/access';
import { PartnerJoinLanding } from './_components/join-landing';
import { PartnerApplicationPending } from './_components/partner-application-pending';
import { PartnerAccessLocked } from './_components/partner-access-locked';
import { PartnerOverviewDashboard } from './_components/overview-dashboard';

// Partner Portal — Overview (docs/114 §B.7). The portal root, gated on the
// existence of a `partners` row (NOT a module, D8) AND the user's role. Four states
// resolve the whole screen:
//   • a partner + operator      → the Finance-style KPI dashboard
//   • a partner, non-operator   → the "ask an owner/admin" access-locked state
//   • not a partner, applied    → the "application in review" state (no auto signup)
//   • not a partner, no app     → the "apply to become a partner" landing (owner/
//                                 admin) or an "ask an owner/admin" note (others)
// `profile` is viewer-gated so every member can learn whether the org is a partner;
// `overview` (earnings) is ops-gated; the application read is admin-gated.

export const dynamic = 'force-dynamic';

interface ApplicationResponse {
  application: { status: string; requestedTier: string } | null;
}

export default async function PartnerOverviewPage() {
  const [{ canOperate, canJoin }, profile] = await Promise.all([
    getPartnerAccess(),
    api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null),
  ]);

  if (profile) {
    if (!canOperate) return <PartnerAccessLocked />;
    const overview = await api
      .get<PartnerOverview | null>('/v1/partner/overview')
      .catch(() => null);
    if (!overview) return <PartnerAccessLocked />;
    return <PartnerOverviewDashboard overview={overview} />;
  }

  // Not a partner. Show an in-review state if they've applied; otherwise the apply
  // landing. (The application read is admin-gated — a non-admin gets null and the
  // landing's own "ask an owner/admin" guidance.)
  const { application } = await api
    .get<ApplicationResponse>('/v1/partner/application')
    .catch(() => ({ application: null }));
  if (application?.status === 'pending') {
    return <PartnerApplicationPending tier={application.requestedTier} />;
  }
  return <PartnerJoinLanding canApply={canJoin} />;
}
