// @sparx/blueprints — the Blueprint manifest FORMAT: its schema, integrity
// validator, three-way merge and site capture (docs/54). Zod-only (no DB, no
// React): safe to import from the installer worker, api-rest, and the dashboard
// marketplace alike.
//
// THERE IS NO CATALOG HERE. A `registry` module used to export an in-code map of
// blueprints, kept deliberately empty because the real catalog is the marketplace
// rows — so every caller's "fall back to the registry" branch could only ever
// return null. The catalog is rows; this package is the format they hold.

export * from './manifest';
export * from './refs';
export * from './validate';
export * from './merge';
export * from './capture';
