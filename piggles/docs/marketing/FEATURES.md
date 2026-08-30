# Piggles — the feature inventory

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-29

Every primary capability Piggles has, with a stable id, where it lives in the
console, and whether the marketing site actually explains it.

This file is the **denominator**. [ARTICLES.md](ARTICLES.md) is the plan for
covering it, and the completeness gate is one sentence: **every id below is owned
by exactly one article.** An id with no owning article is a capability a visitor
cannot read about, and that is the failure this document exists to make visible.

Read [README.md](README.md) first for what an article has to be.

## How to use it

- **Ids are permanent.** An article links to features by id; renaming one breaks
  the trace. Retire an id rather than reusing it.
- **Ownership is declared in [ARTICLES.md](ARTICLES.md), not here.** Each article
  entry lists the ids it owns, so the mapping lives in one place instead of two
  that drift. The `Article` column below is filled in as an article **ships**, at
  which point that row also moves to `article`.
- **A row describes a capability, not a screen.** `STOCK-05` is "batches and
  serials", not the four surfaces that render it. The console column names those
  so a claim can be checked against the code rather than against this file.
- **Add a row when the platform gains a capability, in the same change.** An
  inventory that trails the build is how a site ends up selling last quarter's
  product.

## The coverage column

| Mark      | Meaning                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `none`    | Not mentioned anywhere on meetpiggles.com. Measured, not assumed — see below.               |
| `topical` | Named in a bullet or a chapter on an app page. A visitor learns it exists and nothing else. |
| `article` | Has its owning article, built and shipped.                                                  |

### The measured baseline, 2026-08-29

**Nothing is `article` yet, because no article-depth page exists on the site.**
There is no route family for one. The fifteen app pages carry **8,744 words
between them** — about 580 words per app. Stock fronts ~85 screens in 1,301
words; Invoices gets 131.

Rows marked `none` were checked by grep against `apps/web/content/apps/*.ts` and
returned nothing: fitment, bills of materials, lots and batches, ABC
classification, supplier scorecards, response-time policies, email suppressions,
two-factor, certifications, waiting lists, advance ship notices, content
revisions, scheduled publishing, site audits, segments, meeting links, and team
invites. Everything else is `topical` — present as a sentence, absent as an
explanation.

---

## PLAT — the workspace itself

The console is a product surface before it is a container for apps, and almost
none of this is explained anywhere today.

| Id      | Feature                    | What it is                                                                           | Console                                                            | Article | Coverage |
| ------- | -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------- | -------- |
| PLAT-01 | Panes, not pages           | Everything opens as a pane you place, not a route that replaces what you were on     | `lib/workbench/controller.ts`                                      |         | topical  |
| PLAT-02 | Windows or tabs            | Two presentations, chosen, each keeping its **own** remembered arrangement           | `lib/window-mode.ts`, `lib/mode-layouts.ts`                        |         | topical  |
| PLAT-03 | Saved layouts              | Named arrangements per business and per site, restored on reload                     | `lib/workbench/persistence.ts`, `components/rail/layouts-menu.tsx` |         | none     |
| PLAT-04 | Deep links to any pane     | A readable address for a screen, copyable and shareable                              | `lib/workbench/deep-link.ts`, `@wizeworks/links`                   |         | none     |
| PLAT-05 | The launcher               | Command palette with ranking; the modifier decides tab, alongside, or own window     | `components/launcher.tsx`                                          |         | none     |
| PLAT-06 | Universal search           | One search across records, not per-list filters                                      | `search_all`, `components/search-picker.tsx`                       |         | topical  |
| PLAT-07 | Saved views                | Per-list saved filters, sorts and column choices                                     | `components/saved-views/`                                          |         | none     |
| PLAT-08 | The rail you curate        | Put an app away without losing it; a display choice, never an entitlement            | `lib/console/rail.ts`, `components/all-apps-dialog.tsx`            |         | topical  |
| PLAT-09 | Notification centre        | Per-category routing: in-app, email, instant / daily digest / weekly, or muted       | `surfaces/notifications/`, `platform.settings.notifications`       |         | topical  |
| PLAT-10 | Background jobs            | Long work reports itself in the status bar instead of blocking a screen              | `components/status/jobs-chip.tsx`                                  |         | none     |
| PLAT-11 | The whole thing on a phone | A compact console with the full nav, not a cut-down viewer                           | `components/mobile/`, `components/compact-shell.tsx`               |         | topical  |
| PLAT-12 | Moving in                  | Import from another system: pick a source, map columns, stage, preview, run, history | `surfaces/migration/`, `platform.migrate`                          |         | none     |
| PLAT-13 | Sample data                | Seed a realistic workspace and clear it again                                        | `platform.settings.sample-data`                                    |         | none     |
| PLAT-14 | Guided tours               | First-run guidance and per-app tours                                                 | `lib/tour/`                                                        |         | none     |
| PLAT-15 | Feedback threads           | Tell us something from inside the product and get a reply in it                      | `surfaces/feedback/`, `components/feedback/`                       |         | none     |
| PLAT-16 | Pulse                      | What happened, what needs you, what is running                                       | `platform.pulse`                                                   |         | topical  |
| PLAT-17 | Dashboards                 | A dashboard picker and a viewer that re-scopes to the owning app's colour            | `analytics.dashboards.list`, `analytics.dashboard.view`            |         | topical  |

