// Selling — the commerce module's surfaces.
//
// ── THIS FILE IS FINISHED. DO NOT EDIT IT TO SHIP A PRODUCT FACET. ───────
//
// Every product-scoped facet pane is already registered below with its key, its
// title, its icon and its placement. An agent building one of them replaces the
// `component:` value for their surface with their own component and changes
// NOTHING else here — no new entries, no reordering, no new sections. That is
// deliberate: the registry is the one file all the parallel product work would
// otherwise collide in, and a merge conflict here breaks every pane at once
// because surface keys are persisted in saved layouts.
//
// The keys are the contract. `commerce.product.stock` is what a saved layout,
// a deep link and `openProductFacet()` all say, so renaming one orphans real
// panes in real workspaces. Treat them as immutable.

import {
  Banknote,
  BarChart3,
  Blocks,
  Boxes,
  Building2,
  CreditCard,
  Globe2,
  HelpCircle,
  Heart,
  Layers,
  MessageSquare,
  Package,
  Percent,
  Plug,
  Puzzle,
  Repeat2,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Tags,
  Ticket,
  Truck,
  Wallet,
  Warehouse,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { cell, createEntityListSurface } from '../../../surfaces/entity-list';
import { OrderDetailSurface } from '../../../surfaces/commerce/order-detail';
import { OrdersListSurface } from '../../../surfaces/commerce/orders-list';
import { ProductDetailSurface } from '../../../surfaces/commerce/product-detail';
import { ProductsListSurface } from '../../../surfaces/commerce/products-list';
import { ProductChannelsSurface } from '../../../surfaces/commerce/product-channels';
import { ProductConfiguratorSurface } from '../../../surfaces/commerce/product-configurator';
import { ProductDropshipSurface } from '../../../surfaces/commerce/product-dropship';
import { ProductFitmentSurface } from '../../../surfaces/commerce/product-fitment';
import { ProductReviewsSurface } from '../../../surfaces/commerce/product-reviews';
import { ProductStockSurface } from '../../../surfaces/commerce/product-stock';
import { ProductSubscriptionsSurface } from '../../../surfaces/commerce/product-subscriptions';
import { ProductTradePricingSurface } from '../../../surfaces/commerce/product-trade-pricing';
import { ProductTranslationsSurface } from '../../../surfaces/commerce/product-translations';
import { stub } from './stub';
import { type NamedRow } from './rows';

export const COMMERCE_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: orders are the module's heartbeat, so they lead
    // the panel above the Catalog/Pricing groups (unsectioned surfaces sort
    // first — see nav.ts).
    key: 'commerce.orders.list',
    title: 'Orders',
    module: 'commerce',
    icon: ShoppingBag,
    order: 1,
    keywords: ['sales', 'purchases', 'fulfillment', 'shipments'],
    component: OrdersListSurface,
  },
  {
    key: 'commerce.order.detail',
    title: 'Order',
    module: 'commerce',
    icon: ShoppingBag,
    component: OrderDetailSurface,
    // Reachable from the list, not the launcher — opening "an order" with no
    // order in mind isn't a thing anyone wants. There is no create counterpart
    // either: orders are placed by customers, or by checkout on their behalf.
    listed: false,
  },

  /* ── Catalog ───────────────────────────────────────────────────────────── */
  {
    key: 'commerce.products.list',
    title: 'Products',
    module: 'commerce',
    icon: Package,
    section: 'Catalog',
    order: 10,
    keywords: ['catalog', 'items', 'stock', 'sku', 'price', 'inventory'],
    component: ProductsListSurface,
    createSurface: 'commerce.product.detail',
    createLabel: 'Add a product',
  },
  {
    key: 'commerce.product.detail',
    title: 'Product',
    module: 'commerce',
    icon: Package,
    component: ProductDetailSurface,
    // Reachable from the list and from the nav panel's `+`, not as a launcher
    // entry of its own: opening "a product" with no product in mind is not a
    // thing anyone wants, and adding one is already offered where products live.
    listed: false,
  },

  /* ── Product facets: dockable panes scoped to ONE product ──────────────────
     These are NOT tabs on the product editor, and the distinction is the whole
     reason they exist. Each is another module's functionality seen through a
     product — stock belongs to Inventory, fitment to the catalog's compatibility
     data, trade prices to B2B. As tabs you could only see one at a time inside a
     pane you cannot detach; as panes they dock side by side, tear onto a second
     monitor, and persist.

     All of them:
       • take `{ productId }` and implement the contract in
         surfaces/commerce/product-scope.tsx — pinned when the param is present,
         following the product selection when it is absent;
       • are `listed: true`, so they can be opened cold from the launcher (they
         open in following mode and say how to choose a product);
       • sit in the "Product panels" section so they read as a set rather than
         scattered among the catalog lists.

     Every entry below is live. ──────────────────────────────────────────── */
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

  {
    key: 'commerce.collections.list',
    title: 'Collections',
    module: 'commerce',
    icon: Layers,
    section: 'Catalog',
    order: 11,
    keywords: ['groups', 'categories'],
    component: createEntityListSurface<NamedRow>({
      path: '/v1/commerce/collections',
      queryKey: ['commerce', 'collections'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search collections…',
      emptyTitle: 'No collections yet',
      emptyBody: 'Collections group products together so shoppers can browse them.',
      emptyIcon: Layers,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name ?? row.title) }],
    }),
  },
  {
    key: 'commerce.categories.list',
    title: 'Categories',
    module: 'commerce',
    icon: Tags,
    section: 'Catalog',
    order: 12,
    component: createEntityListSurface<NamedRow>({
      path: '/v1/commerce/categories',
      queryKey: ['commerce', 'categories'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search categories…',
      emptyTitle: 'No categories yet',
      emptyBody: 'Categories organise your catalog into a browsable structure.',
      emptyIcon: Tags,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name ?? row.title) }],
    }),
  },
  stub({
    key: 'commerce.bundles.list',
    title: 'Bundles',
    module: 'commerce',
    icon: Blocks,
    section: 'Catalog',
    order: 13,
    keywords: ['kits', 'packages', 'sets'],
    body: 'Bundles sell several products together as one item, usually for less than buying them separately.',
  }),
  stub({
    key: 'commerce.fitment.list',
    title: 'Fitment',
    module: 'commerce',
    icon: Puzzle,
    section: 'Catalog',
    order: 14,
    keywords: ['compatibility', 'fits', 'vehicles', 'models'],
    body: 'Fitment records which products work with which machines or models, so shoppers only see parts that fit.',
  }),
  stub({
    key: 'commerce.configurator.list',
    title: 'Configurator',
    module: 'commerce',
    icon: Settings2,
    section: 'Catalog',
    order: 15,
    keywords: ['options', 'custom', 'build'],
    body: 'The configurator lets a shopper build a product to order by choosing options step by step.',
  }),

  /* ── Pricing ───────────────────────────────────────────────────────────── */
  stub({
    key: 'commerce.pricing.list',
    title: 'Pricing',
    module: 'commerce',
    icon: Tag,
    section: 'Pricing',
    order: 20,
    keywords: ['price lists', 'rules', 'markup'],
    body: 'Pricing sets what you charge, including rules that change a price for certain customers or quantities.',
  }),
  {
    key: 'commerce.discounts.list',
    title: 'Discounts',
    module: 'commerce',
    icon: Percent,
    section: 'Pricing',
    order: 21,
    keywords: ['promotions', 'coupons', 'sale'],
    component: createEntityListSurface<NamedRow>({
      path: '/v1/commerce/discounts',
      queryKey: ['commerce', 'discounts'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search discounts…',
      emptyTitle: 'No discounts yet',
      emptyBody: 'Discounts reduce the price at checkout, automatically or with a code.',
      emptyIcon: Percent,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name ?? row.title) }],
    }),
  },
  {
    key: 'commerce.giftcards.list',
    title: 'Gift cards',
    module: 'commerce',
    icon: Ticket,
    section: 'Pricing',
    order: 22,
    component: createEntityListSurface<NamedRow>({
      path: '/v1/commerce/gift-cards',
      queryKey: ['commerce', 'gift-cards'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search gift cards…',
      emptyTitle: 'No gift cards yet',
      emptyBody: 'Gift cards let customers pre-pay an amount someone else can spend.',
      emptyIcon: Ticket,
      columns: [{ key: 'name', header: 'Name', render: (row) => cell.text(row.name ?? row.title) }],
    }),
  },
  stub({
    key: 'commerce.account-credit.list',
    title: 'Account credit',
    module: 'commerce',
    icon: Wallet,
    section: 'Pricing',
    order: 23,
    keywords: ['store credit', 'balance'],
    body: 'Account credit is money you put on a customer’s account for them to spend with you later.',
  }),

  /* ── In progress ───────────────────────────────────────────────────────── */
  stub({
    key: 'commerce.carts.list',
    title: 'Carts',
    module: 'commerce',
    icon: ShoppingCart,
    section: 'In progress',
    order: 30,
    keywords: ['abandoned', 'baskets'],
    body: 'Carts are orders someone started but hasn’t paid for yet — including the ones they walked away from.',
  }),
  stub({
    key: 'commerce.checkout-sessions.list',
    title: 'Checkout sessions',
    module: 'commerce',
    icon: CreditCard,
    section: 'In progress',
    order: 31,
    keywords: ['payment', 'in progress'],
    body: 'A checkout session is a shopper part-way through paying. Useful when you need to see where a payment stalled.',
  }),
  stub({
    key: 'commerce.subscriptions.list',
    title: 'Subscriptions',
    module: 'commerce',
    icon: Repeat2,
    section: 'In progress',
    order: 32,
    keywords: ['recurring', 'memberships', 'plans'],
    body: 'Subscriptions charge a customer on a repeating schedule instead of once.',
  }),

  /* ── After the sale ────────────────────────────────────────────────────── */
  {
    key: 'commerce.returns.list',
    title: 'Returns',
    module: 'commerce',
    icon: Boxes,
    section: 'After the sale',
    order: 40,
    component: createEntityListSurface<NamedRow>({
      path: '/v1/commerce/returns',
      queryKey: ['commerce', 'returns'],
      rowId: (row) => row.id,
      searchPlaceholder: 'Search returns…',
      emptyTitle: 'No returns yet',
      emptyBody: 'When a customer sends something back, it shows up here.',
      emptyIcon: Boxes,
      columns: [{ key: 'id', header: 'Return', render: (row) => row.id, numeric: true }],
    }),
  },
  stub({
    key: 'commerce.reviews.list',
    title: 'Reviews',
    module: 'commerce',
    icon: Star,
    section: 'After the sale',
    order: 41,
    keywords: ['ratings', 'feedback', 'stars'],
    body: 'Reviews are what customers said about a product after buying it, and what you choose to publish.',
  }),
  stub({
    key: 'commerce.qa.list',
    title: 'Questions & answers',
    module: 'commerce',
    icon: HelpCircle,
    section: 'After the sale',
    order: 42,
    keywords: ['qa', 'questions', 'support'],
    body: 'Questions shoppers asked on a product page, and the answers you gave that everyone can now read.',
  }),
  stub({
    key: 'commerce.wishlists.list',
    title: 'Wishlists',
    module: 'commerce',
    icon: Heart,
    section: 'After the sale',
    order: 43,
    keywords: ['saved', 'favourites'],
    body: 'Wishlists are the products people saved for later — a good signal of what to stock or put on offer.',
  }),

  /* ── Selling ───────────────────────────────────────────────────────────── */
  stub({
    key: 'commerce.channels.list',
    title: 'Sales channels',
    module: 'commerce',
    icon: Store,
    section: 'Selling',
    order: 50,
    keywords: ['storefront', 'pos', 'places'],
    body: 'Sales channels are the different places you sell — your own site, a marketplace, in person.',
  }),
  stub({
    key: 'commerce.market',
    title: 'sparx.market',
    module: 'commerce',
    icon: ShoppingBag,
    section: 'Selling',
    order: 51,
    keywords: ['marketplace', 'listing'],
    body: 'sparx.market is the shared marketplace where your products can be listed alongside other sparx businesses.',
  }),
  stub({
    key: 'commerce.shipping.list',
    title: 'Shipping',
    module: 'commerce',
    icon: Truck,
    section: 'Selling',
    order: 52,
    keywords: ['delivery', 'rates', 'carriers', 'postage'],
    body: 'Shipping decides what delivery options a shopper sees and what each one costs them.',
  }),
  stub({
    key: 'commerce.tax.list',
    title: 'Tax',
    module: 'commerce',
    icon: Banknote,
    section: 'Selling',
    order: 53,
    keywords: ['vat', 'sales tax', 'gst'],
    body: 'Tax settings decide how much tax is added at checkout, based on what you sell and where you sell it.',
  }),

  /* ── Reporting / Setup ─────────────────────────────────────────────────── */
  stub({
    key: 'commerce.reports',
    title: 'Reports',
    module: 'commerce',
    icon: BarChart3,
    section: 'Reporting',
    order: 60,
    keywords: ['analytics', 'sales report', 'revenue'],
    body: 'Reports show how selling is going — revenue over time, best sellers, and where sales come from.',
  }),
  stub({
    key: 'commerce.providers',
    title: 'Payment providers',
    module: 'commerce',
    icon: Plug,
    section: 'Setup',
    order: 70,
    keywords: ['stripe', 'paypal', 'gateway', 'payments'],
    body: 'Payment providers are the services that actually take a customer’s money and pass it to you.',
  }),
  stub({
    key: 'commerce.settings',
    title: 'Selling settings',
    module: 'commerce',
    icon: SlidersHorizontal,
    section: 'Setup',
    order: 71,
    keywords: ['configuration', 'options'],
    body: 'The rules that apply to every sale — currency, checkout behaviour, and what a customer must provide.',
  }),
];
