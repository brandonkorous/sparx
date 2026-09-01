// What Piggles calls every screen and every group heading in the shared console.
//
// ── WHY THIS FILE IS AS LONG AS IT IS ───────────────────────────────────────
//
// `moduleLabels` renames the twenty modules and does nothing below that. The
// ~220 listed surfaces INSIDE them are what a person actually reads, and they
// were written for sparx's audience — an operator who came to run a system.
// Opening the Sell app under a brand for shop owners produced this:
//
//     Catalog · Fitment · Configurator · Product types · Collections
//     Pricing · Price lists · In progress · Carts · Checkout sessions
//
// Every one of those is a category name. Two of them — "collections" and price
// books — are named in piggles/CLAUDE.md RULE #3 as terms a person must never be
// made to learn. And two SECTIONS carried the other product's name outright:
// "What sparx does" and "What you pay sparx", sitting in the navigation.
//
// ── THE RULE THIS FILE IS WRITTEN UNDER ─────────────────────────────────────
//
// A screen's name is the shortest copy in the product and the most-read, so it
// gets the same treatment as a sentence: WRITTEN, never substituted. The
// generating question is piggles/CLAUDE.md RULE #3 — sparx names things by
// category, Piggles names them by what you are doing. "Fitment" is a category;
// "What fits what" is the job. A shop owner does not have a catalog, they have
// the things they sell.
//
// Deliberately NOT exhaustive. A platform title that is already plain and
// already right — Shelves, Walks, Bills to pay, Who you pay, Sent back, On the
// way — is left alone. Restating it here would create a second copy to keep in
// step for no gain, and the absence of an entry is the honest statement that
// the platform got that one right. About half the catalog is in that category.
//
// A `(fn)` title — one that names a RECORD, like an order number or a product's
// own name — cannot be overridden and should not be: that is the tenant's data,
// not the platform's vocabulary. See `resolveTitle` in the shared registry.

/**
 * Screen names, by surface key.
 *
 * Grouped by the Piggles app they surface under, because that is the panel a
 * person reads them in — a name has to work beside its neighbours, not on its
 * own.
 */
