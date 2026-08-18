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
  Shapes,
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
import { OrderDetailSurface } from '../../../surfaces/commerce/order-detail';
import { OrdersListSurface } from '../../../surfaces/commerce/orders-list';
import { ProductDetailSurface } from '../../../surfaces/commerce/product-detail';
import { ProductsListSurface } from '../../../surfaces/commerce/products-list';
import { ProductTypesListSurface } from '../../../surfaces/commerce/product-types-list';
import { ProductTypeDetailSurface } from '../../../surfaces/commerce/product-type-detail';
import { ProductChannelsSurface } from '../../../surfaces/commerce/product-channels';
import { ProductConfiguratorSurface } from '../../../surfaces/commerce/product-configurator';
import { ProductDropshipSurface } from '../../../surfaces/commerce/product-dropship';
import { ProductFitmentSurface } from '../../../surfaces/commerce/product-fitment';
import { ProductReviewsSurface } from '../../../surfaces/commerce/product-reviews';
import { ProductStockSurface } from '../../../surfaces/commerce/product-stock';
import { ProductSubscriptionsSurface } from '../../../surfaces/commerce/product-subscriptions';
import { ProductTradePricingSurface } from '../../../surfaces/commerce/product-trade-pricing';
import { ProductTranslationsSurface } from '../../../surfaces/commerce/product-translations';
import { CollectionsListSurface } from '../../../surfaces/commerce/collections-list';
import { CollectionDetailSurface } from '../../../surfaces/commerce/collection-detail';
import { CategoriesListSurface } from '../../../surfaces/commerce/categories-list';
import { CategoryDetailSurface } from '../../../surfaces/commerce/category-detail';
import { ReturnsListSurface } from '../../../surfaces/commerce/returns-list';
import { ReturnDetailSurface } from '../../../surfaces/commerce/return-detail';
import { CartsListSurface } from '../../../surfaces/commerce/carts-list';
import { CartDetailSurface } from '../../../surfaces/commerce/cart-detail';
import { CheckoutSessionsListSurface } from '../../../surfaces/commerce/checkout-list';
import { CheckoutSessionDetailSurface } from '../../../surfaces/commerce/checkout-detail';
import { SubscriptionsListSurface } from '../../../surfaces/commerce/subscriptions-list';
import { SubscriptionDetailSurface } from '../../../surfaces/commerce/subscription-detail';
import { ReviewsListSurface } from '../../../surfaces/commerce/reviews-list';
import { ReviewsQueueSurface } from '../../../surfaces/commerce/reviews-queue';
import { QaListSurface } from '../../../surfaces/commerce/qa-list';
import { QaQueueSurface } from '../../../surfaces/commerce/qa-queue';
import { WishlistsSurface } from '../../../surfaces/commerce/wishlists';
import { ChannelsSurface } from '../../../surfaces/commerce/channels';
import { MarketSurface } from '../../../surfaces/commerce/market';
import { DiscountsListSurface } from '../../../surfaces/commerce/discounts-list';
import { DiscountDetailSurface } from '../../../surfaces/commerce/discount-detail';
import { GiftCardsListSurface } from '../../../surfaces/commerce/giftcards-list';
import { GiftCardDetailSurface } from '../../../surfaces/commerce/giftcard-detail';
import { AccountCreditSurface } from '../../../surfaces/commerce/account-credit';
import { BundlesListSurface } from '../../../surfaces/commerce/bundles-list';
import { BundleDetailSurface } from '../../../surfaces/commerce/bundle-detail';
import { ConfiguratorListSurface } from '../../../surfaces/commerce/configurator-list';
import { ConfiguratorTemplateDetailSurface } from '../../../surfaces/commerce/configurator-template-detail';
import { ShippingSurface } from '../../../surfaces/commerce/shipping';
import { ShippingZoneDetailSurface } from '../../../surfaces/commerce/shipping-zone-detail';
import { ShippingProfileDetailSurface } from '../../../surfaces/commerce/shipping-profile-detail';
import { TaxSurface } from '../../../surfaces/commerce/tax';
import { TaxZoneDetailSurface } from '../../../surfaces/commerce/tax-zone-detail';
import { PaymentProvidersSurface } from '../../../surfaces/commerce/payment-providers';
import { PaymentProviderDetailSurface } from '../../../surfaces/commerce/payment-provider-detail';
import { ReportsSurface } from '../../../surfaces/commerce/reports';
import { CommerceSettingsSurface } from '../../../surfaces/commerce/commerce-settings';
import { PriceListsListSurface } from '../../../surfaces/commerce/price-lists-list';
import { PriceListDetailSurface } from '../../../surfaces/commerce/price-list-detail';
import { FitmentListSurface } from '../../../surfaces/commerce/fitment-list';
import { FitmentDomainDetailSurface } from '../../../surfaces/commerce/fitment-domain-detail';

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
    // Custom list, not the generic entity list: it carries its own "Add a
    // collection" button and distinguishes manual from rule-driven collections.
    component: CollectionsListSurface,
  },
  {
    key: 'commerce.collection.detail',
    title: 'Collection',
    module: 'commerce',
    icon: Layers,
    component: CollectionDetailSurface,
    // Opened from the list ({id:'new'} to create, {id} to edit); a create is the
    // same surface as an edit, so it is a pane, not a launcher entry.
    listed: false,
  },
  {
    key: 'commerce.categories.list',
    title: 'Categories',
    module: 'commerce',
    icon: Tags,
    section: 'Catalog',
    order: 12,
    // Custom list that FLATTENS the category tree — the generic list showed only
    // root categories, so every sub-category was unreachable. Carries its own add.
    component: CategoriesListSurface,
  },
  {
    key: 'commerce.category.detail',
    title: 'Category',
    module: 'commerce',
    icon: Tags,
    component: CategoryDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.bundles.list',
    title: 'Bundles',
    module: 'commerce',
    icon: Blocks,
    section: 'Catalog',
    order: 13,
    keywords: ['kits', 'packages', 'sets'],
    component: BundlesListSurface,
  },
  {
    key: 'commerce.bundle.detail',
    title: 'Bundle',
    module: 'commerce',
    icon: Blocks,
    component: BundleDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.fitment.list',
    title: 'Fitment',
    module: 'commerce',
    icon: Puzzle,
    section: 'Catalog',
    order: 14,
    keywords: ['compatibility', 'fits', 'vehicles', 'models'],
    component: FitmentListSurface,
    createSurface: 'commerce.fitment.domain.detail',
    createLabel: 'New compatibility list',
  },
  {
    key: 'commerce.fitment.domain.detail',
    title: 'Compatibility list',
    module: 'commerce',
    icon: Puzzle,
    component: FitmentDomainDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.configurator.list',
    title: 'Configurator',
    module: 'commerce',
    icon: Settings2,
    section: 'Catalog',
    order: 15,
    keywords: ['options', 'custom', 'build'],
    component: ConfiguratorListSurface,
  },
  {
    key: 'commerce.configurator-template.detail',
    title: 'Build template',
    module: 'commerce',
    icon: Settings2,
    component: ConfiguratorTemplateDetailSurface,
    listed: false,
  },
  // Product TYPES (docs/143) — the typed attribute schema a product carries, the
  // commerce mirror of CMS content types. NOT a product facet (the frozen set
  // above): this is a catalog-structure list + its editor, added here per docs/143
  // §6.7, so the "do not add a facet" rule above does not apply.
  {
    key: 'commerce.product-types.list',
    title: 'Product types',
    module: 'commerce',
    icon: Shapes,
    section: 'Catalog',
    order: 16,
    keywords: ['attributes', 'schema', 'fields', 'kind', 'fabric', 'ingredients', 'specs'],
    component: ProductTypesListSurface,
    createSurface: 'commerce.product-types.detail',
    createLabel: 'New product type',
  },
  {
    key: 'commerce.product-types.detail',
    title: 'Product type',
    module: 'commerce',
    icon: Shapes,
    component: ProductTypeDetailSurface,
    // Opened from the list and the nav panel's `+` ({key:'new'} to define, {key} to
    // edit) — a create is the same surface as an edit, so it is a pane, not a
    // launcher entry of its own.
    listed: false,
  },

  /* ── Pricing ───────────────────────────────────────────────────────────── */
  {
    key: 'commerce.pricing.list',
    title: 'Price lists',
    module: 'commerce',
    icon: Tag,
    section: 'Pricing',
    order: 20,
    keywords: ['price lists', 'trade', 'wholesale', 'rules'],
    component: PriceListsListSurface,
    createSurface: 'commerce.pricelist.detail',
    createLabel: 'Add a price list',
  },
  {
    key: 'commerce.pricelist.detail',
    title: 'Price list',
    module: 'commerce',
    icon: Tag,
    component: PriceListDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.discounts.list',
    title: 'Discounts',
    module: 'commerce',
    icon: Percent,
    section: 'Pricing',
    order: 21,
    keywords: ['promotions', 'coupons', 'sale'],
    component: DiscountsListSurface,
  },
  {
    key: 'commerce.discount.detail',
    title: 'Discount',
    module: 'commerce',
    icon: Percent,
    component: DiscountDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.giftcards.list',
    title: 'Gift cards',
    module: 'commerce',
    icon: Ticket,
    section: 'Pricing',
    order: 22,
    component: GiftCardsListSurface,
  },
  {
    key: 'commerce.giftcard.detail',
    title: 'Gift card',
    module: 'commerce',
    icon: Ticket,
    component: GiftCardDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.account-credit.list',
    title: 'Account credit',
    module: 'commerce',
    icon: Wallet,
    section: 'Pricing',
    order: 23,
    keywords: ['store credit', 'balance'],
    // One self-contained pane: master list + in-pane customer panel (balance,
    // grant form, ledger). No detail key — you grant with the balance in view.
    component: AccountCreditSurface,
  },

  /* ── In progress ───────────────────────────────────────────────────────── */
  {
    key: 'commerce.carts.list',
    title: 'Carts',
    module: 'commerce',
    icon: ShoppingCart,
    section: 'In progress',
    order: 30,
    keywords: ['abandoned', 'baskets'],
    component: CartsListSurface,
  },
  {
    key: 'commerce.cart.detail',
    title: 'Cart',
    module: 'commerce',
    icon: ShoppingCart,
    component: CartDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.checkout-sessions.list',
    title: 'Checkout sessions',
    module: 'commerce',
    icon: CreditCard,
    section: 'In progress',
    order: 31,
    keywords: ['payment', 'in progress'],
    component: CheckoutSessionsListSurface,
  },
  {
    key: 'commerce.checkout-session.detail',
    title: 'Checkout session',
    module: 'commerce',
    icon: CreditCard,
    component: CheckoutSessionDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.subscriptions.list',
    title: 'Subscriptions',
    module: 'commerce',
    icon: Repeat2,
    section: 'In progress',
    order: 32,
    keywords: ['recurring', 'memberships', 'plans'],
    component: SubscriptionsListSurface,
  },
  {
    key: 'commerce.subscription.detail',
    title: 'Subscription',
    module: 'commerce',
    icon: Repeat2,
    component: SubscriptionDetailSurface,
    listed: false,
  },

  /* ── After the sale ────────────────────────────────────────────────────── */
  {
    key: 'commerce.returns.list',
    title: 'Returns',
    module: 'commerce',
    icon: Boxes,
    section: 'After the sale',
    order: 40,
    keywords: ['rma', 'refunds', 'sent back'],
    component: ReturnsListSurface,
  },
  {
    key: 'commerce.return.detail',
    title: 'Return',
    module: 'commerce',
    icon: Boxes,
    component: ReturnDetailSurface,
    listed: false,
  },
  {
    // The scalable moderation TABLE — the primary, nav-listed reviews surface.
    // A card stack is unmanageable at hundreds of items a day, so triage, scan,
    // sort, filter and bulk decisions live here; the one-at-a-time card flow is
    // the `.queue` surface below, reached from this table's toolbar and rows.
    key: 'commerce.reviews.list',
    title: 'Reviews',
    module: 'commerce',
    icon: Star,
    section: 'After the sale',
    order: 41,
    keywords: ['ratings', 'feedback', 'stars', 'moderation', 'queue'],
    component: ReviewsListSurface,
  },
  {
    // The heads-down card flow: the backlog one review at a time, inline reply +
    // show/hide/delete, kept for focused moderation. Opened from the table — at
    // the top of the backlog via "Work the queue", or focused on one review via
    // a row click ({ focusId }). Not launcher-listed: it is reached THROUGH the
    // table, never opened cold.
    key: 'commerce.reviews.queue',
    title: 'Reviews queue',
    module: 'commerce',
    icon: Star,
    besideWidth: 0.4,
    component: ReviewsQueueSurface,
    listed: false,
  },
  {
    // The scalable moderation TABLE for Q&A — the primary, nav-listed surface.
    key: 'commerce.qa.list',
    title: 'Questions & answers',
    module: 'commerce',
    icon: HelpCircle,
    section: 'After the sale',
    order: 42,
    keywords: ['qa', 'questions', 'support', 'moderation', 'queue'],
    component: QaListSurface,
  },
  {
    // The heads-down Q&A card flow — the two-step answer-then-show semantics kept
    // verbatim. Opened from the table's "Work the queue" or a focused row click.
    key: 'commerce.qa.queue',
    title: 'Questions queue',
    module: 'commerce',
    icon: HelpCircle,
    besideWidth: 0.4,
    component: QaQueueSurface,
    listed: false,
  },
  {
    key: 'commerce.wishlists.list',
    title: 'Wishlists',
    module: 'commerce',
    icon: Heart,
    section: 'After the sale',
    order: 43,
    keywords: ['saved', 'favourites'],
    component: WishlistsSurface,
  },

  /* ── Selling ───────────────────────────────────────────────────────────── */
  {
    key: 'commerce.channels.list',
    title: 'Sales channels',
    module: 'commerce',
    icon: Store,
    section: 'Selling',
    order: 50,
    keywords: ['storefront', 'pos', 'places'],
    component: ChannelsSurface,
  },
  {
    key: 'commerce.market',
    title: 'sparx.market',
    module: 'commerce',
    icon: ShoppingBag,
    section: 'Selling',
    order: 51,
    keywords: ['marketplace', 'listing'],
    component: MarketSurface,
  },
  {
    key: 'commerce.shipping.list',
    title: 'Shipping',
    module: 'commerce',
    icon: Truck,
    section: 'Selling',
    order: 52,
    keywords: ['delivery', 'rates', 'carriers', 'postage'],
    component: ShippingSurface,
    createSurface: 'commerce.shipping.zone.detail',
    createLabel: 'Add a delivery region',
  },
  {
    key: 'commerce.shipping.zone.detail',
    title: 'Delivery region',
    module: 'commerce',
    icon: Truck,
    component: ShippingZoneDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.shipping.profile.detail',
    title: 'Delivery profile',
    module: 'commerce',
    icon: Truck,
    component: ShippingProfileDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.tax.list',
    title: 'Tax',
    module: 'commerce',
    icon: Banknote,
    section: 'Selling',
    order: 53,
    keywords: ['vat', 'sales tax', 'gst'],
    component: TaxSurface,
    createSurface: 'commerce.tax.zone.detail',
    createLabel: 'Add a place',
  },
  {
    key: 'commerce.tax.zone.detail',
    title: 'Tax place',
    module: 'commerce',
    icon: Banknote,
    component: TaxZoneDetailSurface,
    listed: false,
  },

  /* ── Reporting / Setup ─────────────────────────────────────────────────── */
  {
    key: 'commerce.reports',
    title: 'Reports',
    module: 'commerce',
    icon: BarChart3,
    section: 'Reporting',
    order: 60,
    keywords: ['analytics', 'sales report', 'revenue'],
    // Not a singleton on purpose: each instance owns its own date range, so two
    // side by side is a real comparison, not a duplicate.
    component: ReportsSurface,
  },
  {
    key: 'commerce.provider.detail',
    title: 'Payment provider',
    module: 'commerce',
    icon: Plug,
    component: PaymentProviderDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.providers',
    title: 'Payment providers',
    module: 'commerce',
    icon: Plug,
    section: 'Setup',
    order: 70,
    keywords: ['stripe', 'paypal', 'gateway', 'payments'],
    component: PaymentProvidersSurface,
  },
  {
    key: 'commerce.settings',
    title: 'Selling settings',
    module: 'commerce',
    icon: SlidersHorizontal,
    section: 'Setup',
    order: 71,
    keywords: ['configuration', 'options'],
    // A second copy is meaningless — there is one set of selling settings.
    singleton: true,
    component: CommerceSettingsSurface,
  },
];
