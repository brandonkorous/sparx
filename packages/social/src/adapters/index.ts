// Built-in social adapters + their registration entrypoint (docs/133 §4).
//
// Concrete adapters live here (one file per platform) alongside the shared `_http`
// helpers — mirroring @sparx/channels' `src/adapters/`. The server-safe platform
// CATALOG (display metadata) stays in `../catalog.ts` with NO adapter import, so the
// composer UI renders the connect cards without pulling network code.
//
// Both api-rest (connect/callback + compose) and social-worker (publish) call
// `registerBuiltinSocialAdapters()` once at boot. Adding a platform = one adapter file
// + one line here, with no change to the worker dispatch core.

import { getSocialAdapter, registerSocialAdapter } from '../registry.js';
import { registerSocialIntegrations } from '../integration.js';
import { GoogleBusinessAdapter } from './google-business.js';
import { LinkedInAdapter } from './linkedin.js';
import { FacebookPageAdapter } from './facebook.js';
import { InstagramAdapter } from './instagram.js';
import { ThreadsAdapter } from './threads.js';
import { PinterestAdapter } from './pinterest.js';
import { TikTokAdapter } from './tiktok.js';
import { YouTubeAdapter } from './youtube.js';

let registered = false;

/** Register every built-in adapter (idempotent — safe to call from more than one
 *  route module / worker boot). */
export function registerBuiltinSocialAdapters(): void {
  if (registered) return;
  registerSocialAdapter(new GoogleBusinessAdapter());
  registerSocialAdapter(new LinkedInAdapter());
  // Phase 2 — the Meta family (Facebook Pages + Instagram + Threads), one shared app.
  registerSocialAdapter(new FacebookPageAdapter());
  registerSocialAdapter(new InstagramAdapter());
  registerSocialAdapter(new ThreadsAdapter());
  // Phase 3 — the platform tail. X is intentionally absent (its posting API is paid-
  // tier; the adapter is skipped until the tenant commits to it — docs/134 Phase 3).
  registerSocialAdapter(new PinterestAdapter());
  registerSocialAdapter(new TikTokAdapter());
  registerSocialAdapter(new YouTubeAdapter());
  // …and publish the catalog to the shared integration plane, so social accounts appear
  // in the one Integrations panel. Runs after the adapters land so each descriptor's
  // availability reflects a real `isConfigured()`. X has no adapter by design and
  // registers descriptor-only — the catalog says "coming soon" instead of going silent.
  registerSocialIntegrations(getSocialAdapter);
  registered = true;
}

export { GoogleBusinessAdapter } from './google-business.js';
export { LinkedInAdapter } from './linkedin.js';
export { FacebookPageAdapter } from './facebook.js';
export { InstagramAdapter } from './instagram.js';
export { ThreadsAdapter } from './threads.js';
export { PinterestAdapter } from './pinterest.js';
export { TikTokAdapter } from './tiktok.js';
export { YouTubeAdapter } from './youtube.js';