## SITE — your website

| Id      | Feature                       | What it is                                                                | Console                                                  | Article | Coverage |
| ------- | ----------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ------- | -------- |
| SITE-01 | Page builder                  | Compose pages from a catalog, drag to reorder, edit in place              | `builder.page`                                           |         | topical  |
| SITE-02 | Saved pieces                  | Save a section you built and reuse it on any page                         | `builder.components`, `builder.piece`                    |         | none     |
| SITE-03 | Look and feel                 | Theme tokens — colour, type, radius — changed once and applied everywhere | `builder.theme`                                          |         | topical  |
| SITE-04 | Header and footer             | The site frame, authored separately from page bodies                      | `builder.layout`                                         |         | topical  |
| SITE-05 | Blueprints                    | Whole-site starting points, not page templates                            | `builder.blueprints`, `builder.blueprint`                |         | topical  |
| SITE-06 | Preview before anyone sees it | Draft state you can look at on desktop and phone                          | `builder.preview`                                        |         | topical  |
| SITE-07 | Publish with checks           | Pre-publish checks and a gap report; publishing is explicit               | `builder.publish`                                        |         | topical  |
| SITE-08 | History and rollback          | Every published version kept; go back to one                              | `builder.history`, `list_site_versions`, `rollback_site` |         | topical  |
| SITE-09 | More than one site            | Several web properties on one account, each with its own identity         | `platform.settings.sites`                                |         | topical  |
| SITE-10 | Your web address              | Custom domains with DNS and certificates handled                          | `platform.settings.domains`                              |         | topical  |
| SITE-11 | Forms and submissions         | Forms on the site, answers in an inbox                                    | `builder.forms`, `builder.submission`                    |         | topical  |
| SITE-12 | Email design                  | The same builder, producing email                                         | `builder.email`                                          |         | none     |
| SITE-13 | Page results                  | Which pages people actually reach, per site                               | `builder.pages`, `sites.traffic`                         |         | none     |

## CONT — content

