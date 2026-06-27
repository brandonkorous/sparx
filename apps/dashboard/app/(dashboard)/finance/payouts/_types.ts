// Local type mirror for the Finance → Payouts surface (docs/110 Slice 3). These are
// the sparx.market settlement + payout-account shapes, moved here from the market
// settings surface with the panels they back. Mirrors the `GET /v1/market/*` DTOs so
// the dashboard stays off the backend lockfile graph (the established pattern).

/** The masked payout account — never the raw routing/account numbers. Null when no
 *  account is on file yet. */
export interface MarketPayoutAccount {
  accountHolderName: string;
  bankName: string | null;
  accountLast4: string | null;
  accountType: string;
  status: string;
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

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
