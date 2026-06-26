// Local type mirror for the Channels settings surface (docs/106). The dashboard
// renders straight from the `GET /v1/channels` response, so these mirror the API
// shapes rather than importing @sparx/channels — the established dashboard pattern
// that keeps the app off the lockfile graph of backend-only packages.

export type ChannelShape = 'order' | 'feed' | 'first_party';

export interface ChannelCatalogItem {
  slug: string;
  name: string;
  shape: ChannelShape;
  tagline: string;
  managesOrders: boolean;
  bestFor: string;
  phase: string;
  availability: 'available' | 'coming_soon';
}

export interface ChannelConnectionView {
  id: string;
  channel: string;
  status: string;
  shopName: string | null;
  externalId: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
  mappingCount: number;
}

export interface ChannelsPayload {
  connections: ChannelConnectionView[];
  catalog: ChannelCatalogItem[];
}

// Channel revenue consolidation (docs/27 §8) — mirrors the reportingService DTOs
// surfaced by GET /v1/commerce/reports/channel-revenue + /channel-top-products.
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

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
