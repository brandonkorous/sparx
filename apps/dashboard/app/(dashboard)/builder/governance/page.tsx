// /builder/governance — the Utility allowlist tab (docs/61 §8 Phase 6b).
//
// TEMPORARILY DISABLED: the governance surface is built but not yet user-ready,
// so the route redirects to the Builder overview and the nav item is removed from
// manifest.ts. The real implementation is preserved untouched in the surrounding
// files — the service (@sparx/builder governance-service), the allowlist editor
// (_governance/components/allowlist-center), the data wiring (_governance/lib/*),
// and the shared chrome (layout.tsx). To re-enable, delete the redirect below and
// restore the original page (see git history) + the manifest nav entry.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BuilderGovernanceAllowlistPage() {
  redirect('/builder');
}