| Id      | Feature                 | What it is                                                         | Console                                               | Article | Coverage |
| ------- | ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | ------- | -------- |
| CONT-01 | Your own content types  | Define the shape of a thing you publish; not fixed posts and pages | `cms.types.list`, `cms.types.detail`                  |         | topical  |
| CONT-02 | Entries                 | Write, save explicitly, publish or unpublish                       | `cms.content.list`, `cms.content.detail`              |         | topical  |
| CONT-03 | Revisions and restore   | Every save kept; go back to one                                    | `restore_content_revision`                            |         | none     |
| CONT-04 | Scheduled publishing    | Write now, appears later                                           | `schedule_publish`                                    |         | none     |
| CONT-05 | Media library           | Images and files, reused across the site                           | `cms.media.list`                                      |         | topical  |
| CONT-06 | Authors                 | Who wrote it, shown on the site                                    | `cms.authors.list`                                    |         | none     |
| CONT-07 | Tags and topics         | Taxonomy that drives listing pages                                 | `cms.taxonomy.list`                                   |         | topical  |
| CONT-08 | Other languages         | Translations, including of product fields                          | `cms.translations.list`, `upsert_product_translation` |         | topical  |
| CONT-09 | Moving a URL            | Redirects, one at a time or imported in bulk                       | `cms.redirects.list`, `cms.redirects.import`          |         | topical  |
| CONT-10 | Legal pages             | Generated, with a checklist of what you still owe                  | `cms.legal.list`, `get_legal_checklist`               |         | topical  |
| CONT-11 | Using content elsewhere | Webhooks out; the content is not trapped in the site               | `cms.webhooks.list`                                   |         | topical  |

## FIND — getting found

| Id      | Feature                   | What it is                                                             | Console                                              | Article | Coverage |
| ------- | ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ------- | -------- |
| FIND-01 | Search performance        | What you rank for and what it earned you                               | `seo.performance`                                    |         | topical  |
| FIND-02 | Site checks               | Per-page audits that name the specific problem                         | `seo.audits`, `seo.audits.detail`                    |         | none     |
| FIND-03 | Search Console            | Connected, so the numbers are Google's                                 | `seo.search-console`                                 |         | topical  |
| FIND-04 | Posting to social         | One composer, many networks, scheduled                                 | `social.composer`, `social.queue`, `social.calendar` |         | topical  |
| FIND-05 | Posting slots and cadence | A weekly rhythm the queue fills, rather than posting when you remember | `social.cadence`, `save_social_posting_slot`         |         | none     |
| FIND-06 | Evergreen recycling       | A post worth showing again, shown again                                | `set_social_post_evergreen`                          |         | none     |
| FIND-07 | Approvals                 | A post waits for a second pair of eyes                                 | `social.approvals`                                   |         | none     |
| FIND-08 | Social inbox              | Comments and messages from every network, answered in one place        | `social.inbox`                                       |         | topical  |
| FIND-09 | What worked               | Per-post metrics and best time to post                                 | `social.insights`, `get_social_best_time`            |         | topical  |

## SELL — selling

