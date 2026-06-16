// /builder/governance/sections — the Brand sections tab (docs/61 §6 Phase 6b).
//
// TEMPORARILY DISABLED alongside the rest of governance (see ../page.tsx): the
// route redirects to the Builder overview. The real implementation is preserved
// untouched in the surrounding files — the archetype catalog
// (_governance/components/archetype-catalog), its data wiring (_governance/lib/*),
// and the service. To re-enable, delete the redirect below and restore the
// original page (see git history) + the manifest nav entry.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BuilderGovernanceSectionsPage() {
  redirect('/builder');
}
