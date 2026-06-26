// Local type mirror for the sparx.market settings surface (docs/106 §4.7). The
// dashboard renders straight from the `GET /v1/market/*` responses, so these
// mirror the api-rest DTOs rather than importing @sparx/commerce — the
// established dashboard pattern that keeps the app off the lockfile graph of
// backend-only packages. (Shapes match marketService's *View interfaces.)

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

/** The masked payout account — never the raw routing/account numbers. Null when
 *  no account is on file yet. */
export interface MarketPayoutAccount {
  accountHolderName: string;
  bankName: string | null;
  accountLast4: string | null;
  accountType: string;
  status: string;
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

export interface MarketSettlementSummary {
  grossCents: number;
  commissionCents: number;
  netCents: number;
  /** Net already paid out via settled runs. */
  paidCents: number;
  /** Net accrued but not yet in a paid run (the upcoming payout). */
  pendingCents: number;
  orderCount: number;
}

export interface MarketSettlementRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  commissionCents: number;
  refundCents: number;
  netCents: number;
  orderCount: number;
  currency: string;
  /** pending | processing | paid | failed */
  status: string;
  disbursementProvider: string | null;
  disbursementRef: string | null;
  paidAt: string | null;
  createdAt: string;
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