| Id      | Feature                          | What it is                                                                             | Console                                                            | Article | Coverage |
| ------- | -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- | -------- |
| SELL-01 | Products and variants            | Sizes, colours, options, and things sold by weight or length                           | `commerce.products.list`, `commerce.product.detail`                |         | topical  |
| SELL-02 | Collections and categories       | Two different jobs: how you group them, and how a visitor browses them                 | `commerce.collections.list`, `commerce.categories.list`            |         | topical  |
| SELL-03 | Product types                    | Your own fields on your own kinds of product                                           | `commerce.product-types.list`                                      |         | none     |
| SELL-04 | Bundles                          | Several things sold as one, priced as one                                              | `commerce.bundles.list`                                            |         | topical  |
| SELL-05 | Gift cards                       | Issued, redeemed, topped up, tracked                                                   | `commerce.giftcards.list`, `issue_gift_card`                       |         | topical  |
| SELL-06 | What fits what                   | Compatibility trees with faceted search, for parts that fit some things and not others | `commerce.fitment.list`, `search_fitment`                          |         | none     |
| SELL-07 | Built to order                   | A configurator: the customer chooses, the price and the build follow                   | `commerce.configurator.list`                                       |         | topical  |
| SELL-08 | Orders in one list               | Website, counter, phone, marketplace — one place to see what has been ordered          | `commerce.orders.list`, `commerce.order.detail`                    |         | topical  |
| SELL-09 | Taking a sale at the counter     | Ring one up in front of somebody, on the same catalogue                                | `commerce.sale.new`                                                |         | none     |
| SELL-10 | Carts and checkout               | What is in progress, including what was abandoned                                      | `commerce.carts.list`, `commerce.checkout-sessions.list`           |         | topical  |
| SELL-11 | Repeat orders                    | Subscriptions: pause, resume, skip, change the schedule, change the card               | `commerce.subscriptions.list`, `pause_subscription`                |         | topical  |
| SELL-12 | Prices                           | Price lists, bulk breaks, contract prices                                              | `commerce.pricing.list`, `create_bulk_price_tier`                  |         | topical  |
| SELL-13 | Discounts                        | Codes and automatic offers, with the rules stated plainly enough to predict            | `commerce.discounts.list`                                          |         | topical  |
| SELL-14 | Account credit                   | Money on account, spent against future orders                                          | `commerce.account-credit.list`, `grant_account_credit`             |         | none     |
| SELL-15 | Returns                          | Request, inspect, receive, refund                                                      | `commerce.returns.list`, `record_return_inspection`                |         | topical  |
| SELL-16 | Reviews and questions            | Collected, moderated, answered                                                         | `commerce.reviews.list`, `commerce.qa.list`                        |         | topical  |
| SELL-17 | Wishlists and waiting lists      | What people want that you have not got                                                 | `commerce.wishlists.list`, `join_waitlist`, `offer_waitlist_entry` |         | none     |
| SELL-18 | Delivery                         | Zones, rates, profiles, surcharges                                                     | `commerce.shipping.list`, `commerce.shipping.zone.detail`          |         | topical  |
| SELL-19 | Tax                              | Zones, rates, exemptions                                                               | `commerce.tax.list`, `create_tax_exemption`                        |         | topical  |
| SELL-20 | Getting paid                     | Payment providers, and their health                                                    | `commerce.providers`, `get_provider_health`                        |         | topical  |
| SELL-21 | Selling in more places           | Sales channels and per-channel listings                                                | `commerce.channels.list`, `commerce.product.channels`              |         | topical  |
| SELL-22 | Trade accounts and trade prices  | Businesses that buy from you, on their own price tier with per-account overrides       | `b2b.accounts.list`, `b2b.pricing-tiers.list`, `resolve_b2b_price` |         | topical  |
| SELL-23 | Selling what you never touch     | Dropship: supplier catalogues, markup rules, routed orders, real margin                | `dropship.suppliers.list`, `create_markup_rule`                    |         | topical  |
| SELL-24 | Selling reports                  | What sold, to whom, through which channel                                              | `commerce.reports`, `get_channel_comparison`                       |         | topical  |
| SELL-25 | Quotes and paying on terms       | Quote, convert to an order, credit limits, payment terms, fleet holds                  | `b2b.quotes.list`, `convert_quote_to_order`, `create_fleet_hold`   |         | topical  |
| SELL-26 | Wholesale sign-off and invoicing | Orders that wait for approval, and invoices raised against an account                  | `b2b.approvals`, `b2b.invoices.list`, `mark_b2b_invoice_paid`      |         | topical  |

## STOCK — stock

