// sparx.market — the FIRST-PARTY channel adapter (docs/106 §4.7).
//
// sparx.market is "just one more channel" (`channel_connections.channel =
// 'sparx_market'`, shape `first_party`) so it appears in the same Settings →
// Channels surface and rolls into the same revenue analytics. But it is sparx's
// OWN destination, not an external API: orders are BORN in sparx (the MoR
// checkout), and the catalog "push" is an internal projection write — not an HTTP
// call. So the framework treats `first_party` specially at two seams:
//
//   • CONNECT — there is no external OAuth. The channels API enables sparx.market by
//     toggling the merchant profile + creating the connection row directly, and
//     NEVER calls `connectUrl` / `exchangeCode` (those throw — calling them is a
//     wiring bug, caught loudly).
//   • CATALOG PUSH — the channel-sync-worker special-cases `sparx_market` and writes
//     the global market_listings / market_merchants projection itself (an adapter
//     must never touch the DB), so it NEVER calls `pushProduct` / `removeProduct`.
//     They are implemented as harmless no-ops so the contract is total.
//
// The adapter therefore carries identity (id/name/shape) + `isConfigured()` so the
// channel lights up `available` the instant ops sets MARKET_ENABLED — exactly like
// every external channel waits on its partner creds.

import type {
  ChannelAdapter,
  ChannelAuth,
  ChannelConnectContext,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
} from '../types.js';

/** Thrown if the OAuth seam is ever invoked for the first-party channel — a wiring
 *  bug, since the channels API enables sparx.market directly (no consent screen). */
class FirstPartyOAuthError extends Error {
  constructor(method: string) {
    super(
      `sparx.market is a first-party channel — ${method} has no OAuth flow. ` +
        'Enable it via the merchant profile (POST /v1/channels/sparx_market/connect), not the OAuth path.'
    );
    this.name = 'FirstPartyOAuthError';
  }
}

export class SparxMarketAdapter implements ChannelAdapter {
  readonly id = 'sparx_market' as const;
  readonly name = 'sparx.market';
  readonly shape = 'first_party' as const;

  /** sparx.market is sparx-owned (no partner approval) — it goes live when ops sets
   *  MARKET_ENABLED=true (the sparx/apps/market destination is deployed + the platform
   *  Stripe account is ready). Until then it stays `coming_soon` at runtime, with
   *  no code change to flip it. */
  isConfigured(): boolean {
    return process.env.MARKET_ENABLED === 'true';
  }

  // ── install / auth — never reached for first_party (the API enables directly) ──

  connectUrl(_ctx: ChannelConnectContext): string {
    throw new FirstPartyOAuthError('connectUrl');
  }

  exchangeCode(_code: string, _ctx: ChannelConnectContext): Promise<ChannelTokens> {
    throw new FirstPartyOAuthError('exchangeCode');
  }

  // ── catalog out — the worker writes the projection itself; these are no-ops ────

  /** No-op: the channel-sync-worker projects sparx.market listings into the global
   *  market_listings table directly (an adapter must not touch the DB). Echoes the
   *  variant ids so, if ever called, it is a harmless identity mapping. */
  pushProduct(_auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    return Promise.resolve({
      externalProductId: product.productId,
      variants: product.variants.map((v) => ({
        variantId: v.variantId,
        externalVariantId: v.variantId,
        externalSku: v.sku,
      })),
    });
  }

  /** No-op: removal is the worker deleting the projection row. */
  removeProduct(_auth: ChannelAuth, _externalProductId: string): Promise<void> {
    return Promise.resolve();
  }
}
