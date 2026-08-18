// @wizeworks/social/service — the DB-backed social post + lifecycle service.
//
// Kept behind this subpath (NOT the main `@wizeworks/social` barrel) exactly like
// `@wizeworks/social/crypto`: the main barrel is pure types + renderer + registry,
// safe to pull into the composer UI bundle. This module imports `@wizeworks/db`, so
// it must never leak into that bundle — only backend transports (api-rest routes,
// api-mcp tools) import it.

export type { SocialContext } from './context.js';
export * from './posts.js';
export * from './lifecycle.js';
export * from './connections.js';
export * from './readiness.js';
export * from './hashtags.js';
export * from './slots.js';
export * from './inbox.js';
export * from './best-time.js';
export * from './compose-seed.js';
export * from './bulk.js';
