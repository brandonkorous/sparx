// @sparx/social — public barrel.
//
// The SocialAdapter contract + normalized types, the per-platform constraints, the
// one-post→N-platforms renderer, and the adapter registry (docs/133). Pure types +
// pure logic + a registry singleton — no DB, no React, no network — safe to import
// from a backend service AND from the composer UI (which uses the renderer +
// constraints for author-time validation).
//
// The server-only token crypto is NOT re-exported here — it lives behind the
// `@sparx/social/crypto` subpath so the composer bundle never pulls node:crypto.

export type {
  SocialPlatform,
  PlatformConstraints,
  MediaKind,
  MediaRef,
  ComposedPost,
  TargetOverride,
  RenderedPost,
  SocialAuth,
  SocialTokens,
  SocialConnectContext,
  SocialTargetRef,
  SocialPublishResult,
  SocialPostMetrics,
  SocialAdapter,
} from './types.js';

export { PLATFORM_CONSTRAINTS, constraintsFor } from './constraints.js';

export {
  SOCIAL_CATALOG,
  getSocialDescriptor,
  type SocialPlatformDescriptor,
  type SocialPlatformPhase,
} from './catalog.js';

export {
  renderForTarget,
  renderForTargets,
  type RenderIssue,
  type RenderedTarget,
  type RenderTargetSpec,
} from './renderer.js';

export {
  registerSocialAdapter,
  getSocialAdapter,
  requireSocialAdapter,
  hasSocialAdapter,
  listSocialAdapters,
  isPlatformConnectable,
  _resetSocialRegistryForTest,
} from './registry.js';

// Error classification for the publish drain: a status-bearing error + the predicate the
// worker uses to retry transient failures (5xx / 429 / network) but fail permanent ones
// (4xx) fast, instead of burning every attempt on a request that will never succeed.
export { HttpError, isRetryableError } from './adapters/_http.js';
