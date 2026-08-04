// The one place every outside service gets registered.
//
// There used to be six bootstraps, in six packages, called from wherever each
// domain's routes happened to live — and the cost of that was not tidiness. Four
// finished provider bundles (paypal, easypost, taxjar, avalara) were never called by
// any of them, so they shipped complete and invisible while the marketplace
// advertised them. Nobody noticed, because there was no single list to be missing
// from. This is that list.
//
// Each domain still owns its own contract, its own adapters and its own dispatch —
// this only guarantees they all announce themselves, in one process, in one order,
// so `/v1/integrations` can answer with the whole platform instead of a sixth of it.
//
// Adding an integration means registering it here (or, for a contributor's uploaded
// bundle, landing in the same plane through the marketplace). Nothing else.

import { registerBuiltinChannels } from '@sparx/channels/adapters';
import { registerDropshipIntegrations } from '@sparx/dropship';
import { registerProviderIntegrations } from '@sparx/integration-framework';
import { registerAvalaraProviders } from '@sparx/provider-avalara';
import { registerEasypostProviders } from '@sparx/provider-easypost';
import { registerShippoProviders } from '@sparx/provider-shippo';
import { registerTaxjarProviders } from '@sparx/provider-taxjar';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';

import { registerAiIntegrations } from './ai/integrations.js';

let booted = false;

/**
 * Register every integration sparx ships, then publish the whole set to the shared
 * plane.
 *
 * Idempotent — the plane's registrations are last-wins, so a second call (HMR, a test
 * that builds the app per case) is a no-op rather than a throw. The old provider
 * bootstrap had to catch and regex-match "already registered" to survive that.
 */
export function bootstrapIntegrations(): void {
  if (booted) return;
  booted = true;

  // ── Provider bundles (shipping, tax) ──
  // Shippo is live. The other three are complete bundles whose methods throw; they
  // register anyway and carry `availability: 'coming_soon'`, so the catalog can say
  // sparx will talk to them while every surface keeps its connect control disabled.
  // Leaving them unregistered is what made them invisible in the first place.
  registerShippoProviders();
  registerEasypostProviders();
  registerTaxjarProviders();
  registerAvalaraProviders();
  // Project the registered bundles onto the shared shelf. Runs last so nothing that
  // failed to register gets advertised.
  registerProviderIntegrations();

  // ── Sales channels + social accounts ──
  // Both publish into the plane as part of their own registration, and both resolve
  // `needs_platform_setup` from a live `isConfigured()` — so a channel whose partner
  // app is not provisioned reads as "sparx is finishing this", not as broken.
  registerBuiltinChannels();
  registerBuiltinSocialAdapters();

  // ── Dropship suppliers ──
  // Descriptor-only: a supplier adapter is constructed per connection with that
  // tenant's credentials, so there is no process-wide instance to hold.
  registerDropshipIntegrations();

  // ── AI accounts (BYOK) ──
  registerAiIntegrations();

  // Payment gateways register through `bootstrapPayments()` in providers-bootstrap,
  // which runs alongside this from the same composition root. They are not repeated
  // here because that path also installs the payment secret reader — splitting it
  // would leave the gateways registered but unable to read their own credentials.
}