| Id       | Feature                    | What it is                                                                       | Console                                                         | Article | Coverage |
| -------- | -------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------- | -------- |
| STOCK-01 | What you have, where       | Quantities per location, not one number                                          | `inventory.stock.list`, `inventory.stock.item`                  |         | topical  |
| STOCK-02 | Where the number came from | The working shown for any quantity — every movement that produced it             | `inventory.stock.provenance`, `explain_stock_level`             |         | none     |
| STOCK-03 | Locations and shelves      | Warehouses, rooms, coolers, bins, and what is on each                            | `inventory.warehouses.list`, `inventory.bins.list`              |         | topical  |
| STOCK-04 | Transfers                  | Moving stock between places, shipped and received                                | `inventory.transfers.list`                                      |         | topical  |
| STOCK-05 | Batches and serials        | Lots, expiry dates, serial units, and recalls                                    | `inventory.lots.list`, `initiate_recall`, `list_expiring_stock` |         | none     |
| STOCK-06 | Counting it                | Full and cycle counts, entered, submitted, approved, posted                      | `inventory.counts.list`, `inventory.count-schedules`            |         | topical  |
| STOCK-07 | Barcodes and labels        | Register, resolve, print product and shelf labels, spot shared barcodes          | `inventory.barcodes.list`, `inventory.barcodes.conflicts`       |         | topical  |
| STOCK-08 | Warehouse mode             | A scanner-first console: receive, put away, pick, pack, count, transfer          | `inventory.warehouse`, `scan_to_pick`, `scan_put_away`          |         | none     |
| STOCK-09 | Picking and packing        | Pick walks, guided picking, short and skip, a pack bench, throughput             | `inventory.picking.list`, `inventory.packing.bench`             |         | topical  |
| STOCK-10 | Backorders and preorders   | What you owe, and what you sold before it arrived                                | `inventory.backorders`, `inventory.preorders`                   |         | topical  |
| STOCK-11 | Making things              | Bills of materials, buildable quantity, planned and completed assembly runs      | `inventory.boms.list`, `inventory.assemblies.list`              |         | none     |
| STOCK-12 | Knowing what to order      | Reorder points with the reasoning shown, safety buffers, forecast, stockout risk | `inventory.reorder`, `explain_reorder_point`                    |         | topical  |
| STOCK-13 | What matters most          | ABC classification, slow movers, idle stock, cost to keep                        | `inventory.planning.classes`, `inventory.planning.holding`      |         | none     |
| STOCK-14 | What it cost you           | Cost layers, landed cost, cost against plan, valuation as at a date              | `inventory.costing.settings`, `get_landed_cost_breakdown`       |         | topical  |
| STOCK-15 | Checking the numbers       | Stock against your books, integrity checks, shrinkage, oversell incidents        | `inventory.reconciliation.books`, `inventory.integrity`         |         | topical  |
| STOCK-16 | Whose stock it is          | Consignment and other non-owned stock, tracked apart from yours                  | `inventory.ownership`, `inventory.consignment`                  |         | topical  |
| STOCK-17 | Getting your stock in      | Spreadsheet import with preview, grid editing, your own columns                  | `inventory.stock.import`, `inventory.stock.grid`                |         | topical  |
| STOCK-18 | Stock reports              | Ready-made reports, and the same reports mailed to you on a schedule             | `inventory.reports`, `inventory.reports.schedules`              |         | none     |
| STOCK-19 | Units                      | Buy in cases, sell in singles, count in either                                   | `inventory.units`, `list_units_of_measure`                      |         | none     |

## BUY — suppliers and buying (the Partners app)

| Id     | Feature                      | What it is                                                      | Console                                                            | Article | Coverage |
| ------ | ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ------- | -------- |
| BUY-01 | Your suppliers               | Who supplies what, on what terms, at what lead time             | `inventory.suppliers.list`, `get_supplier_lead_times`              |         | topical  |
| BUY-02 | Purchase orders              | Raise, submit, amend, receive, close                            | `inventory.purchase-orders.list`                                   |         | topical  |
| BUY-03 | Spending limits and sign-off | Who may commit how much, and what waits for approval            | `inventory.purchase-orders.approvals`, `...approval-rules`         |         | topical  |
| BUY-04 | On the way                   | Advance ship notices, and deliveries that are late              | `inventory.advance-ship-notices`, `inventory.purchase-orders.late` |         | none     |
| BUY-05 | Receiving                    | Book a delivery in, by hand or by scanner                       | `inventory.receiving.list`, `inventory.receiving.scan`             |         | topical  |
| BUY-06 | What they charge you         | Supplier bills, price variance against the order, price ladders | `inventory.supplier-bills`, `inventory.costing.variance`           |         | topical  |
| BUY-07 | Sending it back              | Supplier returns, tracked to credit                             | `inventory.supplier-returns`                                       |         | topical  |
| BUY-08 | Are they any good            | Supplier scorecards: on time, in full, at the price agreed      | `inventory.suppliers.scorecards`, `get_supplier_performance`       |         | none     |

