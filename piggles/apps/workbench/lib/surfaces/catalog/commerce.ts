// Selling — the commerce module's surfaces, composed from its five parts.
//
// The keys are the contract: `commerce.product.stock` is what a saved layout, a
// deep link and `openProductFacet()` all say, so renaming one orphans real panes
// in real workspaces. Treat them as immutable.
//
// Order matters only through each surface's own `order` field — the nav panel is
// derived, so the split below is about where a reader looks, not about placement.

import type { SurfaceDefinition } from '../registry';
import { ORDER_SURFACES } from './commerce-orders';
import { CATALOG_SURFACES } from './commerce-catalog';
import { PRODUCT_PANEL_SURFACES } from './commerce-product-panels';
import { PRICING_SURFACES } from './commerce-pricing';
import { SELLING_SURFACES } from './commerce-selling';

export const COMMERCE_SURFACES: SurfaceDefinition[] = [
  ...ORDER_SURFACES,
  ...CATALOG_SURFACES,
  ...PRODUCT_PANEL_SURFACES,
  ...PRICING_SURFACES,
  ...SELLING_SURFACES,
];
