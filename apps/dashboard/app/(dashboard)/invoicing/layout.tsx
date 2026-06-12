import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Invoicing module gate lives here, not on each page.tsx, so every route under
// /invoicing/* — documents list, the document editor, templates — gates from one
// place. A module flip via /settings/modules calls revalidatePath('/invoicing',
// 'layout') so the next request re-checks (docs/87 §14).
export default function InvoicingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="invoicing">
      <ModuleGate module="invoicing">{children}</ModuleGate>
    </ModuleProvider>
  );
}
