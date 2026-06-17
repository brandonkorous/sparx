# sparx Platform — Social Commerce & Channel Integration Spec

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Overview

sparx integrates with social commerce platforms and marketplaces via a unified Channel Adapter architecture. Merchants connect their existing accounts (TikTok Shop, Instagram Shopping, Facebook Shop, Google Shopping, Amazon) from the sparx dashboard. Product catalogs sync bidirectionally, orders from all channels appear in sparx order management, and inventory stays in sync in real time across all channels.

**Core principle:** sparx is the single source of truth for inventory, products, orders, and customers — regardless of which channel the sale came from.

---

## 2. Channel Adapter Architecture

All channel integrations implement a single interface. Adding a new channel is implementing this interface — no changes to core commerce logic.

```typescript
interface ChannelAdapter {
  id: string; // 'tiktok_shop' | 'instagram' | 'facebook' | etc.
  name: string; // Display name
  connect(tenantId: string): string; // Returns OAuth URL
  disconnect(tenantId: string): Promise<void>;
  syncProduct(tenantId: string, product: Product): Promise<void>;
  removeProduct(tenantId: string, productId: string): Promise<void>;
  ingestOrder(payload: unknown): Promise<Order>;
  pushFulfillment(order: Order): Promise<void>;
  syncInventory(tenantId: string, variantId: string, qty: number): Promise<void>;
  getAnalytics(tenantId: string, period: Period): Promise<ChannelAnalytics>;
}
```

Channel registry — adapters register at startup:

```typescript
channelRegistry.register(new TikTokShopAdapter());
channelRegistry.register(new InstagramShoppingAdapter());
channelRegistry.register(new FacebookShopAdapter());
channelRegistry.register(new GoogleShoppingAdapter());
channelRegistry.register(new AmazonAdapter());
```

---

## 3. Supported Channels — Build Sequence

### Tier 1 — Build Month 2–3 (highest merchant demand)

**TikTok Shop**

- ISV partner application: partner.tiktokshop.com (apply immediately)
- OAuth + product sync + order sync + inventory sync + analytics
- Full spec: see `27-tiktok-shop-integration.md`
- GMV Max advertising requirement starting July 2026 (1.5–5% of sales)

**Google Shopping / Merchant Center**

- Not a marketplace — product discovery
- Products appear in Google Shopping tab and search results
- Content API for Shopping handles catalog sync
- Should be automatic for all merchants (opt-out, not opt-in)
- Free organic placement drives traffic to merchant's sparx.zone site
- No order management needed — checkout stays on sparx

**Meta — Instagram Shopping + Facebook Shop**

- Meta Commerce API
- Instagram: tag products in posts and reels
- Facebook: full site inside Facebook
- Same OAuth + catalog sync + order management pattern as TikTok
- Every SMB merchant already has Facebook/Instagram — table stakes

### Tier 2 — Build Month 5–6

**Amazon Selling Partner API (SP-API)**

- Most complex integration — strict listing requirements, category attributes, FBA logistics
- Highest volume marketplace for product brands and dropship merchants
- Separate spec required before build

**Pinterest Catalogs**

- Product feed sync (not full order management)
- Drives traffic to sparx site — high purchase intent audience
- Strong for fashion, home, food, lifestyle merchants
- Relatively lightweight — primarily a product feed, not full order integration

**Walmart Marketplace**

- Second largest US marketplace
- Walmart Marketplace API — listings, orders, fulfillment
- Growing fast, especially home goods, electronics, general merchandise

### Tier 3 — Build on Merchant Request

- eBay Sell API (auto parts, industrial, collectibles — relevant for GDS)
- Etsy Open API v3 (handmade, vintage, craft merchants)
- Faire sell-side (brands selling wholesale to retailers)
- Shopee / Lazada (Southeast Asia)
- Mercado Libre (Latin America)

---

## 4. Inventory Source of Truth

**sparx DB is the single source of truth.** Inventory is decremented in sparx first, then pushed to all connected channels.

```
Order placed on TikTok Shop
  → TikTok webhook → sparx API
  → Decrement inventory in sparx DB
  → Pub/Sub: inventory.updated
  → Channel sync worker pushes new quantity to:
      - Instagram Shopping
      - Facebook Shop
      - Google Shopping
      - Amazon (if connected)
  → Prevents overselling across all channels
```

Critical invariant: inventory is NEVER re-incremented on a failed channel push. Failed pushes go to dead letter queue with retry. The sparx count is always authoritative.

---

## 5. Order Data Model

Orders from all channels share the same schema, differentiated by source:

```sql
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'site';
-- site | tiktok_shop | instagram | facebook | amazon |
-- walmart | ebay | etsy | b2b_portal | sparx_market

ALTER TABLE orders ADD COLUMN external_id VARCHAR(255);
-- Channel's own order ID

ALTER TABLE orders ADD COLUMN external_status VARCHAR(50);
-- Channel's status (mapped to sparx status on ingest)

ALTER TABLE orders ADD COLUMN channel_fee_cents INTEGER;
-- Marketplace commission charged by channel
```

