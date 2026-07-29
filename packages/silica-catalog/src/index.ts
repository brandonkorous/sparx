// @sparx/silica-catalog — sparx's silica-native domain catalog.
//
// The commerce/CRM composites silica's shipped block library doesn't cover,
// authored as id-free @wizeworks/silicaui-html `Node` factories, plus the grouped
// palette metadata the dashboard editor host merges into silica's Insert palette
// via `mergeCatalog`. React-free (imports only silicaui-html), so the storefront
// render can consume the same factories the editor does — one catalog, no drift.

export * from './types';
export * from './attr-binding';
export * from './conditional';
export * from './placeholder';
export * from './commerce';
export * from './scheduling';
export * from './cms';
export * from './record-templates';
export * from './vocabulary-check';
export * from './vocabulary-patterns';
export * from './host-nodes';
export * from './ensure-ids';
export * from './upgrade-frame';
export * from './catalog';
export * from './sections';
export * from './site-chrome';
export * from './site';
export * from './render';
export * from './responsive-images';