## CUST — customers

| Id      | Feature                      | What it is                                                               | Console                                        | Article | Coverage |
| ------- | ---------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- | ------- | -------- |
| CUST-01 | Customer and company records | Everything you know about somebody, on one timeline                      | `crm.customers.list`, `crm.accounts.list`      |         | topical  |
| CUST-02 | The activity timeline        | Notes, calls, emails, meetings, orders — in order                        | `get_crm_activity_feed`, `log_crm_note`        |         | topical  |
| CUST-03 | Your own record types        | Define kinds of record the software never heard of, with your own fields | `crm.object-types.list`, `crm.records.list`    |         | topical  |
| CUST-04 | Relationships                | How records connect, in your words                                       | `crm.relationship-types`, `relate_crm_records` |         | none     |
| CUST-05 | Segments                     | A group that keeps itself up to date, with a count you can preview       | `crm.segments.list`, `preview_segment_count`   |         | none     |
| CUST-06 | Duplicates                   | Found, compared, merged — one at a time or in bulk                       | `crm.duplicates.list`, `merge_customers`       |         | topical  |
| CUST-07 | Deals and pipelines          | Your own stages, and a funnel that shows where things stall              | `crm.deals.list`, `crm.pipelines.list`         |         | topical  |
| CUST-08 | Tasks                        | What you said you would do, and when                                     | `crm.tasks.list`, `get_today_tasks`            |         | topical  |
| CUST-09 | Support requests             | Questions and complaints, tracked to an answer                           | `crm.tickets.list`                             |         | none     |
| CUST-10 | Response times               | What you promised, and whether you kept it                               | `crm.sla-policies`                             |         | none     |
| CUST-11 | Who is worth calling         | Scoring, with the reason for the score shown per record                  | `crm.scoring`, `explain_crm_score`             |         | topical  |
| CUST-12 | Your email, in here          | Connect a mailbox; the correspondence lands on the record                | `crm.mailboxes.list`, `send_crm_email`         |         | topical  |
| CUST-13 | Your phone, in here          | Connect a phone system; calls are logged and dialled from the record     | `crm.phone-systems.list`, `place_crm_call`     |         | topical  |
| CUST-14 | Booking links                | Send a link, they pick a time, it lands in your calendar                 | `crm.meeting-links`, `create_crm_meeting_link` |         | none     |
| CUST-15 | Reports and dashboards       | A report builder and saved dashboards, not just fixed charts             | `crm.report.builder`, `crm.dashboards`         |         | topical  |

## MSG — messages

| Id     | Feature                | What it is                                                        | Console                                                      | Article | Coverage |
| ------ | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | ------- | -------- |
| MSG-01 | Broadcasts             | One send to a group, scheduled or now                             | `email.broadcasts.list`, `schedule_broadcast`                |         | topical  |
| MSG-02 | Sequences              | Several emails over days, with who is enrolled and where they are | `email.sequences.list`, `...enrollments`                     |         | topical  |
| MSG-03 | Making sure it arrives | Your own sending address, verified — the DNS records done for you | `email.domains.list`, `verify_email_domain`                  |         | topical  |
| MSG-04 | Who not to email       | Unsubscribes and bounces honoured everywhere, automatically       | `email.suppressions.list`                                    |         | none     |
| MSG-05 | Templates and snippets | Written once, reused, with fields that fill themselves in         | `crm.templates.list`, `crm.snippets.list`, `list_merge_tags` |         | topical  |
| MSG-06 | How it performed       | Opens, clicks, and what it earned                                 | `get_email_stats`                                            |         | topical  |
| MSG-07 | Live chat              | A chat on your site, answered from the same console               | `chat.inbox`, `chat.quick-replies`                           |         | topical  |

