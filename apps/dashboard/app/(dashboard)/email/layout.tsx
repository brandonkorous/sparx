import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Email module gate lives here, not on each page.tsx, so every route under
// /email/* — overview, broadcasts, automations, templates, suppressions,
// domains, settings, detail routes, new-forms — gates from one place. A module
// flip via /settings/modules calls revalidatePath('/email', 'layout') so the
// next request re-checks.
export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="email" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="email">{children}</ModuleGate>
    </ModuleProvider>
  );
}
