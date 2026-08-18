// Resolves a marketing module's page data. The hand-coded TS in lib/modules.ts
// is the source of truth: module pages were briefly CMS-backed via a `module`
// content type, but that type was reclassified into builder components
// (docs/51 §7), so the static map is authoritative again. Kept as its own
// zero-React helper so the edge-runtime OG / Twitter image routes can import it
// without dragging react-dom into their bundles.

import { MODULES, type ModuleMeta, type ModulePageSlug } from '@/lib/modules';

export function loadModuleData(slug: ModulePageSlug): ModuleMeta {
  return MODULES[slug];
}