## BOOK — bookings

| Id      | Feature              | What it is                                                                  | Console                                                    | Article | Coverage |
| ------- | -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- | -------- |
| BOOK-01 | The calendar         | Everything booked, in one view                                              | `scheduling.calendar`                                      |         | topical  |
| BOOK-02 | Your other calendar  | Two-way sync, so a dentist appointment blocks a slot                        | `scheduling.calendar.connections`                          |         | none     |
| BOOK-03 | What you offer       | Services, with duration, price and who can do them                          | `scheduling.services.list`                                 |         | topical  |
| BOOK-04 | People and equipment | A booking can need a person, a room, a machine, or all three                | `scheduling.resources.list`, `scheduling.locations.list`   |         | topical  |
| BOOK-05 | When you are free    | Working hours, plus the exceptions that are the real work                   | `scheduling.availability`, `create_availability_exception` |         | topical  |
| BOOK-06 | The rules            | Notice, cancellation windows, deposits — enforced, not just stated          | `scheduling.policies`                                      |         | topical  |
| BOOK-07 | Repeats              | A booking that happens every week, changed once                             | `scheduling.series.list`                                   |         | none     |
| BOOK-08 | The waiting list     | Somebody wants a slot you have not got; when one frees, they are offered it | `scheduling.waitlist`                                      |         | none     |
| BOOK-09 | Turning up           | Confirm, check in, complete, no-show, reschedule                            | `check_in_booking`, `no_show_booking`                      |         | topical  |

## MONEY — invoices and money

| Id       | Feature             | What it is                                                            | Console                                                             | Article | Coverage |
| -------- | ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------- | -------- |
| MONEY-01 | Writing an invoice  | Lines, terms, tax, and a preview of what they will get                | `invoicing.invoices.list`, `invoicing.invoice.edit`                 |         | topical  |
| MONEY-02 | Getting it approved | Multi-stage workflows before it goes out, and signature requests      | `invoicing.workflows`, `request_document_signature`                 |         | none     |
| MONEY-03 | How it looks        | Print templates you control                                           | `invoicing.templates`                                               |         | topical  |
| MONEY-04 | Who has paid        | Payments recorded against invoices, and what is still owed            | `finance.receivables`, `record_billing_payment`                     |         | topical  |
| MONEY-05 | What came in        | Payments and payouts, reconciled back to the orders behind them       | `finance.payments.list`, `finance.payouts.list`                     |         | topical  |
| MONEY-06 | What went out       | Costs, bills to pay, repeating costs, and who you pay                 | `finance.spending`, `finance.bills`, `finance.vendors`              |         | topical  |
| MONEY-07 | Did we make money   | Profit overall, and profit on one job                                 | `finance.profit`, `finance.jobs`                                    |         | topical  |
| MONEY-08 | Where it comes from | Revenue by channel and by traffic source                              | `finance.channels`, `get_sales_by_traffic_source`                   |         | topical  |
| MONEY-09 | Your accountant     | Categories, an accounting connection, and a reconciliation they trust | `finance.categories`, `finance.accounting`, `get_gl_reconciliation` |         | topical  |

## TEAM — your team and access

| Id      | Feature              | What it is                                                                          | Console                                               | Article | Coverage |
| ------- | -------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ------- | -------- |
| TEAM-01 | Adding somebody      | Invite, they accept, they are in — on their own login                               | `platform.settings.team`, accept-invite               |         | none     |
| TEAM-02 | Who can see what     | Nine roles, each described by what it **cannot** do, including a warehouse-only one | `staff.people`, `@wizeworks/auth/org-roles`           |         | topical  |
| TEAM-03 | Hours                | Timesheets, the schedule, and time off                                              | `staff.timesheets`, `staff.schedule`, `staff.timeoff` |         | topical  |
| TEAM-04 | Tickets and licences | Certifications with expiry, so a lapsed licence is not a surprise                   | `staff.certifications`                                |         | none     |
| TEAM-05 | Keeping it safe      | Password, active sessions, two-factor with backup codes, an activity log            | `platform.settings.security`, `surfaces/security/`    |         | none     |

