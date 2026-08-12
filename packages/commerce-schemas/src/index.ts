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

// Barcodes — symbology, check digits, scan-equivalence and the write schemas for
// the scan registry (docs/146 Phase 3). Pure: the same code validates on the
// server, in the API and in the label printer, because a check digit computed
// two ways is a bug that only shows up on paper.
export * from './barcodes';

// The bar patterns themselves — Code 128, the EAN/UPC family, ITF-14 — as pure
// module arithmetic with no rendering dependency, so a label drawn in the
// workbench and one drawn server-side are the same barcode.
export * from './barcode-encode';

// Picking + packing (docs/146 Phase 4) — generating a walk, confirming what came
// off a shelf, saying what did not, and verifying what went in the box.
export * from './picking';

// True cost (docs/146 Phase 5) — the freight and duty that a unit's cost basis
// was missing, how they spread across the lines they arrived with, and how the
// business wants its stock valued.
export * from './costing';

// Units of measure (docs/146 Phase 6) — buy a case, stock each, sell a pair.
// The conversion arithmetic and the one function every screen uses to say a
// quantity out loud are PURE and live here, so a receipt and a count cannot
// disagree about what three cartons means.
export * from './uom';

// Bills of materials + assembly orders (docs/146 Phase 6) — making things out
// of other things, and taking them back apart.
export * from './assembly';

// Planning intelligence (docs/146 Phase 7) — how much to keep and when to buy
// it again. The safety-stock, reorder-point, ABC/XYZ, cover and risk arithmetic
// is PURE and lives here, so the nightly sweep, the API and the screen cannot
// arrive at three different answers for the same item.
export * from './planning';

// Supplier performance + procurement discipline (docs/146 Phase 8) — the other
// side of a purchase order. The price-break ladder, the scorecard grading and
// the three-way-match arithmetic are PURE and live here, so the quote a buyer
// is shown and the cost the order records cannot come out different.
export * from './procurement';

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
