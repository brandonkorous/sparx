// Maps a universal-search entity_type to the workbench surface that shows it.
//
// Global record search (the ⌘K "Search everything" box) returns hits from the
// Typesense `entities` collection plus the rich customer/order collections —
// each hit carries an `entity_type` and the owning module's `record_id`. This
// table is how a hit becomes something openable: entity_type → a registered
// surface key.
//
// Every DETAIL surface in the workbench reads `ctx.params.id` (verified across
// the whole catalog), so a routed hit opens with `{ id: recordId }`. A handful
// of entity types have no dedicated detail surface yet — a review is worked in
// a queue, a billing document lives in a list, a builder page is authored
// elsewhere — so those route to the closest LIST surface with NO id. That is
// still the right place, just not preselected; `withId: false` tells the opener
// not to hand over a record id it can't use.

export interface RecordRoute {
  /** Registered surface key to open. */
  readonly surface: string;
  /** Pass `{ id: recordId }`? False for list-surface fallbacks with no detail view. */
  readonly withId: boolean;
  /** Human, plural group heading in the palette ("Products", "Wholesale accounts"). */
  readonly label: string;
}

/**
 * entity_type → where it opens. Keys are the exact strings the universal
 * projectors + the customer/order collections stamp onto each document; adding
 * a new indexed entity type means adding its row here, or its hits silently
 * won't be routable (they're dropped, never opened onto a dead surface).
 */
export const RECORD_ROUTES: Record<string, RecordRoute> = {
  // ── Commerce ──────────────────────────────────────────────────────────────
  product: { surface: 'commerce.product.detail', withId: true, label: 'Products' },
  order: { surface: 'commerce.order.detail', withId: true, label: 'Orders' },
  collection: { surface: 'commerce.collection.detail', withId: true, label: 'Collections' },
  category: { surface: 'commerce.category.detail', withId: true, label: 'Categories' },
  bundle: { surface: 'commerce.bundle.detail', withId: true, label: 'Bundles' },
  discount: { surface: 'commerce.discount.detail', withId: true, label: 'Discounts' },
  gift_card: { surface: 'commerce.giftcard.detail', withId: true, label: 'Gift cards' },
  subscription: {
    surface: 'commerce.subscription.detail',
    withId: true,
    label: 'Subscriptions',
  },
  return: { surface: 'commerce.return.detail', withId: true, label: 'Returns' },
  // Reviews are worked one-at-a-time in a queue, not a detail pane — land on the
  // moderation table where the row is findable.
  review: { surface: 'commerce.reviews.list', withId: false, label: 'Reviews' },

  // ── CRM ───────────────────────────────────────────────────────────────────
  customer: { surface: 'crm.customer.detail', withId: true, label: 'Customers' },
  segment: { surface: 'crm.segment.detail', withId: true, label: 'Segments' },
  deal: { surface: 'crm.deal.detail', withId: true, label: 'Deals' },
  pipeline: { surface: 'crm.pipeline.detail', withId: true, label: 'Pipelines' },
  task: { surface: 'crm.task.detail', withId: true, label: 'Tasks' },

  // ── B2B ───────────────────────────────────────────────────────────────────
  b2b_account: { surface: 'b2b.account.detail', withId: true, label: 'Wholesale accounts' },
  quote: { surface: 'b2b.quote.detail', withId: true, label: 'Quotes' },
  // Billing documents span invoicing with no reliable 1:1 detail key — land on
  // the wholesale invoices list.
  billing_document: { surface: 'b2b.invoices.list', withId: false, label: 'Invoices' },

  // ── Inventory ─────────────────────────────────────────────────────────────
  warehouse: { surface: 'inventory.warehouses.detail', withId: true, label: 'Warehouses' },

  // ── CMS ───────────────────────────────────────────────────────────────────
  cms_entry: { surface: 'cms.content.detail', withId: true, label: 'Content' },
  // A builder page is authored in the site builder, not a workbench detail
  // surface — land on the content list.
  cms_page: { surface: 'cms.content.list', withId: false, label: 'Pages' },
  media: { surface: 'cms.media.detail', withId: true, label: 'Media' },

  // ── Site builder ──────────────────────────────────────────────────────────
  site: { surface: 'platform.settings.sites', withId: false, label: 'Sites' },
};

/** The route for an entity type, or undefined when the workbench can't open it. */
export function recordRoute(entityType: string): RecordRoute | undefined {
  return RECORD_ROUTES[entityType];
}
