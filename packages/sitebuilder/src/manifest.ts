// Dashboard shell manifest for the Site Builder (storefront) module.
//
// Imported by the dashboard via `@sparx/sitebuilder/manifest` — keep this file
// dependency-light: types from @sparx/ui/shell, icons from lucide-react,
// nothing else. See docs/24-dashboard-shell.md §3 for the contract.

import type { ModuleManifest } from '@sparx/ui/shell';
import {
  Blocks,
  Fingerprint,
  Image,
  Layers,
  LayoutTemplate,
  PanelTop,
  Palette,
  Plus,
  Rocket,
} from 'lucide-react';

export const sitebuilderManifest: ModuleManifest = {
  id: 'storefront',
  label: 'Site Builder',
  icon: LayoutTemplate,
  routePrefix: '/sitebuilder',
  sections: [
    // Brand is the tenant-level identity foundation (docs/30 §6) — first in the
    // rail, above the presentation layers (theme/design) that read from it.
    { id: 'brand', label: 'Brand', icon: Fingerprint, href: '/sitebuilder/brand' },
    // Theme switching + presentation tokens (the old "Themes" gallery folded in
    // here — theme selection lives in the Design/Theme scope). Route stays
    // /sitebuilder/design until the v2-native theme pane lands (Phase 2 §2.3).
    { id: 'design', label: 'Theme', icon: Palette, href: '/sitebuilder/design' },
    // Layouts — ONE surface for every page layout, organized by target (docs/36
    // §11, P-D). Folds the old per-scope nav (Homepage / Product pages /
    // Collection pages / Pages) into a single grouped index: each target's
    // PageLayouts + a "begin from a Page Template" catalog + the per-target
    // default control. A specific layout opens the canvas editor at /layouts/<id>.
    { id: 'layouts', label: 'Layouts', icon: Layers, href: '/sitebuilder/layouts' },
    // Section Studio — the merchant's own custom section TYPES (docs/38 Phase C):
    // a list of definitions + the authoring editor. A building-block library, so
    // it sits beside Layouts (which composes pages FROM sections).
    { id: 'sections', label: 'Sections', icon: Blocks, href: '/sitebuilder/sections' },
    {
      id: 'navigation',
      label: 'Header & footer',
      icon: PanelTop,
      href: '/sitebuilder/navigation',
    },
    { id: 'publishing', label: 'Publishing', icon: Rocket, href: '/sitebuilder/publishing' },
  ],
  actions: [
    {
      id: 'sitebuilder.layout.create',
      label: 'New layout',
      icon: Plus,
      href: '/sitebuilder/layouts',
    },
    {
      id: 'sitebuilder.media.open',
      label: 'Open media library',
      icon: Image,
      href: '/cms/media',
    },
  ],
  // No entityTypes: a storefront page IS a CMS `page` entity (the cms-editor
  // manifest owns that id + its detail view); a Site Builder PageLayout has its
  // own /sitebuilder/layouts surface, not a shell entity drawer.
  entityTypes: [],
};
