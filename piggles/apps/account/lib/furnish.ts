import 'server-only';

// Handing a finished signup to the platform to be FURNISHED.
//
// Onboarding owns the questions and the naming. It does not own switching the
// apps on, stamping the trade's setup, or filling the account with something to
// look at — that is one platform operation with a load-bearing internal order,
// and it lives in api-rest (POST /auth/piggles/platform/business/furnish).
//
// ── WHY NOT DO IT HERE, WHICH IS WHAT THIS APP USED TO DO ───────────────────
//
// It used to publish `module.activated` straight to the broker from this app,
// on the reasoning that it was "the same event on the same bus". It is not the
// same bus. `module.activated` travels on TWO, reaching two different process
// spaces: the Pub/Sub topic (the automation-worker, elsewhere) and api-rest's
// IN-PROCESS platform bus — and the in-process one carries every subscriber that
// matters here. The CRM's pipeline, segments and SLA policies. Commerce's tax,
// shipping and site-commerce defaults. Scheduling's defaults. The default
// transactional emails. Finance's accounts. The saved-view presets. Invoicing's
// config.
//
// Publishing to the broker alone set the flags, put a message on a topic, and
// seeded NONE of it — with nothing anywhere reporting a failure, because nothing
// failed. Every Piggles business created this way arrived with every app
// switched on and no pipeline in any of them — the exact outcome the old
// lib/activate-modules.ts was written to prevent, reached by the mechanism it
// chose. Only a process with those consumers registered can announce on both
// buses, so the announcing belongs there and this app asks for it. That file is
// gone; do not bring back a local publish in its place.
//
// api-rest acts on the business of the person signed in, never one this app
// names, and only for an owner or admin: this call writes module flags, config
// presets, a site template and hundreds of rows (docs/154).
//
// Both calls here run for one person mid-signup (the onboarding page and its
// action), uncached, so each carries that person's client chain: api-rest then
// rate-limits and audits the person, not this pod's one shared address.

import { platformRequest } from '@wizeworks/auth-client-server';
import type { TradeOption } from './trade-options';
import { tradeOptions } from './trades';

/** How long to wait. Furnishing is a real body of work — module baselines, the
 *  trade's presets, a site template, hundreds of sample rows — and the person is
 *  watching a "Setting things up" button while it runs. Long enough to finish on
 *  a cold process, short enough that a hung dependency does not strand somebody
 *  mid-signup with no way forward. */
const FURNISH_TIMEOUT_MS = 120_000;

/**
 * The site template a business gets when it does not choose one.
 *
 * Piggles' own showcase — the reference site, in the Piggles look, with an
 * invented demo business rather than any product's name. It is `brands:
 * ['piggles']` in the catalog, so it is the one showcase a Piggles tenant can
 * see; sparx's equivalent is restricted the other way and neither crosses.
 *
 * A default matters more than it looks: most people click straight through, and
 * the difference between landing on a working site and landing on a blank one is
 * the whole first impression. Choosing is still better than defaulting, which is
 * what the picker is for — this is what happens when nobody chooses.
 */
const DEFAULT_BLUEPRINT_KEY = 'piggles-starter';

export interface BlueprintChoice {
  key: string;
  name: string;
  summary: string;
  vertical: string;
  preview?: string;
}

export interface SetupOptions {
  blueprints: BlueprintChoice[];
  trades: TradeOption[];
}

/**
 * The templates this business's brand may see, and the trades the platform
 * can furnish. Never throws: when api-rest cannot be asked, the template
 * picker is left off and the trades fall back to the ones Piggles names, so the
 * setup form still works. Furnishing ignores a trade it cannot furnish.
 */
export async function readSetupOptions(): Promise<SetupOptions> {
  try {
    const options = await platformRequest<{
      blueprints: BlueprintChoice[];
      industries: { key: string; label: string }[];
    }>('business/setup-options', { timeoutMs: 15_000 });
    return { blueprints: options.blueprints, trades: tradeOptions(options.industries) };
  } catch {
    return { blueprints: [], trades: tradeOptions(null) };
  }
}

export interface FurnishRequest {
  blueprintKey?: string;
  /** A trade from `readSetupOptions`, or null for none. */
  industry: string | null;
}

/** Furnish the business of the person signed in. Throws when it fails, so the
 *  action can say so and leave them mid-setup rather than half-built. */
export async function furnishTenant({ industry, blueprintKey }: FurnishRequest): Promise<void> {
  await platformRequest('business/furnish', {
    body: {
      industry,
      blueprintKey: blueprintKey ?? DEFAULT_BLUEPRINT_KEY,
      // One flat price: no per-module billing items.
      billPerModule: false,
    },
    timeoutMs: FURNISH_TIMEOUT_MS,
  });
}
