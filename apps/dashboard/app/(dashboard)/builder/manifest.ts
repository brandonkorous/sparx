// Dashboard shell manifest for the Builder module (docs/40 composition model).
//
// `builder` is the billable site-building module (indigo, the site-building
// lineage) owning the `/builder` route prefix — the foundation module formerly
// marketed as "Storefront". The legacy Site Builder (`/sitebuilder`, manifest
// id `storefront`) still owns the theme/publish surfaces not yet migrated into
// /builder; the dashboard layout surfaces it alongside Builder until that
// migration completes, at which point the `storefront` id retires.

import type { ModuleManifest } from '@sparx/ui/shell';
import { Boxes, Component, Globe, Inbox, LayoutTemplate, Mail, Pencil } from 'lucide-react';

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
    // above Brand & Theme. Its href is inside `routePrefix`, so it claims the active panel.
    { id: 'blueprints', label: 'Blueprints', icon: LayoutTemplate, href: '/builder/blueprints' },
    // Site — the active web property's IDENTITY, on its own surface (docs/49): the
    // customer-facing name, tagline, light/dark logo, favicon, and social links —
    // the fields the silica frame binds through `site.identity` / `site.social`.
    // Theme (colours/type/shape) is now owned by the silica builder itself, so the
    // former "Brand & Theme" surface was split: identity landed here, theme moved
    // into the editor. `/builder/brand` redirects here.
    { id: 'site', label: 'Site', icon: Globe, href: '/builder/site' },
    // Editor — the unified studio (docs/builder/03): site layout › the active page,
    // on one live canvas. Theme editing lives on its own Brand & Theme surface
    // (above); the editor canvas still PREVIEWS the saved theme but doesn't edit it.
    { id: 'editor', label: 'Editor', icon: Pencil, href: '/builder/studio' },
    // Email — the Email Builder: one self-contained email per document (docs/52).
    { id: 'email', label: 'Email', icon: Mail, href: '/builder/email' },
    // Components — the catalog of building blocks (Tier-1 primitives + Tier-2
    // data-aware components) a template composes from (docs/51 §4.2).
    { id: 'component', label: 'Components', icon: Component, href: '/builder/components' },
    // Form submissions — the inbox of messages visitors send through Contact form
    // blocks (docs/115). A Builder-module surface: forms are a site-building
    // feature, so the section rides here rather than in CRM.
    { id: 'forms', label: 'Form submissions', icon: Inbox, href: '/builder/forms' },
    // Governance — the brand-designer's guardrails (docs/61 §8 Phase 6b): the
    // tighten-only utility allowlist and the brand-section archetype set. The full
    // implementation lives under `/builder/governance` (page + _governance/*) but
    // is TEMPORARILY HIDDEN — it isn't user-ready yet, so the nav item is removed
    // and the route redirects to the Builder overview. To re-enable, restore this
    // entry (icon: ShieldCheck) and drop the redirect in governance/page.tsx +
    // governance/sections/page.tsx.
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
    // A tenant SITE (web property), managed at /settings/sites. Hosted on the
    // builder manifest because "settings" is not a module — findEntityType only
    // iterates module manifests — while the routePrefix still points at the
    // settings route. Detail = General / Domains / Modules tabs (docs/49).
    {
      id: 'site',
      label: 'Site',
      routePrefix: '/settings/sites',
      hasDetailView: true,
    },
  ],
};
