// What things cost — price lists, discounts, tax and surcharges.

import { faPercent, faTag, faTicket, faWallet } from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { DiscountsListSurface } from '../../../surfaces/commerce/discounts-list';
import { DiscountDetailSurface } from '../../../surfaces/commerce/discount-detail';
import { GiftCardsListSurface } from '../../../surfaces/commerce/giftcards-list';
import { GiftCardDetailSurface } from '../../../surfaces/commerce/giftcard-detail';
import { AccountCreditSurface } from '../../../surfaces/commerce/account-credit';
import { PriceListsListSurface } from '../../../surfaces/commerce/price-lists-list';
import { PriceListDetailSurface } from '../../../surfaces/commerce/price-list-detail';

export const PRICING_SURFACES: SurfaceDefinition[] = [
  /* ── Pricing ───────────────────────────────────────────────────────────── */
  {
    key: 'commerce.pricing.list',
    title: 'Price lists',
    module: 'commerce',
    icon: faTag,
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
    icon: faTag,
    component: PriceListDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.discounts.list',
    title: 'Discounts',
    module: 'commerce',
    icon: faPercent,
    section: 'Pricing',
    order: 21,
    keywords: ['promotions', 'coupons', 'sale'],
    component: DiscountsListSurface,
  },
  {
    key: 'commerce.discount.detail',
    title: 'Discount',
    module: 'commerce',
    icon: faPercent,
    component: DiscountDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.giftcards.list',
    title: 'Gift cards',
    module: 'commerce',
    icon: faTicket,
    section: 'Pricing',
    order: 22,
    component: GiftCardsListSurface,
  },
  {
    key: 'commerce.giftcard.detail',
    title: 'Gift card',
    module: 'commerce',
    icon: faTicket,
    component: GiftCardDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.account-credit.list',
    title: 'Account credit',
    module: 'commerce',
    icon: faWallet,
    section: 'Pricing',
    order: 23,
    keywords: ['store credit', 'balance'],
    // One self-contained pane: master list + in-pane customer panel (balance,
    // grant form, ledger). No detail key — you grant with the balance in view.
    component: AccountCreditSurface,
  },
];
