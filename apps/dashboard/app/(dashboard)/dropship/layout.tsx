import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// A tenant without Dropship sees the activation upsell; with it active, the
// inner page renders (its "coming online" preview until the real UI ships). The
// gate re-checks on the next request after a /settings/modules flip
// (revalidatePath('/dropship', 'layout')).
export default function DropshipLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="dropship">
      <ModuleGate module="dropship">{children}</ModuleGate>
    </ModuleProvider>
  );
}
