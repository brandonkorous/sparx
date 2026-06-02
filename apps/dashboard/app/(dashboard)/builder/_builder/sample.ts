// The module chrome registry — the modules the editor surfaces in the context
// bar and the "From your modules" palette group.
//
// The mock binding data that used to live here (SAMPLE_DATA / BIND_PATHS /
// ITEM_PATHS) is gone: the editor now consumes the REAL binding schema
// (docs/43, the keystone) via _builder/binding-catalog — the inspector picker,
// the canvas preview, and the layer chips all derive from the tenant's actual
// CMS content types + the code-defined Commerce/CRM sources. The page TREES the
// editor opens with live in @sparx/builder-schemas (STARTER_PAGES), seeded
// server-side on a tenant's first load (docs/41 §5).

// ── Active modules (drives the context bar + palette) ────────────────────────

export interface ModuleInfo {
  key: string;
  label: string;
  /** The module's brand color (docs/sparx-brand-guide). */
  color: string;
  on: boolean;
}

export const MODULES: ModuleInfo[] = [
  { key: 'cms', label: 'CMS', color: '#14b8a6', on: true },
  { key: 'commerce', label: 'Commerce', color: '#f97316', on: true },
  { key: 'crm', label: 'CRM', color: '#06b6d4', on: true },
  { key: 'events', label: 'Events', color: '#a855f7', on: false },
];
