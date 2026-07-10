// @sparx/silica-catalog — sparx's silica-native domain catalog.
//
// The commerce/CRM composites silica's shipped block library doesn't cover,
// authored as id-free @wizeworks/silicaui-html `Node` factories, plus the grouped
// palette metadata the dashboard editor host merges into silica's Insert palette
// via `mergeCatalog`. React-free (imports only silicaui-html), so the storefront
// render can consume the same factories the editor does — one catalog, no drift.

export * from './types';
export * from './attr-binding';
export * from './commerce';
export * from './catalog';
export * from './site-chrome';
export * from './site';
export * from './render';
