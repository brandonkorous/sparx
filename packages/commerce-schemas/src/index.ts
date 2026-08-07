// @sparx/commerce-schemas — Zod input/output schemas for every Commerce
// write surface (REST, MCP, Server Actions, storefront, B2B portal).
//
// One barrel. Per the CRM convention, every schema this package exports
// is also re-exported here so callers can `import { CreateProductInput,
// IssueGiftCardInput } from '@sparx/commerce-schemas'` without worrying
// about file paths.
//
// The numbered groupings below mirror the Phase ordering in the Commerce
// implementation plan so you can read this file top-to-bottom and walk
// the same delivery sequence.

// Phase 0 — primitives shared across every file.
export * from './common';

// Phase 1 — catalog (products, variants, options, categories, collections,
// fitment).
export * from './products';

// Typed product types + attributes (docs/143) — the commerce mirror of CMS
// content types, backed by the shared @sparx/field-schema engine.
export * from './product-types';
export * from './categories';
export * from './fitment';
export * from './fitment-dictionaries';

// Phase 2 — inventory (warehouses, levels, lots, serials).
export * from './inventory';

// Phase 3 — pricing + discounts + gift cards + account credit.
export * from './pricing';
export * from './discounts';

// Markup rules + the pure cost→price engine (docs/48).
export * from './markup';

// Surcharge rules + the pure document-fee engine (docs/48 §6).
export * from './surcharge';

// Phase 4 — bundles + configurator.
export * from './bundles';

// Phase 5 — cart, checkout, subscriptions, shipping, tax, providers.
export * from './cart';
export * from './checkout';
export * from './subscriptions';
export * from './shipping';
export * from './tax';
export * from './providers';

// Phase 6 — reviews, Q&A, wishlist.
export * from './reviews';

// Phase 5/7 — returns / RMA.
export * from './returns';

// Phase 8 — storefront-level settings + theme.
export * from './site';

// sparx.market — the first-party marketplace (docs/106 §4.7): category taxonomy,
// flat commission model, and every market write/browse surface.
export * from './market';
