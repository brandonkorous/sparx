// @sparx/builder-schemas — the canonical node-tree + page contract and curated
// starter pages, shared by the service, REST, and the /builder editor
// (docs/41-builder-page-model.md). Zod-only (no DB, no React) so it's safe to
// import from the editor's client components AND the server service layer.

export * from './node';
export * from './element';
export * from './html-import';
export * from './box-to-class';
export * from './class-utils';
export * from './page';
export * from './layout';
export * from './email';
export * from './email-tokens';
export * from './merge-tags';
export * from './email-design';
export * from './email-style';
export * from './component';
export * from './starters';
export * from './archetypes';
export * from './default-emails';
export * from './binding';
export * from './nav';
export * from './runtime';
export * from './import-export';
export * from './catalog';
export * from './site-chrome';
