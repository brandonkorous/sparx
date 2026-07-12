import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Orders is a commerce concept that happens to be nested under the /crm URL
// segment for historical reasons — a commerce-only tenant (no CRM module)
// must still be able to view/act on their own orders (Returns, Shippo
// labels, etc.), so this outer gate is widened to `['crm', 'commerce']`
// rather than `crm` alone. Every OTHER section under /crm (customers, deals,
// pipelines, segments, tasks, duplicates, reports, b2b) has its own nested
// layout.tsx that narrows back down to `crm`-only, so a commerce-only tenant
// still correctly hits the upsell there — only Orders (and this bare
// /crm overview, unreachable via nav for such a tenant anyway since the left
// nav only lists enabled modules) gets the wider check.
// A module flip via /settings/modules calls revalidatePath('/crm', 'layout')
// so the next request re-checks.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="crm" className="flex h-full min-h-0 flex-col">
      <ModuleGate module={['crm', 'commerce']}>{children}</ModuleGate>
    </ModuleProvider>
  );
}
