// The shipped funnel library (docs/151 §9, docs/152 D3).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// A funnels module that opens to an empty list is not finished. "Create your
// first campaign" in front of a business owner who has never built one is a
// blank sheet of paper, and the honest outcome is that they close the tab. Seven
// working campaigns, one per module with an outcome worth chasing, is the
// difference between a feature and a thing somebody uses.
//
// ── EACH ONE IS FORKED, NEVER REFERENCED ─────────────────────────────────────
//
// Installing stamps a real `Funnel` row with `origin: 'system'` and the
// `recipeKey` it came from. The key is PROVENANCE — it is what lets the gallery
// say "you already have this one" — and nothing reads back through it at
// runtime. Editing an installed campaign never edits the library, and a later
// change to a recipe never rewrites what a tenant has already made theirs.
//
// ── AND EACH DECLARES ITS OWNING MODULE ──────────────────────────────────────
//
// Exactly like `SYSTEM_AUTOMATIONS`: a recipe installs when ITS module is
// active, so a commerce tenant gets cart recovery the moment commerce is on and
// a CMS-only publisher never sees a campaign about baskets. That is the same
// "write what applies and skip the rest" rule the blueprint installer follows —
// applied at the recipe, because a campaign about an event the tenant cannot
// emit is not a partial campaign, it is a wrong one.

import type { ConditionOperator } from '@wizeworks/automation-schemas';
import type { FunnelKind, FunnelStage } from './schemas.js';

export interface FunnelRecipe {
  /** Stable identity, stored on the stamped row as `recipeKey`. Permanent once
   *  shipped: it is how the gallery knows what a tenant already installed. */
  key: string;
  /** The module whose activation installs it. */
  module: string;
  name: string;
  /** What it is for, in the owner's words. Shown in the gallery and stored as
   *  the campaign's description, so it survives into the pane. */
  description: string;
  kind: FunnelKind;
  stages: FunnelStage[];
  /** Overrides the kind's default patience where the recipe knows better. */
  stallAfterHours?: number;
  /**
   * What counts as success, as a `ConditionGroup`.
   *
   * Every recipe HAS one. A campaign with no goal cannot be turned on (the
   * server refuses it), and shipping a library whose members all land as
   * un-activatable drafts would be a gallery of homework.
   */
  goal: {
    logic: 'AND' | 'OR';
    // `operator` is the REAL union, not `string`. It was `string`, and that is
    // how every recipe in this file shipped `is_not_empty` — an operator that
    // exists nowhere: not in the schema, not in the evaluator, not in the
    // console's dropdown.
    //
    // What it did was worse than being ignored. `ConditionGroup` accepted the
    // write and silently rewrote the condition into an EMPTY GROUP, which
    // matches everything — so the goal "they left an address" became "everybody
    // qualifies", and a campaign written to count the people who finished would
    // have counted everyone who started and reported a perfect rate. That hole
    // is closed at the schema now (groups are strict), and this type is what
    // stops a recipe reaching for a word the vocabulary does not have.
    conditions: { field: string; operator: ConditionOperator; value?: unknown }[];
  };
}

// ── NO RECIPE STARTS WITH AN ANONYMOUS `view` RUNG, AND THAT IS DELIBERATE ───
//
// A `view` rung counts page visits, which means it has to be told WHICH page —
// and a funnel with an unresolved view rung is refused activation (B3). Shipping
// seven campaigns that all land as drafts saying "say which page counts as
// 'Looked at the shop' before you turn it on" would make the library homework.
//
// So every recipe starts at the CAPTURE line, which needs no configuration and
// works the moment it is installed. An owner who wants the traffic rung above it
// adds one and picks the page, which is a deliberate act with an obvious reason
// rather than a chore standing between them and a working campaign.

// ── EACH GOAL NAMES SOMETHING THAT HAPPENS ──────────────────────────────────
//
// A goal is checked against the facts of an event about the person (an order
// paid, a booking made), and only for people already in the campaign, so it
// reads as "the thing this campaign waits for". These replaced one shared
// `email is_set`, which named a field no event carries and so never came true.

