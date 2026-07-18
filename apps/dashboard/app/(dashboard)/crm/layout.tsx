import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Straight `crm` gate. This used to be widened to `['crm', 'commerce']` — with
// eight per-section layout.tsx files narrowing back down — purely because
// Orders lived under /crm and a commerce-only tenant had to reach it. Commerce
// and B2B now have their own order routes (/commerce/orders, /b2b/orders) over
// the shared /v1/orders root, so every section under /crm is genuinely
// CRM-exclusive again and the whole workaround is gone.
//
// KNOWN GAP (carried over from the deleted crm/b2b/layout.tsx, unchanged by
// this work): /crm/b2b — B2B accounts — sits behind this `crm` gate, so a
// tenant on B2B + Commerce but WITHOUT CRM cannot reach it. B2B requires
// commerce, not crm (packages/modules/src/index.ts REQUIRES graph), so that is
// the same class of mis-scoping Orders just had. /b2b/accounts is the B2B
// module's own account route; consolidating the two is the real fix.
// A module flip via /settings/modules calls revalidatePath('/crm', 'layout')
// so the next request re-checks.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="crm" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="crm">{children}</ModuleGate>
    </ModuleProvider>
  );
}
