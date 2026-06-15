// /builder/governance/sections — the Brand sections tab (docs/61 §6 Phase 6b).
// The brand-designer's archetype catalog: the curated section starting points
// authors stamp from the Add palette. Chrome (header + tabs) lives in the parent
// governance layout.

import { requireSession } from '@sparx/auth';

import { getArchetypes } from '../../_governance/lib/api';
import { ArchetypeCatalog } from '../../_governance/components/archetype-catalog';

export const dynamic = 'force-dynamic';

export default async function BuilderGovernanceSectionsPage() {
  const [session, rows] = await Promise.all([requireSession(), getArchetypes()]);
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return <ArchetypeCatalog rows={rows} canEdit={canEdit} />;
}
