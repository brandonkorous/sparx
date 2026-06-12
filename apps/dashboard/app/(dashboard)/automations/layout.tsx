// Automations is a PLATFORM capability, not a gated module (docs/81 §1, §3):
// there is no `automations` slug and no ModuleGate — the surface is reachable
// whenever the tenant has ≥1 trigger-capable module active (the page itself
// enforces that). We still wrap in a ModuleProvider so the surface adopts the
// platform brand accent (Sparx Indigo) for `color="module"` / `variant="module"`,
// matching how SEO/Marketplace read as platform-level rather than any one module.

import { ModuleProvider } from '@sparx/ui';

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleProvider module="platform">{children}</ModuleProvider>;
}
