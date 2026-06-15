// Dashboard shell manifest for the Builder module (docs/40 composition model).
//
// `builder` is the billable site-building module (indigo, the site-building
// lineage) owning the `/builder` route prefix — the foundation module formerly
// marketed as "Storefront". The legacy Site Builder (`/sitebuilder`, manifest
// id `storefront`) still owns the theme/publish surfaces not yet migrated into
// /builder; the dashboard layout surfaces it alongside Builder until that
// migration completes, at which point the `storefront` id retires.

import type { ModuleManifest } from '@sparx/ui/shell';
import { Boxes, Component, LayoutTemplate, Mail, Pencil, ShieldCheck } from 'lucide-react';

export const builderManifest: ModuleManifest = {
  id: 'builder',
  label: 'Builder',
  icon: Boxes,
  routePrefix: '/builder',
  // The contextual panel auto-injects an "Overview" row → `routePrefix`
  // (module-section-nav.tsx), so sections must NOT declare their own — that's
  // what produced the duplicate Overview. List only the sub-surfaces here.
  sections: [
    // Blueprints — the in-Builder view of THIS tenant's installed blueprints
    // (docs/54): status, what each created, review/go-live/reset. The full
    // browse-everything Marketplace stays rail-pinned at /marketplace (platform-wide,
    // reachable when Builder is off, since installing a blueprint enables Builder);
    // /builder/blueprints links out to it. Placed under the auto-injected Overview,
    // above Brand. Its href is inside `routePrefix`, so it claims the active panel.
    { id: 'blueprints', label: 'Blueprints', icon: LayoutTemplate, href: '/builder/blueprints' },
    // Editor — the unified studio (docs/builder/03): brand theme › site layout ›
    // the active page, all on one live canvas. The Phase-7 cutover (docs/builder/07)
    // retired the three split editors — /builder/brand|site|page now redirect to a
    // zone of this one editor — so the sub-nav carries a single Editor entry.
    { id: 'editor', label: 'Editor', icon: Pencil, href: '/builder/studio' },
    // Email — the Email Builder: one self-contained email per document (docs/52).
    { id: 'email', label: 'Email', icon: Mail, href: '/builder/email' },
    // Components — the catalog of building blocks (Tier-1 primitives + Tier-2
    // data-aware components) a template composes from (docs/51 §4.2).
    { id: 'component', label: 'Components', icon: Component, href: '/builder/components' },
    // Governance — the brand-designer's guardrails (docs/61 §8 Phase 6b): the
    // tighten-only utility allowlist (and, Phase 6b Part B, the brand-section
    // archetype set). Owner/admin shape what every author on the tenant can build.
    { id: 'governance', label: 'Governance', icon: ShieldCheck, href: '/builder/governance' },
  ],
  actions: [],
  entityTypes: [
    // A catalog component opened in the drawer/modal detail view. The entity id
    // is the component's registry `type` (e.g. `Button`); routePrefix +
    // `/<type>` resolves the full page at /builder/components/<type>.
    {
      id: 'builder-component',
      label: 'Component',
      routePrefix: '/builder/components',
      hasDetailView: true,
    },
  ],
};
