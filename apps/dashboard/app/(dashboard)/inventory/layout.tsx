import { ModuleProvider } from '@sparx/ui';

// Inventory is gated at the API tier (requireInventoryModule) and renders
// ungated on the dashboard side today, so this layout intentionally adds NO
// ModuleGate — it only supplies the module's Amber color to every /inventory/*
// route (the overview, sources, locations) via ModuleProvider, the same way the
// other module layouts do.
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="inventory" className="flex h-full min-h-0 flex-col">
      {children}
    </ModuleProvider>
  );
}