type Goal = FunnelRecipe['goal'];

const PAID: Goal = {
  logic: 'AND',
  conditions: [{ field: 'order.paymentStatus', operator: 'eq', value: 'paid' }],
};

const ORDERED_AGAIN: Goal = {
  logic: 'AND',
  conditions: [
    { field: 'order.paymentStatus', operator: 'eq', value: 'paid' },
    { field: 'customer.orderCount', operator: 'gte', value: 2 },
  ],
};

const BOOKED: Goal = {
  logic: 'AND',
  conditions: [{ field: 'booking.status', operator: 'in', value: ['requested', 'confirmed'] }],
};

const BOUGHT_OR_BOOKED: Goal = {
  logic: 'OR',
  conditions: [...PAID.conditions, ...BOOKED.conditions],
};

const BECAME_CUSTOMER: Goal = {
  logic: 'AND',
  conditions: [{ field: 'customer.lifecycleStage', operator: 'eq', value: 'customer' }],
};

const QUOTE_ACCEPTED: Goal = {
  logic: 'AND',
  conditions: [{ field: 'quote.stageName', operator: 'eq', value: 'Accepted' }],
};

// ── EACH STEP SAYS WHAT PUTS SOMEBODY ON IT ─────────────────────────────────
//
// `match` is checked against every event's facts (advance.ts). A step nothing can
// record was removed rather than shipped: it would report 0 forever, and zero
// reads as a measurement ("nobody opened it") when it means "nobody could tell".

type Match = NonNullable<FunnelRecipe['stages'][number]['match']>;

/** The event itself: `event.type` is added to every event's facts. */
function on(type: string): Match {
  return { logic: 'AND', conditions: [{ field: 'event.type', operator: 'eq', value: type }] };
}

function QUOTE(stageName: string): Match {
  return {
    logic: 'AND',
    conditions: [{ field: 'quote.stageName', operator: 'eq', value: stageName }],
  };
}

const QUALIFIED: Match = {
  logic: 'AND',
  conditions: [
    {
      field: 'customer.lifecycleStage',
      operator: 'in',
      value: ['marketing_qualified_lead', 'sales_qualified_lead', 'opportunity'],
    },
  ],
};

/** Has bought before and not for four months. Found by the nightly scan, since
 *  going quiet is the one thing with no event behind it. */
const LAPSED: Match = {
  logic: 'AND',
  conditions: [
    { field: 'customer.hasOrdered', operator: 'eq', value: true },
    { field: 'customer.daysSinceLastOrder', operator: 'gte', value: 120 },
  ],
};

const NO_SHOW: Match = {
  logic: 'AND',
  conditions: [{ field: 'booking.status', operator: 'eq', value: 'no_show' }],
};

