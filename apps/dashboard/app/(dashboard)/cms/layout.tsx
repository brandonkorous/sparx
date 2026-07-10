import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Wrapping the entire CMS subtree in ModuleProvider shifts --module-active to
// teal for every component inside, and ModuleGate ensures a tenant without the
// CMS module sees the activation upsell rather than the editor. A module flip
// via /settings/modules calls revalidatePath('/cms', 'layout') so the next
// request re-checks.
export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="cms" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="cms">{children}</ModuleGate>
    </ModuleProvider>
  );
}
