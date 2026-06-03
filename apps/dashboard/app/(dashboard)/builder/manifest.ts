// Dashboard shell manifest for the Builder module (docs/40 composition model).
//
// `builder` is the billable site-building module (indigo, the site-building
// lineage) owning the `/builder` route prefix — the foundation module formerly
// marketed as "Storefront". The legacy Site Builder (`/sitebuilder`, manifest
// id `storefront`) still owns the theme/publish surfaces not yet migrated into
// /builder; the dashboard layout surfaces it alongside Builder until that
// migration completes, at which point the `storefront` id retires.

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
