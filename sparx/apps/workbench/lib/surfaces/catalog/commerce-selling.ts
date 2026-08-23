// Where the selling happens and how it is set up — channels, the marketplace,
// shipping, tax, payment providers, reporting and the module settings.

import {
  Banknote,
  BarChart3,
  Plug,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Truck,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { ChannelsSurface } from '../../../surfaces/commerce/channels';
import { MarketSurface } from '../../../surfaces/commerce/market';
import { ShippingSurface } from '../../../surfaces/commerce/shipping';
import { ShippingZoneDetailSurface } from '../../../surfaces/commerce/shipping-zone-detail';
import { ShippingProfileDetailSurface } from '../../../surfaces/commerce/shipping-profile-detail';
import { TaxSurface } from '../../../surfaces/commerce/tax';
import { TaxZoneDetailSurface } from '../../../surfaces/commerce/tax-zone-detail';
import { PaymentProvidersSurface } from '../../../surfaces/commerce/payment-providers';
import { PaymentProviderDetailSurface } from '../../../surfaces/commerce/payment-provider-detail';
import { ReportsSurface } from '../../../surfaces/commerce/reports';
import { CommerceSettingsSurface } from '../../../surfaces/commerce/commerce-settings';

export const SELLING_SURFACES: SurfaceDefinition[] = [
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
