import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '../../../components/module-gate';

// Inventory module gate lives here, not on each page.tsx, so every route under
// /inventory/* gates from one place — mirrors invoicing/layout.tsx (the other
// bundled-free-with-commerce/b2b module). A module flip via /settings/modules
// calls revalidatePath('/inventory', 'layout') so the next request re-checks.
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="inventory" className="flex h-full min-h-0 flex-col">
      <ModuleGate module="inventory">{children}</ModuleGate>
    </ModuleProvider>
  );
}
