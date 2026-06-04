import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// CRM module gate lives here, not on each page.tsx, so every route under
// /crm/* — landing, sub-tabs, detail routes, new-forms — gates from one place.
// Layouts in Next.js App Router are preserved across navigation within the
// same segment, so visiting /crm then /crm/pipelines reuses the gate result. A
// module flip via /settings/modules calls revalidatePath('/crm', 'layout') so
// the next request re-checks.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="crm">
      <ModuleGate module="crm">{children}</ModuleGate>
    </ModuleProvider>
  );
}
