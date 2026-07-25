// @sparx/social/service — the DB-backed social post + lifecycle service.
//
// Kept behind this subpath (NOT the main `@sparx/social` barrel) exactly like
// `@sparx/social/crypto`: the main barrel is pure types + renderer + registry,
// safe to pull into the composer UI bundle. This module imports `@sparx/db`, so
// it must never leak into that bundle — only backend transports (api-rest routes,
// api-mcp tools) import it.

export type { SocialContext } from './context.js';
export * from './posts.js';
export * from './lifecycle.js';
