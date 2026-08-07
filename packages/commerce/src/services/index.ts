// Service-layer barrel. Each service is namespaced so callers write
// `productService.create(ctx, ...)`, `cartService.addItem(ctx, ...)`,
// etc. — symmetric with how the MCP tool registry exposes them.

// Phase 1 — catalog
export * as productService from './product-service';
// Typed product types + attributes (docs/143) — CRUD, fork-on-edit, and the
// resolve+validate helpers the product write path uses.
export * as productTypeService from './product-types-service';
// The pure schema+bag → display-shapes projection a site's PDP binds against.
export {
  projectProductAttributes,
  type AttributeProjection,
  type AttributeSection,
  type AttributeSectionItem,
} from './attribute-projection';
export * as variantService from './variant-service';
export * as productTranslationService from './product-translation-service';
export * as categoryService from './category-service';
export * as collectionService from './collection-service';
export * as fitmentService from './fitment-service';

// Phase 2 — inventory. Extracted into its own first-class module/product
// (@sparx/inventory, docs/100). Re-exported here so existing consumers
// (MCP tools, reservation-reaper, REST routes via `@sparx/commerce`) keep
// importing `inventoryService` unchanged while ownership lives in inventory.
export { inventoryService } from '@sparx/inventory';

// Phase 3 — pricing + discounts
export * as pricingService from './pricing-service';
export * as discountService from './discount-service';
export * as markupService from './markup-service';
export * as markupRecomputeService from './markup-recompute-service';
export * as surchargeService from './surcharge-service';
export * as bulkPriceService from './bulk-price-service';

// Phase 4 — bundles + configurator
export * as configuratorService from './configurator-service';

// Phase 5 — cart, checkout, subscriptions, shipping, tax, providers
export * as cartService from './cart-service';
export * as checkoutService from './checkout-service';

// Channels (docs/106) — inbound marketplace order ingest (order + inventory).
export {
  ingestChannelOrder,
  type ChannelOrderIngestInput,
  type ChannelOrderIngestLine,
  type ChannelOrderIngestAddress,
  type ChannelOrderIngestResult,
} from './channel-order-ingest';

// sparx.market (docs/106 §4.7) — the first-party marketplace: product opt-in +
// projection, merchant profile/payout, public cross-tenant browse, settlement.
export * as marketService from './market';

export * as subscriptionService from './subscription-service';
// The vault behind recurring charges — a shopper's saved cards (docs/142 §4).
export * as paymentMethodService from './payment-method-service';
// Collection: the off-session charge, the dunning ladder, invoice mode.
export * as subscriptionBilling from './subscription-billing';
export * as shippingService from './shipping-service';
export { dispatchShippingTrackingWebhook } from './shipping-webhook-dispatch';
export { quoteOutboundRates } from './outbound-shipment-request';
export { listFulfillmentLabels } from './fulfillment-label-store';
export type { FulfillmentLabelRow } from './fulfillment-label-store';
export * as taxService from './tax-service';
export * as providerService from './provider-service';

// Phase 5/7 — returns / RMA
export * as returnService from './return-service';

// Phase 6 — reviews + Q&A + wishlists
export * as reviewService from './review-service';

// Phase 8 — storefront defaults + theme
export * as commerceSiteService from './site-commerce-service';

// Phase 9 — reporting + dashboard home metrics
export * as reportingService from './reporting-service';

export { CommerceNotImplementedError, notImplemented } from './not-implemented';
