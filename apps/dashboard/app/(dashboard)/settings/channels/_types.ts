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

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