## AUTO — automations and AI

| Id      | Feature                      | What it is                                                       | Console                                                      | Article | Coverage |
| ------- | ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ------- | -------- |
| AUTO-01 | Building an automation       | Triggers, conditions, branches and actions on a canvas           | `automations.detail`, `surfaces/automations/flow-canvas.tsx` |         | topical  |
| AUTO-02 | Ready-made ones              | A recipe library you adopt rather than author                    | `automations.recipes`                                        |         | topical  |
| AUTO-03 | What it actually did         | Run history, per-run inspection, and reports                     | `automations.runs`, `automations.reports`                    |         | topical  |
| AUTO-04 | Other tools                  | A catalogue of services to connect, with their real names        | `platform.settings.integrations`                             |         | topical  |
| AUTO-05 | Your own AI key              | Bring your provider and your credential; we never run AI on ours | `platform.settings.ai`, `ai.overview`                        |         | topical  |
| AUTO-06 | Telling the AI how to behave | Instructions written for your business                           | `ai.prompts`, `ai.prompts.edit`                              |         | none     |
| AUTO-07 | What the AI may touch        | Per-tool permissions, so it can read without being able to act   | `ai.tools`                                                   |         | none     |
| AUTO-08 | Your own AI client           | An MCP server, so your assistant works on your data              | `mcp.mypiggles.com`                                          |         | topical  |

## COMM — what it costs and how you get in

| Id      | Feature                    | What it is                                                                         | Where                                           | Article | Coverage |
| ------- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- | ------- | -------- |
| COMM-01 | One plan, everything in it | No tiers, no per-app pricing, no capability behind a paywall                       | `@piggles/config/pricing`                       |         | topical  |
| COMM-02 | What counts against it     | Storage, email volume, contacts and seats — metered, and shown before they bite    | `@wizeworks/usage`, `components/capacity.tsx`   |         | topical  |
| COMM-03 | A limit never stops work   | The thing in flight finishes; nothing already made is taken away or hidden         | `docs/initial/docs/commercial/BILLING_RULES.md` |         | topical  |
| COMM-04 | Expanding in one tap       | The price is on the button, in place — and reducing again is equally self-serve    | account app                                     |         | none     |
| COMM-05 | Onboarding that hides      | The answer to "what do you do?" shapes the workspace; it never takes anything away | `apps/account/components/onboarding/`           |         | topical  |
| COMM-06 | Signing in                 | One session across three domains, no third-party cookies                           | `packages/auth-handoff`                         |         | none     |
| COMM-07 | The free tools             | Seventeen calculators and generators, no account needed                            | `apps/web/app/tools/`                           |         | topical  |

---

## Totals

| Domain    | Features |
| --------- | -------- |
| PLAT      | 17       |
| SITE      | 13       |
| CONT      | 11       |
| FIND      | 9        |
| SELL      | 26       |
| STOCK     | 19       |
| BUY       | 8        |
| CUST      | 15       |
| MSG       | 7        |
| BOOK      | 9        |
| MONEY     | 9        |
| TEAM      | 5        |
| AUTO      | 8        |
| COMM      | 7        |
| **Total** | **163**  |

Coverage today: **0 `article`**, 113 `topical`, 50 `none`.

Counted from this file, not asserted:

```
grep -cE '^\| (PLAT|SITE|CONT|FIND|SELL|STOCK|BUY|CUST|MSG|BOOK|MONEY|TEAM|AUTO|COMM)-[0-9]' FEATURES.md
```
