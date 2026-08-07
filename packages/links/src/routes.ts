// The address table — every surface the workbench can show, and the path that
// opens it.
//
// Read this as the app's public URL vocabulary. It is written for the person
// pasting a link into a chat message, not for the code: `/commerce/orders/:id`,
// `/settings/domains`, `/inventory/purchase-orders/:id`. Where the product calls
// something by a plain name, so does the path — `/scheduling/people-and-equipment`
// rather than `/scheduling/resources`, because "resources" is our word, not the
// owner's.
//
// THREE RULES, all enforced by tests rather than by care:
//
//   1. Exactly one route per surface, exactly one surface per route.
//      `scripts/check-surface-routes.mjs` diffs this table against the registered
//      surface keys in apps/workbench/lib/surfaces/catalog/*.ts and fails the
//      build on either kind of drift. That is what makes a new surface without an
//      address impossible rather than merely discouraged.
//   2. At most one route per entity type. The entity mapping is what universal
//      search and the notification bell resolve through, and two homes for
//      `order` means the bell and the palette disagree.
//   3. A path parameter must be named EXACTLY as the surface reads it from
//      `ctx.params`. `:variantId` on the stock item, `:memberId` on a teammate,
//      `:key` on a blueprint — the matcher hands the path parameter straight
//      through under its own name, so a rename here silently opens an empty pane.
//
// Params a surface accepts but the path does not name (an invoice list filtered
// to one account, a composer seeded from a product) ride as query parameters and
// round-trip unchanged. That is a deliberate fallback, not an omission: a path
// segment is for the thing the address is ABOUT.

import type { AppRoute } from './types';