export const FUNNEL_LIBRARY: readonly FunnelRecipe[] = [
  // ── Commerce ─────────────────────────────────────────────────────────────
  {
    key: 'cart-recovery',
    module: 'commerce',
    name: 'Basket recovery',
    description:
      'Somebody filled a basket and left without paying. This follows them up while they still remember what was in it.',
    kind: 'recovery',
    // Four hours is the kind default and it is right here: a basket left
    // overnight is a different shopper by morning.
    stages: [
      { key: 'basket', name: 'Left a basket behind', kind: 'capture', match: on('cart.abandoned') },
      {
        key: 'checkout',
        name: 'Started checking out',
        kind: 'engage',
        match: on('checkout.started'),
      },
      { key: 'paid', name: 'Paid', kind: 'convert' },
    ],
    goal: PAID,
  },
  {
    key: 'post-purchase',
    module: 'commerce',
    name: 'After the order',
    description:
      'Asks a happy customer for a review, then reminds them when it is about time to buy again. The cheapest sale you will make.',
    kind: 'purchase',
    // A month, because the second half of this campaign is a reorder nudge and
    // giving up after four hours would measure only the review ask.
    stallAfterHours: 30 * 24,
    stages: [
      { key: 'ordered', name: 'Paid for an order', kind: 'capture', match: on('order.paid') },
      { key: 'delivered', name: 'Got it', kind: 'engage', match: on('order.delivered') },
      { key: 'reviewed', name: 'Left a review', kind: 'engage', match: on('review.submitted') },
      { key: 'reordered', name: 'Ordered again', kind: 'convert' },
    ],
    goal: ORDERED_AGAIN,
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    key: 'welcome',
    module: 'crm',
    name: 'Welcome',
    description:
      'The first week after somebody gives you their email. Introduces the business and asks for one small thing.',
    kind: 'lead',
    stages: [
      {
        key: 'joined',
        name: 'Gave us their email',
        kind: 'capture',
        match: on('crm.customer.subscribed'),
      },
      { key: 'acted', name: 'Did the thing we asked', kind: 'convert' },
    ],
    goal: BOUGHT_OR_BOOKED,
  },
  {
    key: 'lead-nurture',
    module: 'crm',
    name: 'Lead nurture',
    description:
      'For an inquiry that is interested but not ready. Keeps in touch on a slow drip so you are still there when they are.',
    kind: 'lead',
    // Long on purpose. A nurture campaign that gives up in a fortnight is a
    // follow-up campaign wearing the wrong name.
    stallAfterHours: 60 * 24,
    stages: [
      { key: 'enquired', name: 'Got in touch', kind: 'capture', match: on('form.submitted') },
      { key: 'qualified', name: 'Looked like a fit', kind: 'qualify', match: QUALIFIED },
      {
        key: 'engaged',
        name: 'Replied to something',
        kind: 'engage',
        match: on('crm.engagement.received'),
      },
      { key: 'bought', name: 'Became a customer', kind: 'convert' },
    ],
    goal: BECAME_CUSTOMER,
  },
  {
    key: 'win-back',
    module: 'crm',
    name: 'Win back',
    description: 'For customers who used to buy and have gone quiet. Worth running twice a year.',
    kind: 'winback',
    stages: [
      { key: 'lapsed', name: 'Went quiet', kind: 'capture', match: LAPSED },
      { key: 'returned', name: 'Came back', kind: 'convert' },
    ],
    goal: PAID,
  },

  // ── B2B ──────────────────────────────────────────────────────────────────
  {
    key: 'quote-follow-up',
    module: 'b2b',
    name: 'Quote follow-up',
    description:
      'Chases a quote that has gone quiet. Most quotes are not refused, they are forgotten.',
    kind: 'lead',
    // Three weeks. A trade customer sitting on a quote is waiting for a budget
    // meeting, not ignoring you, and chasing at fourteen days reads as pushy.
    stallAfterHours: 21 * 24,
    stages: [
      { key: 'requested', name: 'Asked for a quote', kind: 'capture', match: QUOTE('Submitted') },
      { key: 'sent', name: 'We sent it', kind: 'engage', match: QUOTE('Quoted') },
      { key: 'accepted', name: 'Accepted', kind: 'convert' },
    ],
    goal: QUOTE_ACCEPTED,
  },

  // ── Scheduling ───────────────────────────────────────────────────────────
  {
    key: 'booking-no-show',
    module: 'scheduling',
    name: 'Missed appointment',
    description:
      'Someone booked and did not turn up. Offers them another time before they book somewhere else.',
    kind: 'booking',
    stages: [
      { key: 'missed', name: 'Did not turn up', kind: 'capture', match: NO_SHOW },
      { key: 'rebooked', name: 'Booked again', kind: 'convert' },
    ],
    goal: BOOKED,
  },
];

/** The recipes a tenant with these modules should have. Never filters the
 *  LIBRARY, only what applies to this tenant — the full set stays authored. */
export function recipesForModules(active: readonly string[]): FunnelRecipe[] {
  const set = new Set(active);
  return FUNNEL_LIBRARY.filter((r) => set.has(r.module));
}
