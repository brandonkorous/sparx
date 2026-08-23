// Dockable panes scoped to ONE product.
//
// These are NOT tabs on the product editor, and the distinction is the whole
// reason they exist. Each is another module's functionality seen through a
// product — stock belongs to Inventory, fitment to the catalog's compatibility
// data, trade prices to B2B. As tabs you could only see one at a time inside a
// pane you cannot detach; as panes they dock side by side, tear onto a second
// monitor, and persist.
//
// All of them:
//   • take `{ productId }` and implement the contract in
//     surfaces/commerce/product-scope.tsx — pinned when the param is present,
//     following the product selection when it is absent;
//   • are `listed: true`, so they can be opened cold from the launcher (they
//     open in following mode and say how to choose a product);
//   • sit in the "Product panels" section so they read as a set rather than
//     scattered among the catalog lists.
//
// Every entry below is live.

import {
  Building2,
  Globe2,
  MessageSquare,
  Puzzle,
  Repeat2,
  Settings2,
  Sparkles,
  Truck,
  Warehouse,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { ProductChannelsSurface } from '../../../surfaces/commerce/product-channels';
import { ProductConfiguratorSurface } from '../../../surfaces/commerce/product-configurator';
import { ProductDropshipSurface } from '../../../surfaces/commerce/product-dropship';
import { ProductFitmentSurface } from '../../../surfaces/commerce/product-fitment';
import { ProductReviewsSurface } from '../../../surfaces/commerce/product-reviews';
import { ProductStockSurface } from '../../../surfaces/commerce/product-stock';
import { ProductSubscriptionsSurface } from '../../../surfaces/commerce/product-subscriptions';
import { ProductTradePricingSurface } from '../../../surfaces/commerce/product-trade-pricing';
import { ProductTranslationsSurface } from '../../../surfaces/commerce/product-translations';

export const PRODUCT_PANEL_SURFACES: SurfaceDefinition[] = [
  {
    key: 'commerce.product.stock',
    title: 'Product stock',
    module: 'inventory',
    icon: Warehouse,
    section: 'Product panels',
    order: 15,
    keywords: ['inventory', 'levels', 'on hand', 'warehouse', 'reorder'],
    besideWidth: 0.4,
    component: ProductStockSurface,
  },
  {
    key: 'commerce.product.fitment',
    title: 'Product fitment',
    module: 'commerce',
    icon: Puzzle,
    section: 'Product panels',
    order: 16,
    keywords: ['compatibility', 'fits', 'vehicles', 'models', 'machines'],
    besideWidth: 0.4,
    component: ProductFitmentSurface,
  },
  {
    key: 'commerce.product.configurator',
    title: 'Product configurator',
    module: 'commerce',
    icon: Settings2,
    section: 'Product panels',
    order: 17,
    keywords: ['options', 'build', 'made to order', 'custom'],
    besideWidth: 0.45,
    component: ProductConfiguratorSurface,
  },
  {
    key: 'commerce.product.trade-pricing',
    title: 'Product trade pricing',
    module: 'b2b',
    icon: Building2,
    section: 'Product panels',
    order: 18,
    keywords: ['b2b', 'wholesale', 'contract', 'tiers', 'accounts'],
    besideWidth: 0.4,
    component: ProductTradePricingSurface,
  },
  {
    key: 'commerce.product.reviews',
    title: 'Product reviews & questions',
    module: 'commerce',
    icon: MessageSquare,
    section: 'Product panels',
    order: 19,
    keywords: ['ratings', 'stars', 'feedback', 'qa', 'answers'],
    besideWidth: 0.4,
    component: ProductReviewsSurface,
  },
  {
    key: 'commerce.product.channels',
    title: 'Product listings',
    module: 'commerce',
    icon: Globe2,
    section: 'Product panels',
    order: 20,
    keywords: ['channels', 'marketplace', 'sparx.market', 'listings', 'sites'],
    besideWidth: 0.4,
    component: ProductChannelsSurface,
  },
  {
    key: 'commerce.product.dropship',
    title: 'Product dropshipping',
    module: 'dropship',
    icon: Truck,
    section: 'Product panels',
    order: 21,
    keywords: ['supplier', 'source', 'fulfilment', 'vendor'],
    besideWidth: 0.4,
    component: ProductDropshipSurface,
  },
  {
    key: 'commerce.product.subscriptions',
    title: 'Product subscriptions',
    module: 'commerce',
    icon: Repeat2,
    section: 'Product panels',
    order: 22,
    keywords: ['recurring', 'repeat', 'plans', 'memberships'],
    besideWidth: 0.4,
    component: ProductSubscriptionsSurface,
  },
  {
    key: 'commerce.product.translations',
    title: 'Product translations',
    module: 'cms',
    icon: Sparkles,
    section: 'Product panels',
    order: 23,
    keywords: ['languages', 'localisation', 'localization', 'translate'],
    besideWidth: 0.4,
    component: ProductTranslationsSurface,
  },
];
