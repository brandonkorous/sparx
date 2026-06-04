import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// A tenant without the AI module sees the activation upsell; with it active, the
// inner page renders (its "coming online" preview until the real UI ships). The
// gate re-checks on the next request after a /settings/modules flip
// (revalidatePath('/ai', 'layout')).
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="ai">
      <ModuleGate module="ai">{children}</ModuleGate>
    </ModuleProvider>
  );
}