---

## 6. Channel Connection Table

```sql
CREATE TABLE channel_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  channel         VARCHAR(50) NOT NULL,
  -- tiktok_shop | instagram | facebook | google_shopping | amazon
  status          VARCHAR(20) DEFAULT 'active',
  -- active | paused | error | disconnected
  external_id     VARCHAR(255),  -- channel's shop/account ID
  access_token    TEXT,          -- encrypted, stored in Secret Manager ref
  refresh_token   TEXT,          -- encrypted
  token_expires_at TIMESTAMPTZ,
  shop_name       VARCHAR(255),
  last_synced_at  TIMESTAMPTZ,
  sync_errors     JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE channel_product_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  channel         VARCHAR(50) NOT NULL,
  sparx_product_id UUID NOT NULL REFERENCES products(id),
  external_product_id VARCHAR(255) NOT NULL,
  external_sku    VARCHAR(255),
  sync_enabled    BOOLEAN DEFAULT true,
  last_synced_at  TIMESTAMPTZ,
  sync_error      TEXT
);
```

---

## 7. Dashboard UI — Channels Section

```
Settings → Channels

Connected:
  ● TikTok Shop    @gillettdiesel    Last sync: 2 min ago  [Manage]
  ● Google Shopping  Merchant Center  Last sync: 1 hr ago  [Manage]

Available to connect:
  ○ Instagram Shopping               [Connect]
  ○ Facebook Shop                    [Connect]
  ○ Amazon                           [Connect]
  ○ Pinterest                        [Coming soon]
  ○ Walmart                          [Coming soon]
```

Per-channel management page:

- Connection status + shop details
- Product sync status (synced / pending / errors)
- Order count from this channel (last 30 days)
- Revenue from this channel (last 30 days)
- Sync now button
- Disconnect button

Product list integration:

- Each product shows which channels it's listed on
- Toggle per channel per product
- Bulk action: "Push to [Channel]"

---

## 8. Analytics — Channel Revenue Breakdown

All channel revenue surfaces in the sparx analytics dashboard:

```
Revenue by channel · Last 30 days

Site        $48,200   52%   ████████████
TikTok Shop       $12,800   14%   ███
B2B Portal        $18,400   20%   █████
sparx.market       $8,100    9%   ██
Google Shopping    $4,700    5%   █

Total: $92,200
```

MCP tools:

```
get_channel_revenue({ channel, period })
get_channel_comparison({ period })
get_top_products_by_channel({ channel, period, limit })
```

---

## 9. Google Shopping — Auto-Enroll Logic

Google Shopping is unique — it should be automatic for every merchant, not a manual opt-in. When a merchant launches their store:

1. sparx automatically creates a Google Merchant Center account (via GMC API)
2. Product feed submitted for all public products
3. Free organic Google Shopping listings appear within 3–5 days
4. Merchant notified: "Your products are now appearing in Google Shopping"

Merchant can opt out from Settings → Channels → Google Shopping → Disable.

This is a significant activation moment — products showing up in Google search the day after launch, with no action required from the merchant.

---

## 10. Implementation Checklist

### TikTok Shop (Month 2–3)

- [ ] Apply for ISV partner access (partner.tiktokshop.com) — do immediately
- [ ] OAuth connect flow + token storage
- [ ] Product sync (sparx → TikTok)
- [ ] Product import (TikTok → sparx)
- [ ] Order webhook ingestion
- [ ] Fulfillment push (tracking → TikTok)
- [ ] Inventory sync worker
- [ ] Analytics fetch from TikTok Finance API
- [ ] GMV Max ad spend tracker (July 2026 requirement)

### Google Shopping (Month 2–3)

- [ ] Google Merchant Center API integration
- [ ] Auto-enrollment on merchant launch
- [ ] Product feed generation (Google Shopping XML format)
- [ ] Feed updates on product.updated events
- [ ] Merchant Center account creation via API
- [ ] Product disapproval handling + merchant notification

### Meta / Instagram + Facebook (Month 3–4)

- [ ] Meta Business SDK integration
- [ ] OAuth — Facebook Login for Business
- [ ] Meta Commerce API — product catalog sync
- [ ] Facebook Shop product feed
- [ ] Instagram Shopping product tags
- [ ] Order webhook ingestion (Meta Checkout)
- [ ] Fulfillment push

### Amazon (Month 5–6)

- [ ] SP-API registration and authentication
- [ ] Listing creation with category-specific attributes
- [ ] Order management (FBM — fulfilled by merchant)
- [ ] FBA integration (optional, Phase 2)
- [ ] Inventory sync
- [ ] Separate spec required before build
      EOF
