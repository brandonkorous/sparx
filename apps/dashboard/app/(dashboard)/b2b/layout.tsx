import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// A tenant without B2B sees the activation upsell; with it active, the inner
// page renders (its "coming online" preview until the real UI ships). The gate
// re-checks on the next request after a /settings/modules flip
// (revalidatePath('/b2b', 'layout')).
export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="b2b">
      <ModuleGate module="b2b">{children}</ModuleGate>
    </ModuleProvider>
  );
}
