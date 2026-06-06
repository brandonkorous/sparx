// Dashboard shell manifest for the Builder module (docs/40 composition model).
//
// `builder` is the billable site-building module (indigo, the site-building
// lineage) owning the `/builder` route prefix — the foundation module formerly
// marketed as "Storefront". The legacy Site Builder (`/sitebuilder`, manifest
// id `storefront`) still owns the theme/publish surfaces not yet migrated into
// /builder; the dashboard layout surfaces it alongside Builder until that
// migration completes, at which point the `storefront` id retires.

import type { ModuleManifest } from '@sparx/ui/shell';
import { Boxes, Component, File, Fingerprint, Globe, LayoutTemplate, Mail } from 'lucide-react';

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
    // Brand — the tenant identity (color/type/rounding) the canvas renders in.
    // The current /sitebuilder/brand surface migrates here.
    { id: 'brand', label: 'Brand', icon: Fingerprint, href: '/builder/brand' },
    // Site — the whole tree: layouts, zones (header/footer/sidebar), navigation.
    { id: 'site', label: 'Site', icon: Globe, href: '/builder/site' },
    // Page — the page-template editor (the backbone built first).
    { id: 'page', label: 'Page', icon: File, href: '/builder/page' },
    // Email — the Email Builder: one self-contained email per document (docs/52).
    { id: 'email', label: 'Email', icon: Mail, href: '/builder/email' },
    // Components — the catalog of building blocks (Tier-1 primitives + Tier-2
    // data-aware components) a template composes from (docs/51 §4.2).
    { id: 'component', label: 'Components', icon: Component, href: '/builder/components' },
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
