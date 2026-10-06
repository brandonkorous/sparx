// The sale itself — before, during and after.
//
// Taking one at the counter, the order it becomes, the carts and checkouts
// still in flight, and everything that happens once the money has moved.

import {
  faBagShopping,
  faBoxes,
  faCartShopping,
  faCashRegister,
  faCircleQuestion,
  faCreditCard,
  faHeart,
  faRepeat,
  faRotateLeft,
  faStar,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { OrderDetailSurface } from '../../../surfaces/commerce/order-detail';
import { OrdersListSurface } from '../../../surfaces/commerce/orders-list';
import { SaleDetailSurface } from '../../../surfaces/commerce/sale-detail';
import { ReturnsListSurface } from '../../../surfaces/commerce/returns-list';
import { ReturnDetailSurface } from '../../../surfaces/commerce/return-detail';
import { CoresListSurface } from '../../../surfaces/commerce/cores-list';
import { CartsListSurface } from '../../../surfaces/commerce/carts-list';
import { CartDetailSurface } from '../../../surfaces/commerce/cart-detail';
import { CheckoutSessionsListSurface } from '../../../surfaces/commerce/checkout-list';
import { CheckoutSessionDetailSurface } from '../../../surfaces/commerce/checkout-detail';
import { SubscriptionsListSurface } from '../../../surfaces/commerce/subscriptions-list';
import { SubscriptionDetailSurface } from '../../../surfaces/commerce/subscription-detail';
import { RepeatOrderNewSurface } from '../../../surfaces/commerce/repeat-order-new';
import { ReviewsListSurface } from '../../../surfaces/commerce/reviews-list';
import { ReviewsQueueSurface } from '../../../surfaces/commerce/reviews-queue';
import { QaListSurface } from '../../../surfaces/commerce/qa-list';
import { QaQueueSurface } from '../../../surfaces/commerce/qa-queue';
import { WishlistsSurface } from '../../../surfaces/commerce/wishlists';

export const ORDER_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: orders are the module's heartbeat, so they lead
    // the panel above the Catalog/Pricing groups (unsectioned surfaces sort
    // first — see nav.ts).
    key: 'commerce.orders.list',
    title: 'Orders',
    module: 'commerce',
    icon: faBagShopping,
    order: 1,
    keywords: ['sales', 'purchases', 'fulfillment', 'shipments'],
    createSurface: 'commerce.sale.new',
    createLabel: 'Take a sale',
    component: OrdersListSurface,
  },
  {
    // The till. Most of this audience is paid in the room, so a sale that never
    // touched a website is the ordinary case, not the exception.
    //
    // It has two doors and they are not the same errand. From Orders it is a
    // counter sale; from Wholesale orders it is an order a shop rang through,
    // and `through` carries which, so the tab says what she pressed rather than
    // renaming her action on arrival (issue 743). The launcher passes nothing
    // and gets the counter name, which is the ordinary case.
    key: 'commerce.sale.new',
    title: (params) => (params.through === 'wholesale' ? 'Enter an order' : 'Take a sale'),
    module: 'commerce',
    icon: faCashRegister,
    order: 2,
    keywords: [
      'till',
      'counter',
      'cash',
      'card',
      'in person',
      'walk-in',
      'sell',
      'payment',
      // What the button on Wholesale orders says. Typing the words she just
      // pressed should find the screen they open.
      'enter an order',
      'phone order',
      'new order',
    ],
    component: SaleDetailSurface,
  },
  {
    key: 'commerce.order.detail',
    title: 'Order',
    module: 'commerce',
    icon: faBagShopping,
    component: OrderDetailSurface,
    // Reachable from the list or from taking a sale, not the launcher — opening
    // "an order" with no order in mind isn't a thing anyone wants.
    listed: false,
  },

  /* ── In progress ───────────────────────────────────────────────────────── */
  {
    key: 'commerce.carts.list',
    title: 'Carts',
    module: 'commerce',
    icon: faCartShopping,
    section: 'In progress',
    order: 30,
    keywords: ['abandoned', 'baskets'],
    component: CartsListSurface,
  },
  {
    key: 'commerce.cart.detail',
    title: 'Cart',
    module: 'commerce',
    icon: faCartShopping,
    component: CartDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.checkout-sessions.list',
    title: 'Checkout sessions',
    module: 'commerce',
    icon: faCreditCard,
    section: 'In progress',
    order: 31,
    keywords: ['payment', 'in progress'],
    component: CheckoutSessionsListSurface,
  },
  {
    key: 'commerce.checkout-session.detail',
    title: 'Checkout session',
    module: 'commerce',
    icon: faCreditCard,
    component: CheckoutSessionDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.subscriptions.list',
    title: 'Subscriptions',
    module: 'commerce',
    icon: faRepeat,
    section: 'In progress',
    order: 32,
    keywords: ['recurring', 'memberships', 'plans'],
    createLabel: 'Start a subscription',
    createSurface: 'commerce.subscription.new',
    component: SubscriptionsListSurface,
  },
  {
    key: 'commerce.subscription.new',
    title: 'New subscription',
    module: 'commerce',
    icon: faRepeat,
    component: RepeatOrderNewSurface,
    listed: false,
  },
  {
    key: 'commerce.subscription.detail',
    title: 'Subscription',
    module: 'commerce',
    icon: faRepeat,
    component: SubscriptionDetailSurface,
    listed: false,
  },

  /* ── After the sale ────────────────────────────────────────────────────── */
  {
    key: 'commerce.returns.list',
    title: 'Returns',
    module: 'commerce',
    icon: faBoxes,
    section: 'After the sale',
    order: 40,
    keywords: ['rma', 'refunds', 'sent back'],
    component: ReturnsListSurface,
  },
  {
    key: 'commerce.return.detail',
    title: 'Return',
    module: 'commerce',
    icon: faBoxes,
    component: ReturnDetailSurface,
    listed: false,
  },
  {
    // Rebuilt parts sold with a core deposit whose old part has not come back
    // (persona issue 051). Opens the order, where a core is received or kept.
    key: 'commerce.cores.list',
    title: 'Cores owed',
    module: 'commerce',
    icon: faRotateLeft,
    section: 'After the sale',
    order: 45,
    keywords: [
      'core',
      'cores',
      'core charge',
      'core deposit',
      'core return',
      'old part',
      'reman',
      'rebuilt',
      'deposit refund',
    ],
    component: CoresListSurface,
  },
  {
    // The scalable moderation TABLE — the primary, nav-listed reviews surface.
    // A card stack is unmanageable at hundreds of items a day, so triage, scan,
    // sort, filter and bulk decisions live here; the one-at-a-time card flow is
    // the `.queue` surface below, reached from this table's toolbar and rows.
    key: 'commerce.reviews.list',
    title: 'Reviews',
    module: 'commerce',
    icon: faStar,
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
    icon: faStar,
    besideWidth: 0.4,
    component: ReviewsQueueSurface,
    listed: false,
  },
  {
    // The scalable moderation TABLE for Q&A — the primary, nav-listed surface.
    key: 'commerce.qa.list',
    title: 'Questions & answers',
    module: 'commerce',
    icon: faCircleQuestion,
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
    icon: faCircleQuestion,
    besideWidth: 0.4,
    component: QaQueueSurface,
    listed: false,
  },
  {
    key: 'commerce.wishlists.list',
    title: 'Wishlists',
    module: 'commerce',
    icon: faHeart,
    section: 'After the sale',
    order: 43,
    keywords: ['saved', 'favorites'],
    component: WishlistsSurface,
  },
];
