// The SocialAdapter registry (docs/133 §4) — the process-wide map from a
// SocialPlatform to its adapter instance.
//
// Both api-rest (connect/callback + compose) and social-worker (publish) call the
// built-in-adapter registration once at boot; adding a platform is one adapter file +
// one registration line, with no change to the worker dispatch core. Mirrors
// @sparx/channels' registry. Pure (a Map + accessors) — no adapter is imported here,
// so this module stays client-safe; the adapters (which pull network + crypto) are
// registered from the server side.

import type { SocialAdapter, SocialPlatform } from './types.js';

const registry = new Map<SocialPlatform, SocialAdapter>();

/** Register an adapter (idempotent per platform — last registration wins, which
 *  keeps a double-boot or a test re-register safe). */
export function registerSocialAdapter(adapter: SocialAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getSocialAdapter(platform: SocialPlatform): SocialAdapter | undefined {
  return registry.get(platform);
}

/** The adapter for a platform, or throw — the worker uses this on the publish path,
 *  where a missing adapter is a wiring bug, not a user error. */
export function requireSocialAdapter(platform: SocialPlatform): SocialAdapter {
  const adapter = registry.get(platform);
  if (!adapter) throw new Error(`No social adapter registered for platform "${platform}".`);
  return adapter;
}

export function hasSocialAdapter(platform: SocialPlatform): boolean {
  return registry.has(platform);
}

export function listSocialAdapters(): SocialAdapter[] {
  return [...registry.values()];
}

/** Whether a platform is registered AND its sparx OAuth app is configured — the gate
 *  the connect API uses to mark a platform connectable vs. `coming_soon`. */
export function isPlatformConnectable(platform: SocialPlatform): boolean {
  const adapter = registry.get(platform);
  return !!adapter && adapter.isConfigured();
}

/** Test hook — drop all registrations so a suite starts from a known-empty registry. */
export function _resetSocialRegistryForTest(): void {
  registry.clear();
}
