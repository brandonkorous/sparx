// Built-in action executors (docs/81 §5.4).
//
// Slice C ships the platform-level effects the engine can execute with no module
// service dependency: the outbound webhook. Module-owned mutating actions
// (crm.*, email.*, commerce.*, b2b.*) are thin calls into EXISTING services
// (§5.4 "never re-implement domain logic"); they register through the same
// `registerAction` seam where the engine is wired with those service packages
// (the worker / seed path in a later slice), keeping this package lean.
//
// Control-flow actions (platform.wait / platform.stop) are NOT registered here —
// the run loop intercepts them before dispatch, since they are engine mechanics
// rather than gated effects.

import type { ActionOutput, EffectInput, TenantCtx } from '../engine-types';
import { webhookEgressGate } from '../gates/builtins';
import { registerNotifyAction } from './notify';
import { registerAction } from './registry';

const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * POST a JSON envelope to an external URL. The `webhook-egress` manifest gate has
 * already vetted the URL (scheme + private-range SSRF guard) before this runs.
 * A non-2xx response throws → the step is recorded `failed` and the run stops
 * (the standard "an action failed, skip the rest" semantics, §5.4).
 */
async function executeWebhook(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
  const url = String(effect.config.url);
  const method =
    typeof effect.config.method === 'string' ? effect.config.method.toUpperCase() : 'POST';
  const extraHeaders =
    effect.config.headers && typeof effect.config.headers === 'object'
      ? (effect.config.headers as Record<string, string>)
      : {};

  const body = JSON.stringify({
    tenantId: ctx.tenantId,
    payload: effect.config.payload ?? null,
    fields: effect.fields,
    sentAt: new Date().toISOString(),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-sparx-automation': '1', ...extraHeaders },
      body,
      signal: controller.signal,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`webhook responded ${res.status}`);
    }
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

let installed = false;

/** Register the built-in (platform-level) executors exactly once. Idempotent. */
export function installBuiltinActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'platform.webhook',
    module: null, // platform-level — no module-active gate
    gates: [webhookEgressGate],
    manifestNote: 'egress gate guards scheme + private-range SSRF before any outbound POST',
    execute: executeWebhook,
  });

  // In-app notifications (docs/124 Phase 3). Platform-level and dependency-free
  // — it writes through the tenant-scoped tx it is already handed — so it
  // belongs with the built-ins rather than the module-wired seam.
  registerNotifyAction();
}
