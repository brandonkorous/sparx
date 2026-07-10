import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// A tenant without Scheduling sees the activation upsell; with it active, the
// inner pages render. The gate re-checks on the next request after a
// /settings/modules flip (revalidatePath('/scheduling', 'layout')).
export default function SchedulingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="scheduling" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="scheduling">{children}</ModuleGate>
    </ModuleProvider>
  );
}
