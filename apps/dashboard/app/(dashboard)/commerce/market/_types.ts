// Local type mirror for the Commerce → sparx.market surface (docs/106 §4.7). The
// dashboard renders straight from the `GET /v1/market/*` responses, so these mirror
// the api-rest DTOs rather than importing @sparx/commerce — the established dashboard
// pattern that keeps the app off the lockfile graph of backend-only packages. (Shapes
// match marketService's *View interfaces.) The payout/settlement DTOs live with the
// money view in finance/payouts/_types.ts, not here.

export interface MarketProfile {
  enabled: boolean;
  bio: string | null;
  location: string | null;
  headline: string | null;
  bannerMediaId: string | null;
  defaultCategory: string | null;
  /** The effective commission (bps) this tenant pays — override or platform default. */
  commissionBps: number;
  /** Whether a custom override is set (vs the platform default). Platform-admin set. */
  hasCommissionOverride: boolean;
}

export interface MarketListedProduct {
  productId: string;
  title: string;
  handle: string;
  category: string | null;
  featured: boolean;
  approved: boolean;
  inStock: boolean;
  priceMinCents: number | null;
}

export interface MarketListedProducts {
  rows: MarketListedProduct[];
  total: number;
}

/** The single-product opt-in state returned by PUT /v1/market/products/:id. */
export interface ProductMarketState {
  productId: string;
  listed: boolean;
  category: string | null;
  featured: boolean;
  approved: boolean;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
