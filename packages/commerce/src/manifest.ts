// Dashboard shell manifest for the Commerce module.
//
// Imported by the dashboard via `@sparx/commerce/manifest` — keep this file
// dependency-light: types from @sparx/ui/shell, icons from lucide-react,
// nothing else. See docs/24-dashboard-shell.md §3 for the contract.

import type { ModuleManifest } from '@sparx/ui/shell';
import {
  BarChart3,
  Boxes,
  CreditCard,
  FolderTree,
  Gift,
  Heart,
  HelpCircle,
  Inbox,
  LayoutGrid,
  Package,
  Package2,
  PackagePlus,
  Percent,
  Plug,
  Receipt,
  Repeat2,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  TicketPercent,
  Truck,
  Wallet,
} from 'lucide-react';

export const commerceManifest: ModuleManifest = {
  id: 'commerce',
  label: 'Commerce',
  icon: ShoppingCart,
  routePrefix: '/commerce',
  sections: [
    { id: 'products', label: 'Products', icon: Package, href: '/commerce/products' },
    { id: 'categories', label: 'Categories', icon: FolderTree, href: '/commerce/categories' },
    { id: 'collections', label: 'Collections', icon: LayoutGrid, href: '/commerce/collections' },
    { id: 'fitment', label: 'Fitment', icon: Boxes, href: '/commerce/fitment' },
    { id: 'pricing', label: 'Pricing', icon: Tag, href: '/commerce/pricing' },
    { id: 'discounts', label: 'Discounts', icon: Percent, href: '/commerce/discounts' },
    // Inventory + warehouses moved to the Inventory module (docs/100 P1e).
    { id: 'bundles', label: 'Bundles', icon: Package2, href: '/commerce/bundles' },
    { id: 'configurator', label: 'Configurator', icon: Settings2, href: '/commerce/configurator' },
    { id: 'gift-cards', label: 'Gift cards', icon: Gift, href: '/commerce/gift-cards' },
    {
      id: 'account-credit',
      label: 'Account credit',
      icon: Wallet,
      href: '/commerce/account-credit',
    },
    { id: 'carts', label: 'Carts', icon: ShoppingCart, href: '/commerce/carts' },
    {
      id: 'checkout-sessions',
      label: 'Checkout sessions',
      icon: CreditCard,
      href: '/commerce/checkout-sessions',
    },
    // Order management/fulfillment lives at /crm/orders (unified with the CRM
    // customer/order data model, docs/11 §1) rather than under /commerce — but
    // a commerce-only tenant with no CRM module must still be able to find and
    // fulfill their own orders. Cross-listing the same route here (rather than
    // moving it) keeps ONE Orders page instead of forking the UI; registry.ts's
    // getManifestForPath() resolves this module as the nav "owner" of the page
    // whenever CRM isn't enabled for the tenant, so the sidebar/breadcrumb stay
    // coherent either way.
    { id: 'orders', label: 'Orders', icon: Receipt, href: '/crm/orders' },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: Repeat2,
      href: '/commerce/subscriptions',
    },
    { id: 'returns', label: 'Returns', icon: Inbox, href: '/commerce/returns' },
    { id: 'reviews', label: 'Reviews', icon: Star, href: '/commerce/reviews' },
    { id: 'qa', label: 'Q&A', icon: HelpCircle, href: '/commerce/qa' },
    { id: 'wishlists', label: 'Wishlists', icon: Heart, href: '/commerce/wishlists' },
    { id: 'reports', label: 'Reports', icon: BarChart3, href: '/commerce/reports' },
    { id: 'shipping', label: 'Shipping', icon: Truck, href: '/commerce/shipping' },
    { id: 'tax', label: 'Tax', icon: Receipt, href: '/commerce/tax' },
    // Sales channels — connect/sync the marketplaces & social platforms a tenant
    // sells on. Owned by Commerce (the API gates it on the module); the revenue
    // ROLLUP is the money view in Finance → Channels.
    { id: 'channels', label: 'Sales channels', icon: Store, href: '/commerce/channels' },
    // sparx.market — the first-party marketplace, itself a sales channel. Owned by
    // Commerce; the money (settlement + payouts) is the view in Finance → Payouts.
    { id: 'market', label: 'sparx.market', icon: ShoppingBag, href: '/commerce/market' },
    { id: 'providers', label: 'Providers', icon: Plug, href: '/commerce/providers' },
    { id: 'settings', label: 'Settings', icon: Settings2, href: '/commerce/settings' },
  ],
  actions: [
    {
      id: 'commerce.product.create',
      label: 'Create product',
      icon: PackagePlus,
      href: '/commerce/products/new',
    },
    {
      id: 'commerce.discount.create',
      label: 'Create discount',
      icon: TicketPercent,
      href: '/commerce/discounts/new',
    },
    {
      id: 'commerce.gift-card.issue',
      label: 'Issue gift card',
      icon: Gift,
      href: '/commerce/gift-cards/new',
    },
  ],
  entityTypes: [
    { id: 'product', label: 'Product', routePrefix: '/commerce/products', hasDetailView: true },
    { id: 'category', label: 'Category', routePrefix: '/commerce/categories', hasDetailView: true },
    {
      id: 'collection',
      label: 'Collection',
      routePrefix: '/commerce/collections',
      hasDetailView: true,
    },
    { id: 'discount', label: 'Discount', routePrefix: '/commerce/discounts' },
    { id: 'gift-card', label: 'Gift card', routePrefix: '/commerce/gift-cards' },
    { id: 'account-credit', label: 'Account credit', routePrefix: '/commerce/account-credit' },
    { id: 'review', label: 'Review', routePrefix: '/commerce/reviews', hasDetailView: true },
    { id: 'qa-question', label: 'Question', routePrefix: '/commerce/qa', hasDetailView: true },
    {
      id: 'subscription',
      label: 'Subscription',
      routePrefix: '/commerce/subscriptions',
      hasDetailView: true,
    },
    {
      id: 'return',
      label: 'Return',
      routePrefix: '/commerce/returns',
      hasDetailView: true,
    },
    { id: 'bundle', label: 'Bundle', routePrefix: '/commerce/bundles', hasDetailView: true },
    { id: 'cart', label: 'Cart', routePrefix: '/commerce/carts', hasDetailView: true },
    {
      id: 'provider-installation',
      label: 'Provider',
      routePrefix: '/commerce/providers',
      hasDetailView: true,
    },
    {
      id: 'price-list',
      label: 'Price list',
      routePrefix: '/commerce/pricing',
      hasDetailView: true,
    },
    {
      id: 'configurator-template',
      label: 'Configurator',
      routePrefix: '/commerce/configurator',
      hasDetailView: true,
    },
    {
      id: 'shipping-profile',
      label: 'Shipping profile',
      // Profiles live nested under /commerce/shipping/profiles, but the
      // manifest's routePrefix is the entity's PARENT segment so
      // EntityRowLink's full-page fallback resolves cleanly.
      routePrefix: '/commerce/shipping/profiles',
      hasDetailView: true,
    },
    {
      id: 'shipping-zone',
      label: 'Shipping zone',
      routePrefix: '/commerce/shipping/zones',
      hasDetailView: true,
    },
    {
      id: 'tax-zone',
      label: 'Tax zone',
      routePrefix: '/commerce/tax/zones',
      hasDetailView: true,
    },
  ],
};