export const ROUTES: readonly AppRoute[] = [
  /* ── The workbench itself ─────────────────────────────────────────────── */
  { path: '/home', surface: 'workbench.home' },
  { path: '/pulse', surface: 'platform.pulse' },
  { path: '/feedback', surface: 'platform.feedback.list' },
  {
    path: '/feedback/:id',
    surface: 'platform.feedback.thread',
    entity: 'feedback',
    entityLabel: 'Feedback',
  },
  // Where a link that resolves to nothing lands. Addressable on purpose: it is a
  // pane like any other, so it closes, it survives a reload, and it can say what
  // was wrong with the link instead of the shell simply doing nothing.
  { path: '/link-not-found', surface: 'platform.link.unresolved' },

  /* ── Getting set up ───────────────────────────────────────────────────── */
  { path: '/get-set-up', surface: 'workbench.welcome' },
  { path: '/get-set-up/describe-your-business', surface: 'workbench.onboarding.story' },
  { path: '/get-set-up/steps', surface: 'workbench.onboarding' },

  /* ── Settings (account-level; the platform module) ────────────────────── */
  { path: '/settings/business', surface: 'platform.settings.general' },
  { path: '/settings/team', surface: 'platform.settings.team' },
  { path: '/settings/team/:memberId', surface: 'platform.settings.team.member' },
  {
    path: '/settings/sites',
    surface: 'platform.settings.sites',
    entity: 'site',
    entityLabel: 'Sites',
  },
  { path: '/settings/sites/:id', surface: 'platform.settings.site' },
  { path: '/settings/domains', surface: 'platform.settings.domains' },
  { path: '/settings/domains/:id', surface: 'platform.settings.domain' },
  { path: '/settings/notifications', surface: 'platform.settings.notifications' },
  { path: '/settings/modules', surface: 'platform.settings.modules' },
  { path: '/settings/industry', surface: 'platform.settings.industry' },
  { path: '/settings/sample-data', surface: 'platform.settings.sample-data' },
  { path: '/settings/integrations', surface: 'platform.settings.integrations' },
  { path: '/settings/integrations/:id', surface: 'platform.settings.integration' },
  { path: '/settings/ai', surface: 'platform.settings.ai' },
  { path: '/settings/partner-access', surface: 'platform.settings.partner' },
  { path: '/settings/security', surface: 'platform.settings.security' },

  /* ── Selling ──────────────────────────────────────────────────────────── */
  { path: '/commerce/orders', surface: 'commerce.orders.list' },
  {
    path: '/commerce/orders/:id',
    surface: 'commerce.order.detail',
    entity: 'order',
    entityLabel: 'Orders',
  },
  { path: '/commerce/products', surface: 'commerce.products.list' },
  {
    path: '/commerce/products/:id',
    surface: 'commerce.product.detail',
    entity: 'product',
    entityLabel: 'Products',
  },
  // The product panels. Each is a pane in its own right (the workbench offers
  // surfaces, never compositions), so each has its own address — and each reads
  // `productId`, not `id`, because it is ABOUT a product rather than being one.
  { path: '/commerce/products/:productId/stock', surface: 'commerce.product.stock' },
  { path: '/commerce/products/:productId/fitment', surface: 'commerce.product.fitment' },
  { path: '/commerce/products/:productId/configurator', surface: 'commerce.product.configurator' },
  {
    path: '/commerce/products/:productId/trade-pricing',
    surface: 'commerce.product.trade-pricing',
  },
  { path: '/commerce/products/:productId/reviews', surface: 'commerce.product.reviews' },
  { path: '/commerce/products/:productId/listings', surface: 'commerce.product.channels' },
  { path: '/commerce/products/:productId/dropshipping', surface: 'commerce.product.dropship' },
  {
    path: '/commerce/products/:productId/subscriptions',
    surface: 'commerce.product.subscriptions',
  },
  { path: '/commerce/products/:productId/translations', surface: 'commerce.product.translations' },
  { path: '/commerce/collections', surface: 'commerce.collections.list' },
  {
    path: '/commerce/collections/:id',
    surface: 'commerce.collection.detail',
    entity: 'collection',
    entityLabel: 'Collections',
  },
  { path: '/commerce/categories', surface: 'commerce.categories.list' },
  {
    path: '/commerce/categories/:id',
    surface: 'commerce.category.detail',
    entity: 'category',
    entityLabel: 'Categories',
  },
  { path: '/commerce/bundles', surface: 'commerce.bundles.list' },
  {
    path: '/commerce/bundles/:id',
    surface: 'commerce.bundle.detail',
    entity: 'bundle',
    entityLabel: 'Bundles',
  },
  { path: '/commerce/fitment', surface: 'commerce.fitment.list' },
  { path: '/commerce/fitment/:id', surface: 'commerce.fitment.domain.detail' },
  { path: '/commerce/configurator', surface: 'commerce.configurator.list' },
  { path: '/commerce/configurator/:id', surface: 'commerce.configurator-template.detail' },
  { path: '/commerce/product-types', surface: 'commerce.product-types.list' },
  { path: '/commerce/product-types/:key', surface: 'commerce.product-types.detail' },
  { path: '/commerce/price-lists', surface: 'commerce.pricing.list' },
  { path: '/commerce/price-lists/:id', surface: 'commerce.pricelist.detail' },
  { path: '/commerce/discounts', surface: 'commerce.discounts.list' },
  {
    path: '/commerce/discounts/:id',
    surface: 'commerce.discount.detail',
    entity: 'discount',
    entityLabel: 'Discounts',
  },
  { path: '/commerce/gift-cards', surface: 'commerce.giftcards.list' },
  {
    path: '/commerce/gift-cards/:id',
    surface: 'commerce.giftcard.detail',
    entity: 'gift_card',
    entityLabel: 'Gift cards',
  },
  { path: '/commerce/account-credit', surface: 'commerce.account-credit.list' },
  { path: '/commerce/carts', surface: 'commerce.carts.list' },
  { path: '/commerce/carts/:id', surface: 'commerce.cart.detail' },
  { path: '/commerce/checkouts', surface: 'commerce.checkout-sessions.list' },
  { path: '/commerce/checkouts/:id', surface: 'commerce.checkout-session.detail' },
  { path: '/commerce/subscriptions', surface: 'commerce.subscriptions.list' },
  {
    path: '/commerce/subscriptions/:id',
    surface: 'commerce.subscription.detail',
    entity: 'subscription',
    entityLabel: 'Subscriptions',
  },
  { path: '/commerce/returns', surface: 'commerce.returns.list' },
  {
    path: '/commerce/returns/:id',
    surface: 'commerce.return.detail',
    entity: 'return',
    entityLabel: 'Returns',
  },
  // A review has no detail pane — it is worked one at a time in the queue — so
  // its entity home is the moderation table, where the row is findable. The
  // absent path parameter IS that fact.
  {
    path: '/commerce/reviews',
    surface: 'commerce.reviews.list',
    entity: 'review',
    entityLabel: 'Reviews',
  },
  { path: '/commerce/reviews/queue', surface: 'commerce.reviews.queue' },
  { path: '/commerce/questions', surface: 'commerce.qa.list' },
  { path: '/commerce/questions/queue', surface: 'commerce.qa.queue' },
  { path: '/commerce/wishlists', surface: 'commerce.wishlists.list' },
  { path: '/commerce/sales-channels', surface: 'commerce.channels.list' },
  { path: '/commerce/market', surface: 'commerce.market' },
  { path: '/commerce/shipping', surface: 'commerce.shipping.list' },
  { path: '/commerce/shipping/regions/:id', surface: 'commerce.shipping.zone.detail' },
  { path: '/commerce/shipping/profiles/:id', surface: 'commerce.shipping.profile.detail' },
  { path: '/commerce/tax', surface: 'commerce.tax.list' },
  { path: '/commerce/tax/places/:id', surface: 'commerce.tax.zone.detail' },
  { path: '/commerce/reports', surface: 'commerce.reports' },
  { path: '/commerce/payment-providers', surface: 'commerce.providers' },
  { path: '/commerce/payment-providers/:id', surface: 'commerce.provider.detail' },
  { path: '/commerce/settings', surface: 'commerce.settings' },

  /* ── Customers ────────────────────────────────────────────────────────── */
  { path: '/crm/customers', surface: 'crm.customers.list' },
  {
    path: '/crm/customers/:id',
    surface: 'crm.customer.detail',
    entity: 'customer',
    entityLabel: 'Customers',
  },
  { path: '/crm/accounts', surface: 'crm.accounts.list' },
  { path: '/crm/accounts/:id', surface: 'crm.account.detail' },
  { path: '/crm/segments', surface: 'crm.segments.list' },
  {
    path: '/crm/segments/:id',
    surface: 'crm.segment.detail',
    entity: 'segment',
    entityLabel: 'Segments',
  },
  { path: '/crm/duplicates', surface: 'crm.duplicates.list' },
  { path: '/crm/deals', surface: 'crm.deals.list' },
  { path: '/crm/deals/:id', surface: 'crm.deal.detail', entity: 'deal', entityLabel: 'Deals' },
  { path: '/crm/pipelines', surface: 'crm.pipelines.list' },
  {
    path: '/crm/pipelines/:id',
    surface: 'crm.pipeline.detail',
    entity: 'pipeline',
    entityLabel: 'Pipelines',
  },
  // Support requests (docs/144 §7). `/crm/requests`, not `/crm/tickets`: the
  // surface is called Requests everywhere a person sees it, and an address that
  // disagrees with the tab title is a URL nobody can guess.
  { path: '/crm/requests', surface: 'crm.tickets.list' },
  {
    path: '/crm/requests/:id',
    surface: 'crm.ticket.detail',
    entity: 'ticket',
    entityLabel: 'Requests',
  },
  { path: '/crm/response-times', surface: 'crm.sla-policies' },
  { path: '/crm/tasks', surface: 'crm.tasks.list' },
  { path: '/crm/tasks/:id', surface: 'crm.task.detail', entity: 'task', entityLabel: 'Tasks' },
  { path: '/crm/orders', surface: 'crm.orders.list' },
  { path: '/crm/record-types', surface: 'crm.object-types.list' },
  // `:key` because the record type IS its key — and the matcher hands a path
  // parameter through under its own name, so `:id` here would open a blank pane.
  { path: '/crm/record-types/:key', surface: 'crm.object-type.detail' },
  { path: '/crm/mailboxes', surface: 'crm.mailboxes.list' },
  { path: '/crm/phone-systems', surface: 'crm.phone-systems.list' },
  { path: '/crm/reports', surface: 'crm.reports' },

  /* ── Wholesale ────────────────────────────────────────────────────────── */
  { path: '/wholesale/accounts', surface: 'b2b.accounts.list' },
  {
    path: '/wholesale/accounts/:id',
    surface: 'b2b.account.detail',
    entity: 'b2b_account',
    entityLabel: 'Wholesale accounts',
  },
  { path: '/wholesale/orders', surface: 'b2b.orders.list' },
  { path: '/wholesale/quotes', surface: 'b2b.quotes.list' },
  {
    path: '/wholesale/quotes/:id',
    surface: 'b2b.quote.detail',
    entity: 'quote',
    entityLabel: 'Quotes',
  },
  // Billing documents span invoicing and wholesale with no reliable 1:1 detail
  // key, so the list is their home — same reasoning as reviews above.
  {
    path: '/wholesale/invoices',
    surface: 'b2b.invoices.list',
    entity: 'billing_document',
    entityLabel: 'Invoices',
  },
  { path: '/wholesale/invoices/:id', surface: 'b2b.invoice.detail' },
  { path: '/wholesale/price-tiers', surface: 'b2b.pricing-tiers.list' },
  { path: '/wholesale/price-tiers/:id', surface: 'b2b.pricing-tier.detail' },
  { path: '/wholesale/approvals', surface: 'b2b.approvals' },

  /* ── Inventory ────────────────────────────────────────────────────────── */
  { path: '/inventory/stock', surface: 'inventory.stock.list' },
  { path: '/inventory/stock/:variantId', surface: 'inventory.stock.item' },
  { path: '/inventory/locations', surface: 'inventory.warehouses.list' },
  {
    path: '/inventory/locations/:id',
    surface: 'inventory.warehouses.detail',
    entity: 'warehouse',
    entityLabel: 'Locations',
  },
  { path: '/inventory/transfers', surface: 'inventory.transfers.list' },
  { path: '/inventory/transfers/:id', surface: 'inventory.transfers.detail' },
  { path: '/inventory/counts', surface: 'inventory.counts.list' },
  { path: '/inventory/counts/:id', surface: 'inventory.counts.detail' },
  { path: '/inventory/movements', surface: 'inventory.movements.list' },
  { path: '/inventory/lots', surface: 'inventory.lots.list' },
  { path: '/inventory/lots/:id', surface: 'inventory.lots.detail' },
  { path: '/inventory/suppliers', surface: 'inventory.suppliers.list' },
  { path: '/inventory/suppliers/:id', surface: 'inventory.suppliers.detail' },
  { path: '/inventory/purchase-orders', surface: 'inventory.purchase-orders.list' },
  { path: '/inventory/purchase-orders/:id', surface: 'inventory.purchase-orders.detail' },
  { path: '/inventory/receiving', surface: 'inventory.receiving.list' },
  { path: '/inventory/receiving/:id', surface: 'inventory.receiving.detail' },
  { path: '/inventory/reorder', surface: 'inventory.reorder' },
  { path: '/inventory/reports', surface: 'inventory.reports' },
  { path: '/inventory/sources', surface: 'inventory.sources' },
  { path: '/inventory/sources/:id', surface: 'inventory.sources.detail' },

  /* ── Invoicing ────────────────────────────────────────────────────────── */
  { path: '/invoicing/invoices', surface: 'invoicing.invoices.list' },
  { path: '/invoicing/invoices/:id', surface: 'invoicing.invoice.edit' },
  { path: '/invoicing/invoices/:id/preview', surface: 'invoicing.invoice.preview' },
  { path: '/invoicing/workflows', surface: 'invoicing.workflows' },
  { path: '/invoicing/workflows/:id', surface: 'invoicing.workflow.edit' },
  { path: '/invoicing/templates', surface: 'invoicing.templates' },

  /* ── Money ────────────────────────────────────────────────────────────── */
  { path: '/finance/payments', surface: 'finance.payments.list' },
  { path: '/finance/payouts', surface: 'finance.payouts.list' },
  { path: '/finance/payouts/:id', surface: 'finance.payout.detail' },
  { path: '/finance/owed-to-you', surface: 'finance.receivables' },
  { path: '/finance/sources', surface: 'finance.channels' },
  // What the tenant pays US. `/settings/billing` is canonical rather than a
  // finance path because that is the address every Stripe return has carried and
  // the one people already have; the finance-module path is the alias.
  {
    path: '/settings/billing',
    surface: 'finance.subscription',
    aliases: ['/finance/subscription'],
  },

  /* ── Site builder ─────────────────────────────────────────────────────── */
  { path: '/builder', surface: 'builder.studio' },
  { path: '/builder/site', surface: 'builder.site' },
  { path: '/builder/pages', surface: 'builder.pages' },
  { path: '/builder/email-designs', surface: 'builder.email' },
  { path: '/builder/blueprints', surface: 'builder.blueprints' },
  { path: '/builder/blueprints/:key', surface: 'builder.blueprint' },
  { path: '/builder/saved-pieces', surface: 'builder.components' },
  { path: '/builder/saved-pieces/:key', surface: 'builder.component' },
  { path: '/builder/forms', surface: 'builder.forms' },
  { path: '/builder/forms/:id', surface: 'builder.submission' },

  /* ── Content ──────────────────────────────────────────────────────────── */
  { path: '/content', surface: 'cms.content.list', entity: 'cms_page', entityLabel: 'Pages' },
  {
    path: '/content/:id',
    surface: 'cms.content.detail',
    entity: 'cms_entry',
    entityLabel: 'Content',
  },
  { path: '/content/media', surface: 'cms.media.list' },
  {
    path: '/content/media/:id',
    surface: 'cms.media.detail',
    entity: 'media',
    entityLabel: 'Media',
  },
  { path: '/content/authors', surface: 'cms.authors.list' },
  { path: '/content/authors/:id', surface: 'cms.authors.detail' },
  { path: '/content/tags', surface: 'cms.taxonomy.list' },
  { path: '/content/tags/:key', surface: 'cms.taxonomy.detail' },
  { path: '/content/types', surface: 'cms.types.list' },
  { path: '/content/types/:key', surface: 'cms.types.detail' },
  { path: '/content/redirects', surface: 'cms.redirects.list' },
  { path: '/content/redirects/import', surface: 'cms.redirects.import' },
  { path: '/content/translations', surface: 'cms.translations.list' },
  { path: '/content/translations/:id', surface: 'cms.translations.detail' },
  { path: '/content/legal', surface: 'cms.legal.list' },
  { path: '/content/webhooks', surface: 'cms.webhooks.list' },
  { path: '/content/webhooks/:id', surface: 'cms.webhooks.detail' },

  /* ── Email ────────────────────────────────────────────────────────────── */
  { path: '/email/broadcasts', surface: 'email.broadcasts.list' },
  { path: '/email/broadcasts/:id', surface: 'email.broadcasts.detail' },
  { path: '/email/sequences', surface: 'email.sequences.list' },
  { path: '/email/sequences/:id', surface: 'email.sequences.detail' },
  { path: '/email/sequences/:sequenceId/enrolled', surface: 'email.sequences.enrollments' },
  { path: '/email/sending-addresses', surface: 'email.domains.list' },
  { path: '/email/sending-addresses/:id', surface: 'email.domains.detail' },
  { path: '/email/do-not-email', surface: 'email.suppressions.list' },
  { path: '/email/settings', surface: 'email.settings' },

  /* ── Social ───────────────────────────────────────────────────────────── */
  { path: '/social', surface: 'social.calendar' },
  { path: '/social/posts', surface: 'social.queue' },
  // The composer opens both for an existing post and for a brand new one, so the
  // post id cannot be a path segment — a route has to address BOTH states, and
  // `/social/composer/` with nothing after it is not an address. It rides as a
  // query parameter, which round-trips identically.
  { path: '/social/composer', surface: 'social.composer' },
  { path: '/social/insights', surface: 'social.insights' },
  { path: '/social/inbox', surface: 'social.inbox' },
  { path: '/social/approvals', surface: 'social.approvals' },
  { path: '/social/posting-times', surface: 'social.cadence' },
  { path: '/social/connections', surface: 'social.connections' },

  /* ── Scheduling ───────────────────────────────────────────────────────── */
  { path: '/scheduling', surface: 'scheduling.calendar' },
  { path: '/scheduling/linked-calendars', surface: 'scheduling.calendar.connections' },
  { path: '/scheduling/bookings', surface: 'scheduling.bookings.list' },
  { path: '/scheduling/bookings/:id', surface: 'scheduling.bookings.detail' },
  { path: '/scheduling/repeating', surface: 'scheduling.series.list' },
  { path: '/scheduling/repeating/:id', surface: 'scheduling.series.detail' },
  { path: '/scheduling/waiting-list', surface: 'scheduling.waitlist' },
  { path: '/scheduling/services', surface: 'scheduling.services.list' },
  { path: '/scheduling/services/:id', surface: 'scheduling.services.detail' },
  { path: '/scheduling/people-and-equipment', surface: 'scheduling.resources.list' },
  { path: '/scheduling/people-and-equipment/:id', surface: 'scheduling.resources.detail' },
  { path: '/scheduling/availability', surface: 'scheduling.availability' },
  { path: '/scheduling/booking-rules', surface: 'scheduling.policies' },
  { path: '/scheduling/booking-rules/:id', surface: 'scheduling.policies.detail' },
  { path: '/scheduling/reports', surface: 'scheduling.reports' },

  /* ── Dropshipping ─────────────────────────────────────────────────────── */
  { path: '/dropshipping/suppliers', surface: 'dropship.suppliers.list' },
  { path: '/dropshipping/suppliers/:id', surface: 'dropship.supplier.detail' },
  { path: '/dropshipping/products', surface: 'dropship.products.list' },
  { path: '/dropshipping/orders', surface: 'dropship.orders.list' },
  { path: '/dropshipping/orders/:id', surface: 'dropship.order.detail' },
  { path: '/dropshipping/profitability', surface: 'dropship.analytics' },

  /* ── Automations ──────────────────────────────────────────────────────── */
  { path: '/automations', surface: 'automations.list' },
  { path: '/automations/recipes', surface: 'automations.recipes' },
  { path: '/automations/reports', surface: 'automations.reports' },
  { path: '/automations/:id', surface: 'automations.detail' },
  { path: '/automations/:automationId/runs', surface: 'automations.runs' },
  { path: '/automations/:automationId/runs/:runId', surface: 'automations.run' },

  /* ── Chat ─────────────────────────────────────────────────────────────── */
  { path: '/chat', surface: 'chat.inbox' },
  { path: '/chat/overview', surface: 'chat.overview' },
  { path: '/chat/settings', surface: 'chat.settings' },
  { path: '/chat/quick-replies', surface: 'chat.quick-replies' },
  // `/chat/:id` is what every staff-chat notification and web-push has carried.
  { path: '/chat/conversations/:id', surface: 'chat.inbox.thread', aliases: ['/chat/:id'] },

  /* ── Search visibility ────────────────────────────────────────────────── */
  { path: '/seo', surface: 'seo.performance' },
  { path: '/seo/site-checks', surface: 'seo.audits' },
  { path: '/seo/site-checks/:id', surface: 'seo.audits.detail' },
  { path: '/seo/search-console', surface: 'seo.search-console' },

  /* ── AI ───────────────────────────────────────────────────────────────── */
  { path: '/ai', surface: 'ai.overview' },
  { path: '/ai/instructions', surface: 'ai.prompts' },
  { path: '/ai/instructions/:id', surface: 'ai.prompts.edit' },
  { path: '/ai/permissions', surface: 'ai.tools' },

  /* ── Reporting ────────────────────────────────────────────────────────── */
  { path: '/analytics', surface: 'analytics.dashboards.list' },
  { path: '/analytics/:id', surface: 'analytics.dashboard.view' },

  /* ── Partner programme ────────────────────────────────────────────────── */
  { path: '/partner/referrals', surface: 'partner.referrals.list' },
  { path: '/partner/clients', surface: 'partner.clients.list' },
  { path: '/partner/commissions', surface: 'partner.commissions.list' },
  { path: '/partner/tier', surface: 'partner.tier' },
  { path: '/partner/bootcamps', surface: 'partner.bootcamps' },
  { path: '/partner/bootcamps/:id', surface: 'partner.bootcamp.detail' },
  { path: '/partner/resources', surface: 'partner.resources' },
  { path: '/partner/listing', surface: 'partner.profile' },
];
