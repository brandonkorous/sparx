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
 * Group headings inside a nav panel, keyed by the platform's own section string.
 *
 * Keyed by the STRING, so this also does a second job: the platform ships
 * "Setup", "Set up", "Setting up" and "Settings" as four separate strings that
 * all mean the same thing in different modules, and "Reports" / "Reporting" as
 * two more. Mapping them onto one Piggles word each collapses them everywhere at
 * once, and a person moving between apps meets the same heading rather than four
 * spellings of it.
 */
export const PIGGLES_SECTIONS: Readonly<Record<string, string>> = {
  // The four spellings of one idea.
  Setup: 'Setting it up',
  'Set up': 'Setting it up',
  'Setting up': 'Setting it up',
  Settings: 'Setting it up',

  // ...and the two spellings of another. "How it is going" rather than
  // "Reports", because nobody opens their software wanting a report; they want
  // to know how it is going.
  Reports: 'How it is going',
  Reporting: 'How it is going',
  Results: 'How it is going',

  // Category nouns, replaced by the job.
  Catalog: 'What you sell',
  Pricing: 'What you charge',
  Selling: 'Where you sell',
  'Product panels': 'On a product',
  'In progress': 'Half-finished',
  Structure: 'How it is organised',
  Localization: 'Other languages',
  Library: 'Your library',
  Design: 'Your pages',
  Forms: 'What people send you',
  Sales: 'Winning work',
  Support: 'Helping people',
  Customers: 'Worth chasing',
  Planning: 'Looking ahead',
  Making: 'Making things',
  Counting: 'Counting it',
  Buying: 'Buying it in',
  'Going out': 'Going out the door',
  Scanning: 'Barcodes and scanning',
  Trade: 'Wholesale',
  Checks: 'Health checks',
  Compliance: 'Keeping it legal',
  Bookings: 'Your diary',
  'Connections & access': 'Who can get in',
  'Did we make money': 'Did you make money',

  // "What sparx does" named the other product in the navigation. It groups the
  // screens that decide what this software is set up to do for you, which is a
  // true and brand-free way to say it.
  'What sparx does': 'How Piggles is set up',

  // No entry for 'What you pay sparx'. Its one surface is hidden — what a
  // Piggles business pays WizeWorks lives on getpiggles.com and never in the
  // console (piggles/CLAUDE.md RULE #2), so the heading has nothing under it and
  // never renders. Renaming it would be inventing a screen.
};

/**
 * Screen names, by surface key.
 *
 * Grouped by the Piggles app they surface under, because that is the panel a
 * person reads them in — a name has to work beside its neighbours, not on its
 * own.
 */
export const PIGGLES_SURFACES: Readonly<Record<string, string>> = {
  // ── My Site ───────────────────────────────────────────────────────────────
  'builder.studio': 'Page editor',
  'builder.site': 'Your site',
  // "Blueprints" is a builder's word for a whole pre-made site. What it does for
  // the reader is save them starting from nothing.
  'builder.blueprints': 'Ready-made sites',
  'builder.pages': 'How your pages do',
  'builder.forms': 'Form replies',
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

  // ── Sell ──────────────────────────────────────────────────────────────────
  // A "collection" is a curated set shown on the site. RULE #3 names the word
  // itself as one a person must never be made to learn.
  'commerce.collections.list': 'Groups of products',
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
  'social.cadence': 'How often you post',
  'social.queue': 'Posts',

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
