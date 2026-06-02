// Dashboard shell manifest for the next-gen Builder (docs/40 composition model).
//
// A first-class `builder` module (indigo, the site-building lineage) owning the
// `/builder` route prefix. It is surfaced in the nav as an in-development module
// (see the dashboard layout) rather than via the per-tenant feature flag, since
// it has no backend gate yet. Site Builder (`/sitebuilder`, the legacy
// `storefront` module) stays in place until the Builder fully replaces it — the
// two coexist in the rail for now; when Site Builder is dropped, `storefront`
// goes with it.

import type { ModuleManifest } from '@sparx/ui/shell';
import { Boxes, Component, File, Fingerprint, Globe } from 'lucide-react';

export const builderManifest: ModuleManifest = {
  id: 'builder',
  label: 'Builder',
  icon: Boxes,
  routePrefix: '/builder',
  sections: [
    // Brand — the tenant identity (color/type/rounding) the canvas renders in.
    // The current /sitebuilder/brand surface migrates here.
    { id: 'brand', label: 'Brand', icon: Fingerprint, href: '/builder/brand' },
    // Site — the whole tree: layouts, zones (header/footer/sidebar), navigation.
    { id: 'site', label: 'Site', icon: Globe, href: '/builder/site' },
    // Page — the page-template editor (the backbone built first).
    { id: 'page', label: 'Page', icon: File, href: '/builder/page' },
    // Component — the data-aware component catalog (Tier 2) + authoring.
    { id: 'component', label: 'Component', icon: Component, href: '/builder/component' },
  ],
  actions: [],
  entityTypes: [],
};
