// Local type mirror for the Finance → Channels revenue view (docs/110 Slice 4b).
// Mirrors the `GET /v1/commerce/reports/channel-revenue` + `/channel-top-products`
// DTOs so the dashboard stays off the backend lockfile graph (the established pattern).

export interface ChannelRevenueRow {
  channel: string;
  label: string;
  orders: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  channelFeeCents: number;
  netAfterFeesCents: number;
  averageOrderValueCents: number;
  /** Share of total gross, 0–100 with one decimal. */
  sharePct: number;
}

export interface ChannelRevenueReport {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalRefundedCents: number;
  totalChannelFeeCents: number;
  totalNetAfterFeesCents: number;
  byChannel: ChannelRevenueRow[];
  currency: string;
}

export interface ChannelTopProduct {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}
