// Automations is a PLATFORM capability, not a gated module (docs/81 §1, §3):
// there is no ModuleGate — the surface is reachable whenever the tenant has ≥1
// trigger-capable module active (the page itself enforces that). It carries its
// own brand identity, though, so we wrap in a ModuleProvider keyed to the
// `automations` accent (Fuchsia) — that drives `color="module"` /
// `variant="module"` and the `var(--module-active*)` tokens the overview reads.

import { ModuleProvider } from '@sparx/ui';

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleProvider module="automations">{children}</ModuleProvider>;
}
