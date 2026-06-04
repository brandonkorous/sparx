import { ModuleGate } from '../../../components/module-gate';

// Builder module gate for every /builder/* surface (page, site, brand,
// component). Deliberately gate-only — NO <ModuleProvider> wrapper — because the
// editor relies on its own full-height `.bx-shell` layout and an extra block
// div would break that height chain. When Builder is disabled, ModuleGate
// renders the upsell (which supplies its own module color); when enabled it
// returns the editor children bare. A /settings/modules flip re-checks on the
// next request (revalidatePath('/builder', 'layout')).
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="builder">{children}</ModuleGate>;
}
