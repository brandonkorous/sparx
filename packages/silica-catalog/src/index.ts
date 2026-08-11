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
export * from './utility-pages';
export * from './vocabulary-check';
export * from './vocabulary-patterns';
export * from './host-nodes';
export * from './embed';
export * from './ensure-ids';
export * from './upgrade-frame';
export * from './upgrade-page';
export * from './catalog';
export * from './themes';
export * from './template-themes';
export * from './content-themes';
export * from './portfolio-themes';
export * from './content-ink';
export * from './resolve-sparx-theme';
export * from './custom-colors';
export * from './base-theme';
export * from './sections';
export * from './site-chrome';
export * from './site';
export * from './render';
export * from './responsive-images';

// The first-party theme catalog — sparx’s shelf + silica’s presets, as code.
// The marketplace serves these ahead of any uploaded row; see the file header.
export * from './first-party-themes';

// The first-party component catalog — every section in the Insert palette, as the
// marketplace lists it. Same posture as themes: shipped content is code, not rows.
export * from './first-party-components';
