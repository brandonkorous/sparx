import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Commerce module gate lives here, not on each page.tsx, so every route under
// /commerce/* gates from one place. The inner pages all assume Commerce is
// enabled and call api-rest directly; a module flip via /settings/modules calls
// revalidatePath('/commerce', 'layout') so the next request re-checks the flag.
export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="commerce" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="commerce">{children}</ModuleGate>
    </ModuleProvider>
  );
}
