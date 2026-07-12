import { ModuleGate } from '../../../../components/module-gate';

// NOTE: gated on `crm` only, matching pre-existing behavior — unlike orders,
// this section wasn't widened. A b2b-only tenant without CRM hits the same
// upsell a commerce-only tenant used to hit on Orders (b2b REQUIRES commerce,
// not crm, per packages/modules/src/index.ts's REQUIRES graph) — a real,
// analogous gap, left as a known follow-up rather than fixed here.
export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="crm">{children}</ModuleGate>;
}
