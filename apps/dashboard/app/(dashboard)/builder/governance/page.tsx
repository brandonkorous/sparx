// /builder/governance — the Utility allowlist tab (docs/61 §8 Phase 6b). The
// tenant's tighten-only safety policy over which styling classes any author can
// compile, across all their sites. Chrome (header + tabs) lives in layout.tsx.

import { requireSession } from '@sparx/auth';

import { getAllowlist, getBlockedClasses } from '../_governance/lib/api';
import { AllowlistCenter } from '../_governance/components/allowlist-center';

export const dynamic = 'force-dynamic';

export default async function BuilderGovernanceAllowlistPage() {
  const [session, allowlist, blocked] = await Promise.all([
    requireSession(),
    getAllowlist(),
    getBlockedClasses(),
  ]);
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return <AllowlistCenter initial={allowlist} blocked={blocked} canEdit={canEdit} />;
}