export const PIGGLES_SURFACES: Readonly<Record<string, string>> = {
  // ── My Site ───────────────────────────────────────────────────────────────
  //
  // No entry for `builder.studio`. There was one — "Page editor" — and the key
  // stopped existing when the whole-site editor was split into a pane per
  // document (`builder.page`, `builder.theme`, `builder.layout`, `builder.piece`,
  // `builder.publish`). An override for a key nothing registers renames nothing
  // and reads as a screen this brand has named, which is why it survived the
  // split unnoticed. Those five carry plain platform titles that are already
  // right, so they are absent from here on purpose too — see the note above.
  'builder.site': 'Your site',
  // "Blueprints" is a builder's word for a whole pre-made site. What it does for
  // the reader is save them starting from nothing.
  'builder.blueprints': 'Ready-made sites',
  'builder.pages': 'How your pages do',
  'builder.forms': 'Form replies',
  'builder.form-settings': 'Form settings',
  'builder.form-setting': 'Form settings',
  'builder.email': 'Email designs',

  // ── Content ───────────────────────────────────────────────────────────────
  'cms.media.list': 'Photos and files',
  'cms.taxonomy.list': 'Tags and topics',
  // "Content types" is the schema. The reader's version of that question is what
  // KIND of thing they are about to write.
  'cms.types.list': 'Kinds of content',
  // "Redirects" is infrastructure. What it means to a shop owner is that a link
  // they printed on a flyer two years ago still works.
  'cms.redirects.list': 'Old links',
  // Webhooks are developer territory and RULE #3 keeps them out of a
  // non-developer context. The capability is real; the name says what it buys.
  'cms.webhooks.list': 'Tell other software',
  // Unlisted, so it is never a nav row — but it is the PANE TAB once one is
  // open, and a tab reading "Webhook" is the jargon the list title avoids.
  'cms.webhooks.detail': 'Telling other software',

  // ── Sell ──────────────────────────────────────────────────────────────────
  // A "collection" is a curated set shown on the site. RULE #3 names the word
  // itself as one a person must never be made to learn.
  'commerce.collections.list': 'Groups of products',
  'commerce.collection.detail': 'Group of products',
  'commerce.product-types.list': 'Kinds of product',
  'commerce.product-types.detail': 'Kind of product',
  // Fitment is auto-parts trade language. Every business using it is answering
  // one question about a part and a machine.
  'commerce.fitment.list': 'What fits what',
  'commerce.configurator.list': 'Build-your-own',
  // "Price lists" is the same idea as a price book, which RULE #3 bans. These
  // are prices for particular customers, seasons or channels.
  'commerce.pricing.list': 'Special prices',
  'commerce.account-credit.list': 'Credit on account',
  // Both of these lists are abandonment: a basket nobody finished, a checkout
  // nobody completed. Naming them by the object hid what they are FOR.
  'commerce.carts.list': 'Baskets left behind',
  'commerce.checkout-sessions.list': 'Half-finished checkouts',
  'commerce.subscriptions.list': 'Repeat orders',
  'commerce.qa.list': 'Questions people ask',
  'commerce.channels.list': 'Where you sell',
  'commerce.shipping.list': 'Postage and delivery',
  'commerce.providers': 'How you take payment',
  'commerce.reports': 'How selling is going',
  // The panels that hang off one product. Each is a sentence about THAT
  // product, so each is named as one.
  'commerce.product.fitment': 'What it fits',
  'commerce.product.configurator': 'Build-your-own options',
  'commerce.product.reviews': 'Reviews and questions',
  'commerce.product.channels': 'Where it is listed',
  'commerce.product.subscriptions': 'Repeat order options',
  'commerce.product.stock': 'How many you have',
  'commerce.product.dropship': 'Shipped by a supplier',
  'commerce.product.trade-pricing': 'Wholesale price',
  'commerce.product.translations': 'Other languages',

  // ── Sell · wholesale ──────────────────────────────────────────────────────
  // "Accounts" collides with money in a product that also has a Money app.
  'b2b.accounts.list': 'Wholesale customers',
  'b2b.pricing-tiers.list': 'Wholesale prices',
  'b2b.approvals': 'Orders to approve',

  // ── Partners ──────────────────────────────────────────────────────────────
  //
  // The dropship module and the inventory module BOTH have a screen called
  // Suppliers, and Piggles' Partners app shows them side by side — two rows,
  // one word, two entirely different lists. The platform never had to solve
  // that because the two lived in different modules.
  //
  // So the dropship one is named by what makes it different: these are the
  // suppliers who post the parcel straight to your customer, and you never
  // touch the goods. `inventory.suppliers.list` keeps the plain "Suppliers",
  // because for most businesses that is the one they mean.
  'dropship.suppliers.list': 'Ship-direct suppliers',
  'dropship.products.list': 'What they can send',
  'dropship.orders.list': 'What they are sending',
  'dropship.analytics': 'What you made on it',
  // Same problem one row down: Money already has a "Bills to pay", and it means
  // everything the business owes. This one is narrower and lives in a different
  // app — supplier invoices, checked against what actually turned up.
  'inventory.supplier-bills': 'What suppliers billed you',

  // ── Stock ─────────────────────────────────────────────────────────────────
  // Most of this module was already written plainly and is left alone. These
  // are the ones still named after the mechanism rather than the job.
  'inventory.warehouse': 'Scanner mode',
  'inventory.transfers.list': 'Moving stock',
  'inventory.movements.list': 'Every change',
  'inventory.lots.list': 'Batches and serial numbers',
  'inventory.purchase-orders.list': 'Orders to suppliers',
  'inventory.receiving.list': 'Booking stock in',
  'inventory.reorder': 'What to reorder',
  'inventory.picking.list': 'Picking walks',
  'inventory.picking.throughput': 'How fast you pack',
  'inventory.assemblies.list': 'Making runs',
  'inventory.planning.classes': 'What matters most',
  'inventory.reports': 'Stock reports',
  // "Integrity" is a database word for a screen that lists things which do not
  // add up.
  'inventory.integrity': 'Things that do not add up',
  'inventory.units': 'Units of measure',
  'inventory.sources': 'Counts from elsewhere',
  'inventory.consignment': 'Paying for what sold',
  'inventory.stock.grid': 'Edit a lot at once',
  // Was "Waiting list", which is also what the Bookings diary calls its queue of
  // people hoping for a cancelled slot. Two rows of that name in one launcher,
  // meaning two completely different things — one is customers waiting for a
  // haircut, the other is orders waiting for stock.
  'inventory.backorders': 'Waiting for stock',

  // ── Customers ─────────────────────────────────────────────────────────────
  // RULE #3: never make a person understand "CRM".
  'crm.settings': 'How this app behaves',
  'crm.segments.list': 'Groups of customers',
  'crm.duplicates.list': 'Possible duplicates',
  'crm.pipelines.list': 'How a deal moves',
  'crm.tasks.list': 'Things to do',
  'crm.tickets.list': 'Help requests',
  // "Record types" and "object types" are both the schema talking. What the
  // owner is doing is deciding what they want to keep track of.
  'crm.object-types.list': 'Things you track',
  'crm.object-type.detail': 'Thing you track',
  'crm.scoring': 'Who is worth chasing',
  'crm.reports': 'Customer reports',
  // Home has a "Dashboards" too, and it is the general one. Named the same way
  // as the report row directly above, so the pair reads as a set.
  'crm.dashboards': 'Customer dashboards',

  // ── Messages ──────────────────────────────────────────────────────────────
  // This app carries email AND live chat, so a bare "Inbox" would be one of two
  // inboxes with the same name.
  'chat.inbox': 'Live chat',
  'chat.overview': 'Chat activity',
  'email.broadcasts.list': 'Email campaigns',
  'email.sequences.list': 'Automatic emails',

  // ── Bookings ──────────────────────────────────────────────────────────────
  'scheduling.resources.list': 'People and equipment',
  'scheduling.reports': 'How bookings are going',

  // ── Invoices ──────────────────────────────────────────────────────────────
  'invoicing.workflows': 'What happens when',
  'invoicing.templates': 'How invoices look',

  // ── Money ─────────────────────────────────────────────────────────────────
  'finance.payouts.list': 'Money paid to you',
  // "Profit" is the accountant's word and it is also slightly wrong for a sole
  // trader reading it. What they want to know is what they kept.
  'finance.profit': 'What you kept',

  // ── Get Found ─────────────────────────────────────────────────────────────
  'seo.performance': 'How people find you',
  'seo.audits': 'Things worth fixing',
  // The platform names this after Google's product. A person who has one knows
  // what it is; a person who does not reads a proper noun and learns nothing —
  // and the screen's job is a sentence either of them understands. The connect
  // button inside it still says Google Search Console, which is where the proper
  // noun belongs.
  'seo.search-console': 'What people searched for',
  //
  // ── ...and the social half of it ──────────────────────────────────────────
  //
  // Five of these seven screens are renamed, which is far more than this file
  // usually does — the platform's titles are plain, and plain is normally left
  // alone. The problem here is not the words, it is that FOUR of them are the
  // same word as a row somewhere else in this console:
  //
  //   Calendar     · social AND the Bookings diary
  //   Inbox        · social AND live chat
  //   Approvals    · social AND wholesale order sign-off
  //   Connections  · social accounts AND the app called Connections
  //
  // Inside the panel a "Social" heading tells them apart. In the launcher there
  // is no heading — it is a flat list of every screen by name — so searching
  // "inbox" offered two identical rows and searching "connections" offered a row
  // that is not the app of that name. Naming them by what they hold fixes both
  // places at once, and puts the word "social" in a panel where it appeared
  // exactly once.
  'social.calendar': 'What is going out, and when',
  'social.queue': 'Posts',
  'social.insights': 'How your posts did',
  'social.inbox': 'Comments and replies',
  'social.approvals': 'Posts waiting on you',
  'social.cadence': 'How often you post',
  'social.connections': 'Your social accounts',

  // ── Automations ───────────────────────────────────────────────────────────
  'automations.recipes': 'Ready-made automations',
  'automations.reports': 'What has run',

  // ── Connections ───────────────────────────────────────────────────────────
  'ai.overview': 'What is connected',
  'ai.tools': 'What it may do',

  // ── The console itself ────────────────────────────────────────────────────
  // "Pulse" is a name, not a description, and it is the screen that answers
  // "what has been happening".
  'platform.pulse': 'What has been happening',
  'platform.settings.general': 'Business details',
  'platform.settings.industry': 'What kind of business',
  'platform.settings.sample-data': 'Practice data',
  'platform.settings.integrations': 'Other software',
  'platform.settings.ai': 'AI connections',
  'platform.settings.security': 'Signing in and security',
  'platform.migrate': 'Move in from somewhere else',
  'platform.feedback.list': 'What you told us',
  'analytics.dashboards.list': 'Dashboards',
};
