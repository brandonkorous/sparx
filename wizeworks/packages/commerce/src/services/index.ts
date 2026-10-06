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
// Which products a bulk write acts on: ids, or the Products list's own narrowing.
export * as productSelectionService from './product-selection';

// Phase 2 — inventory. Extracted into its own first-class module/product
// (@wizeworks/inventory, docs/100). Re-exported here so existing consumers
// (MCP tools, reservation-reaper, REST routes via `@wizeworks/commerce`) keep
// importing `inventoryService` unchanged while ownership lives in inventory.
export { inventoryService } from '@wizeworks/inventory';

// Phase 3 — pricing + discounts
export * as pricingService from './pricing-service';
export * as discountService from './discount-service';
export * as markupService from './markup-service';
export * as markupRecomputeService from './markup-recompute-service';
export * as surchargeService from './surcharge-service';
export * as bulkPriceService from './bulk-price-service';

// Phase 4 — bundles + configurator
export * as configuratorService from './configurator-service';

// How many of a bundle you can actually sell (docs/146 Phase 6.8) — derived
// from its components, because a `decrement_components` bundle has no stock of
// its own and the buy-box was answering "always available" for a gift set whose
// candle ran out last Tuesday.
export { bundleAvailability, bundleAvailabilityFor } from './bundle-availability';
export type { BundleAvailability, BundleComponentAvailability } from './bundle-availability';

// Phase 5 — cart, checkout, subscriptions, shipping, tax, providers
export * as cartService from './cart-service';
export type { CartSnapshot } from './cart-service';
// What a trade account may order and who on it may order (sparx persona issue 086).
export * as accountBuyingRules from './account-buying-rules';
export type {
  AccountOrdering,
  CartAccountRules,
  CartLineRule,
  QuantityRule,
} from './account-buying-rules';
// Order again and saved carts for trade accounts (sparx persona issue 086).
export * as cartRefillService from './cart-refill-service';
export type { RefillLine, RefillResult, RefillSkipReason } from './cart-refill-service';
export * as savedCartService from './saved-cart-service';
export type { SavedCartView } from './saved-cart-service';
export * as checkoutService from './checkout-service';
// The gateway half of deciding a held wholesale order: charge the held card on
// approval, let it go or refund it when it is turned down (sparx persona issue 087).
export * as heldOrderPayments from './held-order-payments';
// The gateway half of ending a booking: charge a no-show or late-cancellation fee
// from the card hold, let it go, refund or keep a deposit (sparx persona issue 087).
export * as bookingPayments from './booking-payments';
export * as madeToOrderService from './made-to-order-service';

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
// A paid checkout that asked for repeat delivery becomes a repeat order (issue 739).
export * as repeatStartService from './repeat-start-service';
// Collection: the off-session charge, the dunning ladder, invoice mode.
export * as subscriptionBilling from './subscription-billing';
export * as shippingService from './shipping-service';
// What a quote answers when no delivery has been set up — the surfaces that
// warn a merchant about it need to recognise the option they are describing.
export {
  COLLECTION_RATE_REF,
  COLLECTION_PROVIDER_SLUG,
  COLLECTION_SERVICE,
  collectionOption,
  describeRate,
  isCollection,
} from './collection-option';
export { dispatchShippingTrackingWebhook } from './shipping-webhook-dispatch';
export { quoteOutboundRates } from './outbound-shipment-request';
export { listFulfillmentLabels } from './fulfillment-label-store';
export type { FulfillmentLabelRow } from './fulfillment-label-store';

// Sealed box → shipping record (docs/146 Phase 4.6). Lives here because commerce
// is the only package that can see both the warehouse and the order.
export { fulfillPackedShipment, closeAndFulfillPackage } from './pack-fulfillment';
export type { FulfillPackedShipmentInput, FulfillPackedShipmentResult } from './pack-fulfillment';
export * as taxService from './tax-service';
export * as providerService from './provider-service';

// Phase 5/7 — returns / RMA
export * as returnService from './return-service';
// Core charges on rebuilt parts: cores owed, returned, kept (persona issue 051).
export * as coreService from './core-service';
export * as coreChoiceService from './core-choice-service';
// What actually happens to returned goods — restock / quarantine / repair /
// scrap, each routed to its own shelf (docs/146 Phase 9.7).
export * as returnDispositionService from './return-disposition';

// Phase 6 — reviews + Q&A + wishlists
export * as reviewService from './review-service';

// Phase 8 — storefront defaults + theme
export * as commerceSiteService from './site-commerce-service';

// Phase 9 — reporting + dashboard home metrics
export * as reportingService from './reporting-service';
export * as offerService from './offer-service';
export * as upsellService from './upsell-service';

export { CommerceNotImplementedError, notImplemented } from './not-implemented';
