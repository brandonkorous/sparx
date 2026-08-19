# Piggles — pane ratings

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

Every pane in the Piggles console, scored on **Design** and **Ease** as the ten
personas open them. How and when to score is RULE #6 in [CLAUDE.md](CLAUDE.md);
this file is where the numbers live.

**Scored so far: 0 of 323.** Update that line as rows fill in — it is the
denominator, and a rating file that does not show what it has not looked at is
the same lie as an empty issue list.

## The two axes

| Axis       | The question                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Design** | Is it on-system and well-composed? Silica components and tokens, real color doing real work (not a grey screen), hierarchy from scale and weight, holds at 360px, and the waiting / empty / error states all present and right |
| **Ease**   | Could this owner do the job without help? Findable, one home per concern, the data she needs already on screen, no dead ends, words she uses, an obvious next step — and reachable by keyboard and by thumb                    |

Both are reported. A beautiful pane nobody can operate is not an 8; a plain pane
that gets the job done in two taps is not a 4. Where one number is wanted, quote
the lower.

**Score it in both themes and at 360px, or do not score it.** A number taken in
one theme at one width is a guess about the other three — and dark mode is where
the largest defect in this build's history was hiding, unreachable by every
automated check.

| Score | Means                                                         |
| ----- | ------------------------------------------------------------- |
| 9–10  | Nothing to fix. A 10 needs a reason written in the gap column |
| 7–8   | Right, with named nits                                        |
| 5–6   | Works; she needed a second look or a second attempt           |
| 3–4   | She got there by persistence, or it looks unfinished          |
| 1–2   | She would stop, ask somebody, or leave                        |

