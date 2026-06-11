// Built-in gates (docs/81 §7.1).
//
// The GLOBAL chain runs first for EVERY action, so even a zero-manifest action
// is gated: tenant-active → kill-switch → module-active. These are the
// "is this automation permitted to act at all, right now" guardrails the
// platform owns and the author cannot edit. Per-action manifest gates (e.g.
// webhook egress) run after the global chain.
//
// Gates are small, single-concern, typed functions — NOT a policy DSL (§7.1
// "guardrail against over-build").

import type { EffectInput, Gate, GateResult, NamedGate } from '../engine-types';
import { moduleForAction } from '../actions/registry';
import { automationsDisabled, loadTenantState, moduleEnabledInSettings } from './tenant-state';

/** Tenant must be active — a suspended/closed tenant produces no automation effects. */
const tenantActive: Gate = async (ctx) => {
  const { status } = await loadTenantState(ctx);
  return status === 'active'
    ? { kind: 'allow' }
    : { kind: 'deny', reason: `tenant_status_${status}` };
};

/** Per-tenant kill switch — `settings.automations.disabled` halts all effects. */
const killSwitch: Gate = async (ctx) => {
  const { settings } = await loadTenantState(ctx);
  return automationsDisabled(settings)
    ? { kind: 'deny', reason: 'automations_disabled' }
    : { kind: 'allow' };
};

/** The action's owning module must be enabled — don't send email if the email
 *  module is off, etc. Platform-level actions (module === null) always pass. */
const moduleActive: Gate = async (ctx, effect) => {
  const moduleSlug = moduleForAction(effect.actionType);
  if (!moduleSlug) return { kind: 'allow' };
  const { settings } = await loadTenantState(ctx);
  return moduleEnabledInSettings(settings, moduleSlug)
    ? { kind: 'allow' }
    : { kind: 'deny', reason: `module_inactive_${moduleSlug}` };
};

/** The global chain — runs first, for every action (§7.1#3). */
export const GLOBAL_GATES: NamedGate[] = [
  { name: 'tenant-active', run: tenantActive },
  { name: 'kill-switch', run: killSwitch },
  { name: 'module-active', run: moduleActive },
];

// ─── manifest gate: webhook egress (SSRF guard) ──────────────────────────────

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|\[::1\])/i;
// 172.16.0.0 – 172.31.255.255
const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[01])\./;

/**
 * Outbound-webhook egress guard. Denies non-HTTP(S) schemes and any host that
 * resolves to a private / loopback / link-local range — a tenant automation must
 * not be a server-side request-forgery vector into the cluster's internal
 * network. Denied = `gated` (policy), not a delivery failure.
 */
function checkEgress(effect: EffectInput): GateResult {
  const raw = effect.config.url;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { kind: 'deny', reason: 'webhook_url_missing' };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'deny', reason: 'webhook_url_invalid' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'deny', reason: `webhook_scheme_${url.protocol.replace(':', '')}` };
  }
  if (PRIVATE_HOST.test(url.hostname) || PRIVATE_172.test(url.hostname)) {
    return { kind: 'deny', reason: 'webhook_private_host' };
  }
  return { kind: 'allow' };
}

export const webhookEgressGate: NamedGate = {
  name: 'webhook-egress',
  // Pure/synchronous check wrapped in a resolved promise to satisfy the Gate
  // contract without a needless `async` (this gate does no I/O).
  run: (_ctx, effect) => Promise.resolve(checkEgress(effect)),
};