**The deductions are the point.** Every scored row carries a **gap to 10** — the
specific thing that would raise it. Anything in that column which is a real
defect becomes an issue and is fixed on the spot (RULE #3), then the row is
re-scored keeping both numbers: `5 → 8`.

A pane no persona reached stays `—`. Never infer a score from the code, from a
sibling pane, or from the fact that it typechecks.

## How to fill a row

| Column    | What goes in it                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Pane      | as printed. "depends on what is open" is a pane whose title is computed from the record it holds — a product, an invoice, a page |
| Key       | the surface key — what the address bar and the launcher use                                                                      |
| Design    | `1`–`10`, or `4 → 8` after a fix                                                                                                 |
| Ease      | same                                                                                                                             |
| Gap to 10 | one short phrase. If it is a defect, add `#NNN`                                                                                  |
| Persona   | who opened it — `P03`. Several may score the same pane; keep the latest and note the earlier in the gap column if it differed    |

## Panes that are deliberately absent

Eleven surfaces are excluded from Piggles by `hiddenSurfaces` — sparx's
marketplace, its module-priced settings screen, its reseller programme, and the
platform bill that belongs on getpiggles. They are not listed below and are not
scored. **If a persona ever reaches one, that is a `major` issue, not a rating.**

One pane already fails that test before any run: `partner.bootcamp.detail`
appears below under "Not reachable from any app rail" because its list screen is
hidden and it is not — see [issue 002](issues/002-bootcamp-detail-still-reachable.md).
It is listed rather than quietly dropped, because a pane nobody can name is a
pane nobody removes.

<!-- PANES:START -->

### Home — 26 panes

| Pane                        | Key                               | Design | Ease | Gap to 10 | Persona |
| --------------------------- | --------------------------------- | ------ | ---- | --------- | ------- |
| Dashboard                   | `analytics.dashboard.view`        | —      | —    | —         | —       |
| Dashboards                  | `analytics.dashboards.list`       | —      | —    | —         | —       |
| What you told us            | `platform.feedback.list`          | —      | —    | —         | —       |
| Feedback                    | `platform.feedback.thread`        | —      | —    | —         | —       |
| Link                        | `platform.link.unresolved`        | —      | —    | —         | —       |
| Move in from somewhere else | `platform.migrate`                | —      | —    | —         | —       |
| Past moves                  | `platform.migrate.history`        | —      | —    | —         | —       |
| (depends on what is open)   | `platform.migrate.run`            | —      | —    | —         | —       |
| What has been happening     | `platform.pulse`                  | —      | —    | —         | —       |
| AI connections              | `platform.settings.ai`            | —      | —    | —         | —       |
| Web address                 | `platform.settings.domain`        | —      | —    | —         | —       |
| Domains                     | `platform.settings.domains`       | —      | —    | —         | —       |
| Business details            | `platform.settings.general`       | —      | —    | —         | —       |
| What kind of business       | `platform.settings.industry`      | —      | —    | —         | —       |
| Connection                  | `platform.settings.integration`   | —      | —    | —         | —       |
| Other software              | `platform.settings.integrations`  | —      | —    | —         | —       |
| Notifications               | `platform.settings.notifications` | —      | —    | —         | —       |
| Practice data               | `platform.settings.sample-data`   | —      | —    | —         | —       |
| Signing in and security     | `platform.settings.security`      | —      | —    | —         | —       |
| Site                        | `platform.settings.site`          | —      | —    | —         | —       |
| Sites                       | `platform.settings.sites`         | —      | —    | —         | —       |
| Team                        | `platform.settings.team`          | —      | —    | —         | —       |
| Teammate                    | `platform.settings.team.member`   | —      | —    | —         | —       |
| Set up step by step         | `workbench.onboarding`            | —      | —    | —         | —       |
| Describe your business      | `workbench.onboarding.story`      | —      | —    | —         | —       |
| Get set up                  | `workbench.welcome`               | —      | —    | —         | —       |

### My Site — 16 panes

| Pane              | Key                  | Design | Ease | Gap to 10 | Persona |
| ----------------- | -------------------- | ------ | ---- | --------- | ------- |
| Blueprint         | `builder.blueprint`  | —      | —    | —         | —       |
| Ready-made sites  | `builder.blueprints` | —      | —    | —         | —       |
| Saved piece       | `builder.component`  | —      | —    | —         | —       |
| Saved pieces      | `builder.components` | —      | —    | —         | —       |
| Email designs     | `builder.email`      | —      | —    | —         | —       |
| Form replies      | `builder.forms`      | —      | —    | —         | —       |
| History           | `builder.history`    | —      | —    | —         | —       |
| Header & footer   | `builder.layout`     | —      | —    | —         | —       |
| Page              | `builder.page`       | —      | —    | —         | —       |
| How your pages do | `builder.pages`      | —      | —    | —         | —       |
| Saved piece       | `builder.piece`      | —      | —    | —         | —       |
| Preview           | `builder.preview`    | —      | —    | —         | —       |
| Publish           | `builder.publish`    | —      | —    | —         | —       |
| Your site         | `builder.site`       | —      | —    | —         | —       |
| Submission        | `builder.submission` | —      | —    | —         | —       |
| Look & feel       | `builder.theme`      | —      | —    | —         | —       |

### Content — 18 panes

| Pane                   | Key                             | Design | Ease | Gap to 10 | Persona |
| ---------------------- | ------------------------------- | ------ | ---- | --------- | ------- |
| Author                 | `cms.authors.detail`            | —      | —    | —         | —       |
| Authors                | `cms.authors.list`              | —      | —    | —         | —       |
| Content                | `cms.content.detail`            | —      | —    | —         | —       |
| Content                | `cms.content.list`              | —      | —    | —         | —       |
| Legal pages            | `cms.legal.list`                | —      | —    | —         | —       |
| Media                  | `cms.media.detail`              | —      | —    | —         | —       |
| Photos and files       | `cms.media.list`                | —      | —    | —         | —       |
| Import redirects       | `cms.redirects.import`          | —      | —    | —         | —       |
| Old links              | `cms.redirects.list`            | —      | —    | —         | —       |
| Tags & topics          | `cms.taxonomy.detail`           | —      | —    | —         | —       |
| Tags and topics        | `cms.taxonomy.list`             | —      | —    | —         | —       |
| Translations           | `cms.translations.detail`       | —      | —    | —         | —       |
| Translations           | `cms.translations.list`         | —      | —    | —         | —       |
| Content type           | `cms.types.detail`              | —      | —    | —         | —       |
| Kinds of content       | `cms.types.list`                | —      | —    | —         | —       |
| Telling other software | `cms.webhooks.detail`           | —      | —    | —         | —       |
| Tell other software    | `cms.webhooks.list`             | —      | —    | —         | —       |
| Other languages        | `commerce.product.translations` | —      | —    | —         | —       |

### Get Found — 12 panes

| Pane                      | Key                  | Design | Ease | Gap to 10 | Persona |
| ------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Things worth fixing       | `seo.audits`         | —      | —    | —         | —       |
| Page check                | `seo.audits.detail`  | —      | —    | —         | —       |
| How people find you       | `seo.performance`    | —      | —    | —         | —       |
| Search Console            | `seo.search-console` | —      | —    | —         | —       |
| Approvals                 | `social.approvals`   | —      | —    | —         | —       |
| How often you post        | `social.cadence`     | —      | —    | —         | —       |
| Calendar                  | `social.calendar`    | —      | —    | —         | —       |
| (depends on what is open) | `social.composer`    | —      | —    | —         | —       |
| Connections               | `social.connections` | —      | —    | —         | —       |
| Inbox                     | `social.inbox`       | —      | —    | —         | —       |
| Insights                  | `social.insights`    | —      | —    | —         | —       |
| Posts                     | `social.queue`       | —      | —    | —         | —       |

### Sell — 65 panes

| Pane                      | Key                                     | Design | Ease | Gap to 10 | Persona |
| ------------------------- | --------------------------------------- | ------ | ---- | --------- | ------- |
| (depends on what is open) | `b2b.account.detail`                    | —      | —    | —         | —       |
| Wholesale customers       | `b2b.accounts.list`                     | —      | —    | —         | —       |
| Orders to approve         | `b2b.approvals`                         | —      | —    | —         | —       |
| (depends on what is open) | `b2b.invoice.detail`                    | —      | —    | —         | —       |
| Wholesale invoices        | `b2b.invoices.list`                     | —      | —    | —         | —       |
| Wholesale orders          | `b2b.orders.list`                       | —      | —    | —         | —       |
| (depends on what is open) | `b2b.pricing-tier.detail`               | —      | —    | —         | —       |
| Wholesale prices          | `b2b.pricing-tiers.list`                | —      | —    | —         | —       |
| Quote                     | `b2b.quote.detail`                      | —      | —    | —         | —       |
| Quotes                    | `b2b.quotes.list`                       | —      | —    | —         | —       |
| Credit on account         | `commerce.account-credit.list`          | —      | —    | —         | —       |
| Bundle                    | `commerce.bundle.detail`                | —      | —    | —         | —       |
| Bundles                   | `commerce.bundles.list`                 | —      | —    | —         | —       |
| Cart                      | `commerce.cart.detail`                  | —      | —    | —         | —       |
| Baskets left behind       | `commerce.carts.list`                   | —      | —    | —         | —       |
| Categories                | `commerce.categories.list`              | —      | —    | —         | —       |
| Category                  | `commerce.category.detail`              | —      | —    | —         | —       |
| Where you sell            | `commerce.channels.list`                | —      | —    | —         | —       |
| Checkout session          | `commerce.checkout-session.detail`      | —      | —    | —         | —       |
| Half-finished checkouts   | `commerce.checkout-sessions.list`       | —      | —    | —         | —       |
| Group of products         | `commerce.collection.detail`            | —      | —    | —         | —       |
| Groups of products        | `commerce.collections.list`             | —      | —    | —         | —       |
| Build template            | `commerce.configurator-template.detail` | —      | —    | —         | —       |
| Build-your-own            | `commerce.configurator.list`            | —      | —    | —         | —       |
| Discount                  | `commerce.discount.detail`              | —      | —    | —         | —       |
| Discounts                 | `commerce.discounts.list`               | —      | —    | —         | —       |
| Compatibility list        | `commerce.fitment.domain.detail`        | —      | —    | —         | —       |
| What fits what            | `commerce.fitment.list`                 | —      | —    | —         | —       |
| Gift card                 | `commerce.giftcard.detail`              | —      | —    | —         | —       |
| Gift cards                | `commerce.giftcards.list`               | —      | —    | —         | —       |
| Order                     | `commerce.order.detail`                 | —      | —    | —         | —       |
| Orders                    | `commerce.orders.list`                  | —      | —    | —         | —       |
| Price list                | `commerce.pricelist.detail`             | —      | —    | —         | —       |
| Special prices            | `commerce.pricing.list`                 | —      | —    | —         | —       |
| Kind of product           | `commerce.product-types.detail`         | —      | —    | —         | —       |
| Kinds of product          | `commerce.product-types.list`           | —      | —    | —         | —       |
| Where it is listed        | `commerce.product.channels`             | —      | —    | —         | —       |
| Build-your-own options    | `commerce.product.configurator`         | —      | —    | —         | —       |
| Product                   | `commerce.product.detail`               | —      | —    | —         | —       |
| Shipped by a supplier     | `commerce.product.dropship`             | —      | —    | —         | —       |
| What it fits              | `commerce.product.fitment`              | —      | —    | —         | —       |
| Reviews and questions     | `commerce.product.reviews`              | —      | —    | —         | —       |
| Repeat order options      | `commerce.product.subscriptions`        | —      | —    | —         | —       |
| Wholesale price           | `commerce.product.trade-pricing`        | —      | —    | —         | —       |
| Products                  | `commerce.products.list`                | —      | —    | —         | —       |
| Payment provider          | `commerce.provider.detail`              | —      | —    | —         | —       |
| How you take payment      | `commerce.providers`                    | —      | —    | —         | —       |
| Questions people ask      | `commerce.qa.list`                      | —      | —    | —         | —       |
| Questions queue           | `commerce.qa.queue`                     | —      | —    | —         | —       |
| How selling is going      | `commerce.reports`                      | —      | —    | —         | —       |
| Return                    | `commerce.return.detail`                | —      | —    | —         | —       |
| Returns                   | `commerce.returns.list`                 | —      | —    | —         | —       |
| Reviews                   | `commerce.reviews.list`                 | —      | —    | —         | —       |
| Reviews queue             | `commerce.reviews.queue`                | —      | —    | —         | —       |
| Selling settings          | `commerce.settings`                     | —      | —    | —         | —       |
| Postage and delivery      | `commerce.shipping.list`                | —      | —    | —         | —       |
| Delivery profile          | `commerce.shipping.profile.detail`      | —      | —    | —         | —       |
| Delivery region           | `commerce.shipping.zone.detail`         | —      | —    | —         | —       |
| Subscription              | `commerce.subscription.detail`          | —      | —    | —         | —       |
| Repeat orders             | `commerce.subscriptions.list`           | —      | —    | —         | —       |
| Tax                       | `commerce.tax.list`                     | —      | —    | —         | —       |
| Tax place                 | `commerce.tax.zone.detail`              | —      | —    | —         | —       |
| Wishlists                 | `commerce.wishlists.list`               | —      | —    | —         | —       |
| Supplier order            | `dropship.order.detail`                 | —      | —    | —         | —       |
| Supplier                  | `dropship.supplier.detail`              | —      | —    | —         | —       |

### Stock — 66 panes

| Pane                        | Key                                               | Design | Ease | Gap to 10 | Persona |
| --------------------------- | ------------------------------------------------- | ------ | ---- | --------- | ------- |
| How many you have           | `commerce.product.stock`                          | —      | —    | —         | —       |
| Shipment                    | `inventory.advance-ship-notices.detail`           | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.assemblies.detail`                     | —      | —    | —         | —       |
| Making runs                 | `inventory.assemblies.list`                       | —      | —    | —         | —       |
| Waiting list                | `inventory.backorders`                            | —      | —    | —         | —       |
| Owed                        | `inventory.backorders.detail`                     | —      | —    | —         | —       |
| Shared barcodes             | `inventory.barcodes.conflicts`                    | —      | —    | —         | —       |
| Product labels              | `inventory.barcodes.labels`                       | —      | —    | —         | —       |
| Barcodes                    | `inventory.barcodes.list`                         | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.bins.detail`                           | —      | —    | —         | —       |
| Shelf labels                | `inventory.bins.labels`                           | —      | —    | —         | —       |
| Shelves                     | `inventory.bins.list`                             | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.boms.detail`                           | —      | —    | —         | —       |
| Recipes                     | `inventory.boms.list`                             | —      | —    | —         | —       |
| Settlement                  | `inventory.consignment.detail`                    | —      | —    | —         | —       |
| How stock is valued         | `inventory.costing.settings`                      | —      | —    | —         | —       |
| Counting schedules          | `inventory.count-schedules`                       | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.count-schedules.detail`                | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.counts.detail`                         | —      | —    | —         | —       |
| Stock counts                | `inventory.counts.list`                           | —      | —    | —         | —       |
| Your own columns            | `inventory.custom-fields`                         | —      | —    | —         | —       |
| Print a label               | `inventory.documents.label`                       | —      | —    | —         | —       |
| Expiring stock              | `inventory.expiring`                              | —      | —    | —         | —       |
| Things that do not add up   | `inventory.integrity`                             | —      | —    | —         | —       |
| Batch                       | `inventory.lots.detail`                           | —      | —    | —         | —       |
| Batches and serial numbers  | `inventory.lots.list`                             | —      | —    | —         | —       |
| Every change                | `inventory.movements.list`                        | —      | —    | —         | —       |
| Whose stock                 | `inventory.ownership`                             | —      | —    | —         | —       |
| Pack bench                  | `inventory.packing.bench`                         | —      | —    | —         | —       |
| Walk                        | `inventory.picking.detail`                        | —      | —    | —         | —       |
| Picking                     | `inventory.picking.guided`                        | —      | —    | —         | —       |
| Picking walks               | `inventory.picking.list`                          | —      | —    | —         | —       |
| How fast you pack           | `inventory.picking.throughput`                    | —      | —    | —         | —       |
| At risk                     | `inventory.planning`                              | —      | —    | —         | —       |
| What matters most           | `inventory.planning.classes`                      | —      | —    | —         | —       |
| Why this number             | `inventory.planning.explain`                      | —      | —    | —         | —       |
| Cost to keep                | `inventory.planning.holding`                      | —      | —    | —         | —       |
| Not selling                 | `inventory.planning.idle`                         | —      | —    | —         | —       |
| Planning settings           | `inventory.planning.settings`                     | —      | —    | —         | —       |
| Preorders                   | `inventory.preorders`                             | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.purchase-orders.approval-rules.detail` | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.purchase-orders.detail`                | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.receiving.detail`                      | —      | —    | —         | —       |
| Scan a delivery             | `inventory.receiving.scan`                        | —      | —    | —         | —       |
| Stock versus your books     | `inventory.reconciliation.books`                  | —      | —    | —         | —       |
| What to reorder             | `inventory.reorder`                               | —      | —    | —         | —       |
| Stock reports               | `inventory.reports`                               | —      | —    | —         | —       |
| How it is performing        | `inventory.reports.performance`                   | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.reports.schedule`                      | —      | —    | —         | —       |
| Sent to your inbox          | `inventory.reports.schedules`                     | —      | —    | —         | —       |
| Set up your stock           | `inventory.setup`                                 | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.sources.detail`                        | —      | —    | —         | —       |
| Edit a lot at once          | `inventory.stock.grid`                            | —      | —    | —         | —       |
| Import from a spreadsheet   | `inventory.stock.import`                          | —      | —    | —         | —       |
| Stock item                  | `inventory.stock.item`                            | —      | —    | —         | —       |
| Stock                       | `inventory.stock.list`                            | —      | —    | —         | —       |
| Where this number came from | `inventory.stock.provenance`                      | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.supplier-bills.detail`                 | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.supplier-returns.detail`               | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.suppliers.detail`                      | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.transfers.detail`                      | —      | —    | —         | —       |
| Moving stock                | `inventory.transfers.list`                        | —      | —    | —         | —       |
| Units of measure            | `inventory.units`                                 | —      | —    | —         | —       |
| Scanner mode                | `inventory.warehouse`                             | —      | —    | —         | —       |
| (depends on what is open)   | `inventory.warehouses.detail`                     | —      | —    | —         | —       |
| Locations                   | `inventory.warehouses.list`                       | —      | —    | —         | —       |

### Partners — 17 panes

| Pane                  | Key                                        | Design | Ease | Gap to 10 | Persona |
| --------------------- | ------------------------------------------ | ------ | ---- | --------- | ------- |
| What you made on it   | `dropship.analytics`                       | —      | —    | —         | —       |
| What they are sending | `dropship.orders.list`                     | —      | —    | —         | —       |
| What they can send    | `dropship.products.list`                   | —      | —    | —         | —       |
| Ship-direct suppliers | `dropship.suppliers.list`                  | —      | —    | —         | —       |
| On the way            | `inventory.advance-ship-notices`           | —      | —    | —         | —       |
| Paying for what sold  | `inventory.consignment`                    | —      | —    | —         | —       |
| Cost vs plan          | `inventory.costing.variance`               | —      | —    | —         | —       |
| Spending limits       | `inventory.purchase-orders.approval-rules` | —      | —    | —         | —       |
| Sign-offs             | `inventory.purchase-orders.approvals`      | —      | —    | —         | —       |
| Overdue deliveries    | `inventory.purchase-orders.late`           | —      | —    | —         | —       |
| Orders to suppliers   | `inventory.purchase-orders.list`           | —      | —    | —         | —       |
| Booking stock in      | `inventory.receiving.list`                 | —      | —    | —         | —       |
| Counts from elsewhere | `inventory.sources`                        | —      | —    | —         | —       |
| Bills to pay          | `inventory.supplier-bills`                 | —      | —    | —         | —       |
| Sent back             | `inventory.supplier-returns`               | —      | —    | —         | —       |
| Suppliers             | `inventory.suppliers.list`                 | —      | —    | —         | —       |
| Supplier performance  | `inventory.suppliers.scorecards`           | —      | —    | —         | —       |

### Customers — 35 panes

| Pane                   | Key                        | Design | Ease | Gap to 10 | Persona |
| ---------------------- | -------------------------- | ------ | ---- | --------- | ------- |
| Company                | `crm.account.detail`       | —      | —    | —         | —       |
| Companies              | `crm.accounts.list`        | —      | —    | —         | —       |
| Customer               | `crm.customer.detail`      | —      | —    | —         | —       |
| Customers              | `crm.customers.list`       | —      | —    | —         | —       |
| Dashboard              | `crm.dashboard.detail`     | —      | —    | —         | —       |
| Dashboards             | `crm.dashboards`           | —      | —    | —         | —       |
| Deal                   | `crm.deal.detail`          | —      | —    | —         | —       |
| Deals                  | `crm.deals.list`           | —      | —    | —         | —       |
| Possible duplicates    | `crm.duplicates.list`      | —      | —    | —         | —       |
| Connect a mailbox      | `crm.mailbox.connect`      | —      | —    | —         | —       |
| Mailboxes              | `crm.mailboxes.list`       | —      | —    | —         | —       |
| Booking links          | `crm.meeting-links`        | —      | —    | —         | —       |
| Thing you track        | `crm.object-type.detail`   | —      | —    | —         | —       |
| Things you track       | `crm.object-types.list`    | —      | —    | —         | —       |
| Customer orders        | `crm.orders.list`          | —      | —    | —         | —       |
| Connect a phone system | `crm.phone-system.connect` | —      | —    | —         | —       |
| Phone systems          | `crm.phone-systems.list`   | —      | —    | —         | —       |
| Pipeline               | `crm.pipeline.detail`      | —      | —    | —         | —       |
| How a deal moves       | `crm.pipelines.list`       | —      | —    | —         | —       |
| Record                 | `crm.record.detail`        | —      | —    | —         | —       |
| Records                | `crm.records.list`         | —      | —    | —         | —       |
| Report                 | `crm.report.builder`       | —      | —    | —         | —       |
| Build a report         | `crm.report.library`       | —      | —    | —         | —       |
| Customer reports       | `crm.reports`              | —      | —    | —         | —       |
| Who is worth chasing   | `crm.scoring`              | —      | —    | —         | —       |
| Segment                | `crm.segment.detail`       | —      | —    | —         | —       |
| Groups of customers    | `crm.segments.list`        | —      | —    | —         | —       |
| How this app behaves   | `crm.settings`             | —      | —    | —         | —       |
| Response times         | `crm.sla-policies`         | —      | —    | —         | —       |
| Saved paragraphs       | `crm.snippets.list`        | —      | —    | —         | —       |
| Task                   | `crm.task.detail`          | —      | —    | —         | —       |
| Things to do           | `crm.tasks.list`           | —      | —    | —         | —       |
| Email templates        | `crm.templates.list`       | —      | —    | —         | —       |
| Request                | `crm.ticket.detail`        | —      | —    | —         | —       |
| Help requests          | `crm.tickets.list`         | —      | —    | —         | —       |

### Messages — 14 panes

| Pane                      | Key                           | Design | Ease | Gap to 10 | Persona |
| ------------------------- | ----------------------------- | ------ | ---- | --------- | ------- |
| Live chat                 | `chat.inbox`                  | —      | —    | —         | —       |
| Conversation              | `chat.inbox.thread`           | —      | —    | —         | —       |
| Chat activity             | `chat.overview`               | —      | —    | —         | —       |
| Quick replies             | `chat.quick-replies`          | —      | —    | —         | —       |
| Chat settings             | `chat.settings`               | —      | —    | —         | —       |
| Broadcast                 | `email.broadcasts.detail`     | —      | —    | —         | —       |
| Email campaigns           | `email.broadcasts.list`       | —      | —    | —         | —       |
| (depends on what is open) | `email.domains.detail`        | —      | —    | —         | —       |
| Sending addresses         | `email.domains.list`          | —      | —    | —         | —       |
| (depends on what is open) | `email.sequences.detail`      | —      | —    | —         | —       |
| Enrolled people           | `email.sequences.enrollments` | —      | —    | —         | —       |
| Automatic emails          | `email.sequences.list`        | —      | —    | —         | —       |
| Email settings            | `email.settings`              | —      | —    | —         | —       |
| Do not email              | `email.suppressions.list`     | —      | —    | —         | —       |

### Bookings — 17 panes

| Pane                      | Key                               | Design | Ease | Gap to 10 | Persona |
| ------------------------- | --------------------------------- | ------ | ---- | --------- | ------- |
| Availability              | `scheduling.availability`         | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.bookings.detail`      | —      | —    | —         | —       |
| Bookings                  | `scheduling.bookings.list`        | —      | —    | —         | —       |
| Calendar                  | `scheduling.calendar`             | —      | —    | —         | —       |
| Linked calendars          | `scheduling.calendar.connections` | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.locations.detail`     | —      | —    | —         | —       |
| Places                    | `scheduling.locations.list`       | —      | —    | —         | —       |
| Booking rules             | `scheduling.policies`             | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.policies.detail`      | —      | —    | —         | —       |
| How bookings are going    | `scheduling.reports`              | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.resources.detail`     | —      | —    | —         | —       |
| People and equipment      | `scheduling.resources.list`       | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.series.detail`        | —      | —    | —         | —       |
| Repeating bookings        | `scheduling.series.list`          | —      | —    | —         | —       |
| (depends on what is open) | `scheduling.services.detail`      | —      | —    | —         | —       |
| Services                  | `scheduling.services.list`        | —      | —    | —         | —       |
| Waiting list              | `scheduling.waitlist`             | —      | —    | —         | —       |

### Invoices — 6 panes

| Pane                      | Key                         | Design | Ease | Gap to 10 | Persona |
| ------------------------- | --------------------------- | ------ | ---- | --------- | ------- |
| (depends on what is open) | `invoicing.invoice.edit`    | —      | —    | —         | —       |
| Preview                   | `invoicing.invoice.preview` | —      | —    | —         | —       |
| Invoices                  | `invoicing.invoices.list`   | —      | —    | —         | —       |
| How invoices look         | `invoicing.templates`       | —      | —    | —         | —       |
| (depends on what is open) | `invoicing.workflow.edit`   | —      | —    | —         | —       |
| What happens when         | `invoicing.workflows`       | —      | —    | —         | —       |

### Money — 14 panes

| Pane                      | Key                      | Design | Ease | Gap to 10 | Persona |
| ------------------------- | ------------------------ | ------ | ---- | --------- | ------- |
| Accounting                | `finance.accounting`     | —      | —    | —         | —       |
| Bills to pay              | `finance.bills`          | —      | —    | —         | —       |
| Spending categories       | `finance.categories`     | —      | —    | —         | —       |
| Where money comes from    | `finance.channels`       | —      | —    | —         | —       |
| (depends on what is open) | `finance.expense.detail` | —      | —    | —         | —       |
| By job                    | `finance.jobs`           | —      | —    | —         | —       |
| Payments                  | `finance.payments.list`  | —      | —    | —         | —       |
| Deposit                   | `finance.payout.detail`  | —      | —    | —         | —       |
| Money paid to you         | `finance.payouts.list`   | —      | —    | —         | —       |
| What you kept             | `finance.profit`         | —      | —    | —         | —       |
| Owed to you               | `finance.receivables`    | —      | —    | —         | —       |
| Repeating costs           | `finance.recurring`      | —      | —    | —         | —       |
| Spending                  | `finance.spending`       | —      | —    | —         | —       |
| Who you pay               | `finance.vendors`        | —      | —    | —         | —       |

### My Team — 6 panes

| Pane                      | Key                    | Design | Ease | Gap to 10 | Persona |
| ------------------------- | ---------------------- | ------ | ---- | --------- | ------- |
| Tickets and licences      | `staff.certifications` | —      | —    | —         | —       |
| People                    | `staff.people`         | —      | —    | —         | —       |
| (depends on what is open) | `staff.person`         | —      | —    | —         | —       |
| Schedule                  | `staff.schedule`       | —      | —    | —         | —       |
| Time off                  | `staff.timeoff`        | —      | —    | —         | —       |
| Timesheets                | `staff.timesheets`     | —      | —    | —         | —       |

### Automations — 6 panes

| Pane                   | Key                   | Design | Ease | Gap to 10 | Persona |
| ---------------------- | --------------------- | ------ | ---- | --------- | ------- |
| Automation             | `automations.detail`  | —      | —    | —         | —       |
| Automations            | `automations.list`    | —      | —    | —         | —       |
| Ready-made automations | `automations.recipes` | —      | —    | —         | —       |
| What has run           | `automations.reports` | —      | —    | —         | —       |
| Automation run         | `automations.run`     | —      | —    | —         | —       |
| Automation runs        | `automations.runs`    | —      | —    | —         | —       |

### Connections — 4 panes

| Pane              | Key               | Design | Ease | Gap to 10 | Persona |
| ----------------- | ----------------- | ------ | ---- | --------- | ------- |
| What is connected | `ai.overview`     | —      | —    | —         | —       |
| Instructions      | `ai.prompts`      | —      | —    | —         | —       |
| Instruction       | `ai.prompts.edit` | —      | —    | —         | —       |
| What it may do    | `ai.tools`        | —      | —    | —         | —       |

### Not reachable from any app rail — 1 pane

| Pane     | Key                       | Design | Ease | Gap to 10 | Persona |
| -------- | ------------------------- | ------ | ---- | --------- | ------- |
| Bootcamp | `partner.bootcamp.detail` | —      | —    | —         | —       |

<!-- PANES:END -->

---

## Not in the console, and rated anyway

The console is not the whole product. These are scored on the same two axes by
whichever persona goes through them, because a business owner does not know where
one app stops and the next begins.

**The twelve published sites are scored as sites** — would a stranger buy from,
book on, or read this one without knowing it was a test (RULE #8)? Score the site
whole, and name its weakest page in the gap column, because that is the page a
real visitor lands on. Their design is judged as **the tenant's brand**, not
against sparx's restraint rules, which do not apply to a customer's website.

| Surface                        | Design | Ease | Gap to 10 | Persona |
| ------------------------------ | ------ | ---- | --------- | ------- |
| meetpiggles — home             | —      | —    | —         | —       |
| meetpiggles — pricing          | —      | —    | —         | —       |
| meetpiggles — an app page      | —      | —    | —         | —       |
| getpiggles — sign up           | —      | —    | —         | —       |
| getpiggles — sign in           | —      | —    | —         | —       |
| getpiggles — password reset    | —      | —    | —         | —       |
| getpiggles — onboarding        | —      | —    | —         | —       |
| getpiggles — account home      | —      | —    | —         | —       |
| The rail and app panels        | —      | —    | —         | —       |
| The launcher (⌘K)              | —      | —    | —         | —       |
| All apps dialog                | —      | —    | —         | —       |
| The dock — windows and tabs    | —      | —    | —         | —       |
| Compact console at 390px       | —      | —    | —         | —       |
| P01 site — Thistle & Rye       | —      | —    | —         | —       |
| P02 site — Halo & Hem          | —      | —    | —         | —       |
| P03 site — Juniper Row         | —      | —    | —         | —       |
| P04 site — Herrera & Co.       | —      | —    | —         | —       |
| P05 site — Wildwater Climbing  | —      | —    | —         | —       |
| P06 site — Ostrander Auto      | —      | —    | —         | —       |
| P07 site — Circuit & Coil      | —      | —    | —         | —       |
| P08 site — Kanto, signed out   | —      | —    | —         | —       |
| P08 site — Kanto, trade login  | —      | —    | —         | —       |
| P09 site — The Marrow Review   | —      | —    | —         | —       |
| P10 site — Brandt & Sons       | —      | —    | —         | —       |
| P10 site — the furniture range | —      | —    | —         | —       |
| Checkout, as a shopper         | —      | —    | —         | —       |

## How this list was built

```
node piggles/scripts/gen-pane-ratings.mjs
```

Generated rather than typed, from three sources — because a pane is only what a
person can actually open and read:

| Source                      | Gives                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `lib/surfaces/catalog/*.ts` | every registered surface                                    |
| `lib/console/vocabulary.ts` | what Piggles **calls** it — 99 of the 323 are renamed there |
| `lib/console/product.tsx`   | `hiddenSurfaces`, which are not Piggles panes at all        |

Grouped by app through `modules` and `claims` in `packages/config/src/apps.ts`,
so Partners shows the supplier screens it claims from Stock.

**The names here are the ones on screen, not the catalog's.** sparx calls
`commerce.carts.list` "Carts"; a Piggles owner reads "Baskets left behind", and
rating a screen means rating the words on it.

**Regenerate when the catalog changes** — before a run, never during one. A pane
added after this file was written is a pane nobody is asked to rate, and a
missing row reads as a covered one. The rubric above the marker survives a
regeneration; scores inside the generated block do not.
