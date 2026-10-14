# sparx workbench — pane ratings

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-10-13

Every pane in the sparx workbench, scored on **Design** and **Ease** as the
personas open them. How and when to score is RULE #6 in [CLAUDE.md](CLAUDE.md);
this file is where the numbers live.

**Scored so far: 76 of 340 panes.** Plus the non-console list at the foot. Update
that line as rows fill in. It is the denominator, and a rating file that does not
show what it has not looked at is the same lie as an empty issue list.

**Count the unscored rows with a parser, not a grep.** Split each row on `|` and
compare the Design cell to an em dash. A padded grep pattern silently misses rows
whose column widths differ, which is how the Piggles twin of this file once
reported 21 unscored panes when the real number was 52.

## The two axes

| Axis       | The question                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Design** | Is it on-system and well-composed? Silica components and tokens, real color doing real work (not a grey screen), hierarchy from scale and weight, holds at 360px, and the waiting / empty / error states all present and right |
| **Ease**   | Could this person do the job without help? Findable, one home per concern, the data they need already on screen, no dead ends, words they use, an obvious next step, and reachable by keyboard and by thumb                    |

Both are reported. A beautiful pane nobody can operate is not an 8; a plain pane
that gets the job done in two taps is not a 4. Where one number is wanted, quote
the lower.

**Score it in light and dark and at 360px, or do not score it.** A number taken in
one theme at one width is a guess about the other three.

| Score | Means                                                         |
| ----- | ------------------------------------------------------------- |
| 9–10  | Nothing to fix. A 10 needs a reason written in the gap column |
| 7–8   | Right, with named nits                                        |
| 5–6   | Works; he needed a second look or a second attempt            |
| 3–4   | He got there by persistence, or it looks unfinished           |
| 1–2   | He would stop, ask somebody, or leave                         |

**The deductions are the point.** Every scored row carries a **gap to 10**: the
specific thing that would raise it. Anything in that column which is a real defect
becomes an issue and is fixed on the spot (RULE #3), then the row is re-scored
keeping both numbers: `5 → 8`.

A pane no persona reached stays `—`. **Never infer a score** from the code, from a
sibling pane, or from the fact that it typechecks.

## How to fill a row

| Column    | What goes in it                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Pane      | as printed. A title computed from the record shows both forms it can print (`New account / Account`) |
| Key       | the surface key, which is what the address bar and a saved layout use                                |
| Design    | `1`–`10`, or `4 → 8` after a fix                                                                     |
| Ease      | same                                                                                                 |
| Gap to 10 | one short phrase. If it is a defect, add `#NNN`                                                      |
| Persona   | who opened it (`P01`)                                                                                |

## Not a pane, and so not a row

Chrome every pane shares: the module rail, the dock and its tabs, the global
search box, the notifications bell, the site switcher, the status bar. Score each
once in an issue and link to that issue from here, so the judgment exists
somewhere findable rather than not at all.

## Panes deliberately excluded

None. Doty turns on all 16 modules, so every registered surface is in his
console. `partner.*` panes belong to the partner program rather than a tenant; a
tenant reaching one is itself a finding.

---

<!-- PANES:START -->

### AI (`ai`) — 4 panes

| Pane                               | Key               | Design | Ease | Gap to 10 | Persona |
| ---------------------------------- | ----------------- | ------ | ---- | --------- | ------- |
| Overview                           | `ai.overview`     | —      | —    | —         | —       |
| Instructions                       | `ai.prompts`      | —      | —    | —         | —       |
| Instruction _(opened from a list)_ | `ai.prompts.edit` | —      | —    | —         | —       |
| Permissions                        | `ai.tools`        | —      | —    | —         | —       |

### Automations (`automations`) — 6 panes

| Pane                                   | Key                   | Design | Ease | Gap to 10                                                                                     | Persona |
| -------------------------------------- | --------------------- | ------ | ---- | --------------------------------------------------------------------------------------------- | ------- |
| Automation _(opened from a list)_      | `automations.detail`  | 8      | 8    | at 360px the On and "Managed by sparx" state drops out of the toolbar                         | P01     |
| Automations                            | `automations.list`    | 8      | 8    | "Set up by sparx" badge repeats on every row; at 360px "When it runs" needs a sideways scroll | P01     |
| Recipe library                         | `automations.recipes` | —      | —    | —                                                                                             | —       |
| Activity & reports                     | `automations.reports` | —      | —    | —                                                                                             | —       |
| Automation run _(opened from a list)_  | `automations.run`     | —      | —    | —                                                                                             | —       |
| Automation runs _(opened from a list)_ | `automations.runs`    | —      | —    | —                                                                                             | —       |

### Campaigns (`funnels`) — 2 panes

| Pane                                           | Key                 | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------- | ------------------- | ------ | ---- | --------- | ------- |
| New campaign / Campaign _(opened from a list)_ | `funnels.campaign`  | —      | —    | —         | —       |
| Campaigns                                      | `funnels.campaigns` | —      | —    | —         | —       |

### Content (`cms`) — 18 panes

| Pane                                    | Key                             | Design | Ease  | Gap to 10                                                                                       | Persona |
| --------------------------------------- | ------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------- | ------- |
| Author _(opened from a list)_           | `cms.authors.detail`            | 8      | 8     | no link to the author's page on the site                                                        | P01     |
| Authors                                 | `cms.authors.list`              | 8      | 8     | at 360px the web address is dropped                                                             | P01     |
| Content _(opened from a list)_          | `cms.content.detail`            | 8      | 8     | "Published" shows twice, a badge and a banner; the missing-entry state reads well               | P01     |
| Content                                 | `cms.content.list`              | 7      | 6     | at 360px the Status column is cut off at the right edge behind a sideways scroll                | P01     |
| Legal pages                             | `cms.legal.list`                | 8      | 8     | "3 of 4 required pages ready" shows twice; the missing page is below the fold                   | P01     |
| Media _(opened from a list)_            | `cms.media.detail`              | —      | —     | —                                                                                               | —       |
| Media                                   | `cms.media.list`                | —      | —     | —                                                                                               | —       |
| Import redirects _(opened from a list)_ | `cms.redirects.import`          | —      | —     | —                                                                                               | —       |
| Redirects                               | `cms.redirects.list`            | —      | —     | —                                                                                               | —       |
| Tags & topics _(opened from a list)_    | `cms.taxonomy.detail`           | —      | —     | —                                                                                               | —       |
| Tags & topics                           | `cms.taxonomy.list`             | —      | —     | —                                                                                               | —       |
| Translations _(opened from a list)_     | `cms.translations.detail`       | —      | —     | —                                                                                               | —       |
| Translations                            | `cms.translations.list`         | —      | —     | —                                                                                               | —       |
| Content type _(opened from a list)_     | `cms.types.detail`              | —      | —     | —                                                                                               | —       |
| Content types                           | `cms.types.list`                | —      | —     | —                                                                                               | —       |
| Webhook _(opened from a list)_          | `cms.webhooks.detail`           | 6 → 8  | 7 → 8 | 235 fixed (its own not-found box); not checked: the editor itself (Gillett has no live webhook) | P01     |
| Webhooks                                | `cms.webhooks.list`             | 8      | 8     | two add buttons at once, toolbar and empty state                                                | P01     |
| Product translations                    | `commerce.product.translations` | —      | —     | —                                                                                               | —       |

### Customers (`crm`) — 35 panes

| Pane                                          | Key                        | Design | Ease | Gap to 10                                                                                                                                                                                                                                                               | Persona |
| --------------------------------------------- | -------------------------- | ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Company _(opened from a list)_                | `crm.account.detail`       | 8      | 8    | $117.92 of credit left reads as plain header text, not a warning; placeholders name a made-up rivera business                                                                                                                                                           | P01     |
| Companies                                     | `crm.accounts.list`        | 9      | 8    | at 360px the table scrolls sideways and the status column is cut off                                                                                                                                                                                                    | P01     |
| Customer _(opened from a list)_               | `crm.customer.detail`      | 9      | 8    | the tab row needs arrows to reach Subscriptions and beyond; the score callout takes the room under the numbers                                                                                                                                                          | P01     |
| Customers                                     | `crm.customers.list`       | 9      | 8    | at 360px the table scrolls sideways and what they spent is cut off                                                                                                                                                                                                      | P01     |
| Dashboard _(opened from a list)_              | `crm.dashboard.detail`     | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Dashboards                                    | `crm.dashboards`           | 8      | 9    | the empty state offers New dashboard and Create one, two buttons for one move                                                                                                                                                                                           | P01     |
| Deal _(opened from a list)_                   | `crm.deal.detail`          | 9      | 8    | the company comes in filled but the customer from that company still has to be typed; the pipeline sits below the fold                                                                                                                                                  | P01     |
| Deals                                         | `crm.deals.list`           | 9      | 8    | every step badge is the same cyan, so First call and Proposal sent look alike; at 360px who it is for is gone                                                                                                                                                           | P01     |
| Duplicates                                    | `crm.duplicates.list`      | 9      | 9    | None found in the bar repeats the empty state under it                                                                                                                                                                                                                  | P01     |
| Connect a mailbox _(opened from a list)_      | `crm.mailbox.connect`      | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Mailboxes                                     | `crm.mailboxes.list`       | 9      | 8    | Connect a mailbox twice on one empty screen (fixed 236: the note about a row that was not there)                                                                                                                                                                        | P01     |
| Booking links                                 | `crm.meeting-links`        | 9      | 8    | the bar repeats No booking links yet over the empty state (fixed 237: it was a bare heading in a blank column)                                                                                                                                                          | P01     |
| Record type _(opened from a list)_            | `crm.object-type.detail`   | 9      | 8    | the form card does not fill the column like the other editors; Save sits pale until a name is typed                                                                                                                                                                     | P01     |
| Record types                                  | `crm.object-types.list`    | 9      | 8    | Extra details shows a dash on every row; at 360px what each type is for is gone                                                                                                                                                                                         | P01     |
| Customer orders                               | `crm.orders.list`          | 8      | 8    | the refunded order shows its full total with no sign of the refund; one long status pushes the total off a phone (fixed 238: numbers broke in two)                                                                                                                      | P01     |
| Connect a phone system _(opened from a list)_ | `crm.phone-system.connect` | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Phone systems                                 | `crm.phone-systems.list`   | 9      | 8    | Connect a phone system twice on one empty screen (fixed 239: a note about a number that was not there)                                                                                                                                                                  | P01     |
| Pipeline _(opened from a list)_               | `crm.pipeline.detail`      | 8      | 7    | Short id is a technical word with a placeholder that does not match the name; the solid info bar is louder than the form it sits under                                                                                                                                  | P01     |
| Pipelines                                     | `crm.pipelines.list`       | 9      | 8    | two rows both say Default, which reads as a clash until you see they move different things                                                                                                                                                                              | P01     |
| Record _(opened from a list)_                 | `crm.record.detail`        | 9      | 9    | Gillett has no record types of its own, so only the gone state was seen; it reads right                                                                                                                                                                                 | P01     |
| Records _(opened from a list)_                | `crm.records.list`         | 9      | 9    | a saved list for a type that is gone; the gone state reads right (fixed 240: it drew a working empty list with an Add button)                                                                                                                                           | P01     |
| Report _(opened from a list)_                 | `crm.report.builder`       | 9      | 9    | a saved report since deleted; only the gone state was seen                                                                                                                                                                                                              | P01     |
| Build a report                                | `crm.report.library`       | 8      | 8    | the visualization badge and the copy button are color="neutral" (needs approval); the copy action is an icon with no word, so its meaning rests on a tooltip (fixed 244: New report hid in the menu on a phone; fixed 246: no report could be opened from the keyboard) | P01     |
| Reports                                       | `crm.reports`              | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Scoring                                       | `crm.scoring`              | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Segment _(opened from a list)_                | `crm.segment.detail`       | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Segments                                      | `crm.segments.list`        | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| How the CRM behaves                           | `crm.settings`             | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Response times                                | `crm.sla-policies`         | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Saved paragraphs                              | `crm.snippets.list`        | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Task _(opened from a list)_                   | `crm.task.detail`          | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Tasks                                         | `crm.tasks.list`           | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Email templates                               | `crm.templates.list`       | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Request _(opened from a list)_                | `crm.ticket.detail`        | —      | —    | —                                                                                                                                                                                                                                                                       | —       |
| Requests                                      | `crm.tickets.list`         | —      | —    | —                                                                                                                                                                                                                                                                       | —       |

### Dropshipping (`dropship`) — 7 panes

| Pane                                  | Key                         | Design | Ease | Gap to 10                                                                                                 | Persona |
| ------------------------------------- | --------------------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------- | ------- |
| Product dropshipping                  | `commerce.product.dropship` | 8      | 8    | with one supplier it is picked for him without saying why (it still needs the cost typed before it links) | P01     |
| Profitability                         | `dropship.analytics`        | —      | —    | —                                                                                                         | —       |
| Supplier order _(opened from a list)_ | `dropship.order.detail`     | —      | —    | —                                                                                                         | —       |
| Supplier orders                       | `dropship.orders.list`      | —      | —    | —                                                                                                         | —       |
| Supplier products                     | `dropship.products.list`    | —      | —    | —                                                                                                         | —       |
| Supplier _(opened from a list)_       | `dropship.supplier.detail`  | —      | —    | —                                                                                                         | —       |
| Suppliers                             | `dropship.suppliers.list`   | —      | —    | —                                                                                                         | —       |

### Email (`email`) — 9 panes

| Pane                                                           | Key                           | Design | Ease | Gap to 10 | Persona |
| -------------------------------------------------------------- | ----------------------------- | ------ | ---- | --------- | ------- |
| Broadcast _(opened from a list)_                               | `email.broadcasts.detail`     | —      | —    | —         | —       |
| Broadcasts                                                     | `email.broadcasts.list`       | —      | —    | —         | —       |
| Add a sending address / Sending address _(opened from a list)_ | `email.domains.detail`        | —      | —    | —         | —       |
| Sending addresses                                              | `email.domains.list`          | —      | —    | —         | —       |
| New sequence / Sequence _(opened from a list)_                 | `email.sequences.detail`      | —      | —    | —         | —       |
| Enrolled people _(opened from a list)_                         | `email.sequences.enrollments` | —      | —    | —         | —       |
| Sequences                                                      | `email.sequences.list`        | —      | —    | —         | —       |
| Email settings                                                 | `email.settings`              | —      | —    | —         | —       |
| Do not email                                                   | `email.suppressions.list`     | —      | —    | —         | —       |

### Finance (`finance`) — 15 panes

| Pane                                   | Key                      | Design | Ease | Gap to 10 | Persona |
| -------------------------------------- | ------------------------ | ------ | ---- | --------- | ------- |
| Accounting                             | `finance.accounting`     | —      | —    | —         | —       |
| Bills to pay                           | `finance.bills`          | —      | —    | —         | —       |
| Spending categories                    | `finance.categories`     | —      | —    | —         | —       |
| Where money comes from                 | `finance.channels`       | —      | —    | —         | —       |
| New cost / Cost _(opened from a list)_ | `finance.expense.detail` | —      | —    | —         | —       |
| By job                                 | `finance.jobs`           | —      | —    | —         | —       |
| Payments                               | `finance.payments.list`  | —      | —    | —         | —       |
| Deposit _(opened from a list)_         | `finance.payout.detail`  | —      | —    | —         | —       |
| Payouts                                | `finance.payouts.list`   | —      | —    | —         | —       |
| Profit                                 | `finance.profit`         | —      | —    | —         | —       |
| Owed to you                            | `finance.receivables`    | —      | —    | —         | —       |
| Repeating costs                        | `finance.recurring`      | —      | —    | —         | —       |
| Spending                               | `finance.spending`       | —      | —    | —         | —       |
| Your sparx bill                        | `finance.subscription`   | —      | —    | —         | —       |
| Who you pay                            | `finance.vendors`        | —      | —    | —         | —       |

### Inventory (`inventory`) — 80 panes

| Pane                                                             | Key                                               | Design | Ease | Gap to 10                                                  | Persona |
| ---------------------------------------------------------------- | ------------------------------------------------- | ------ | ---- | ---------------------------------------------------------- | ------- |
| Product stock                                                    | `commerce.product.stock`                          | 8      | 8    | "0 to sell" in the toolbar repeats the red banner below it | P01     |
| On the way                                                       | `inventory.advance-ship-notices`                  | —      | —    | —                                                          | —       |
| Shipment _(opened from a list)_                                  | `inventory.advance-ship-notices.detail`           | —      | —    | —                                                          | —       |
| Plan a run / Run _(opened from a list)_                          | `inventory.assemblies.detail`                     | —      | —    | —                                                          | —       |
| Runs                                                             | `inventory.assemblies.list`                       | —      | —    | —                                                          | —       |
| Waiting list                                                     | `inventory.backorders`                            | —      | —    | —                                                          | —       |
| Owed _(opened from a list)_                                      | `inventory.backorders.detail`                     | —      | —    | —                                                          | —       |
| Shared barcodes                                                  | `inventory.barcodes.conflicts`                    | —      | —    | —                                                          | —       |
| Product labels                                                   | `inventory.barcodes.labels`                       | —      | —    | —                                                          | —       |
| Barcodes                                                         | `inventory.barcodes.list`                         | —      | —    | —                                                          | —       |
| New shelf / Shelf _(opened from a list)_                         | `inventory.bins.detail`                           | —      | —    | —                                                          | —       |
| Shelf labels                                                     | `inventory.bins.labels`                           | —      | —    | —                                                          | —       |
| Shelves                                                          | `inventory.bins.list`                             | —      | —    | —                                                          | —       |
| New recipe / Recipe _(opened from a list)_                       | `inventory.boms.detail`                           | —      | —    | —                                                          | —       |
| Recipes                                                          | `inventory.boms.list`                             | —      | —    | —                                                          | —       |
| Consignment settlement                                           | `inventory.consignment`                           | —      | —    | —                                                          | —       |
| Settlement _(opened from a list)_                                | `inventory.consignment.detail`                    | —      | —    | —                                                          | —       |
| How stock is valued                                              | `inventory.costing.settings`                      | —      | —    | —                                                          | —       |
| What your stock cost you                                         | `inventory.costing.uncosted`                      | —      | —    | —                                                          | —       |
| Cost vs plan                                                     | `inventory.costing.variance`                      | —      | —    | —                                                          | —       |
| Counting schedules                                               | `inventory.count-schedules`                       | —      | —    | —                                                          | —       |
| New counting schedule / Counting schedule _(opened from a list)_ | `inventory.count-schedules.detail`                | —      | —    | —                                                          | —       |
| New count / Stock count _(opened from a list)_                   | `inventory.counts.detail`                         | —      | —    | —                                                          | —       |
| Stock counts                                                     | `inventory.counts.list`                           | —      | —    | —                                                          | —       |
| Your own columns                                                 | `inventory.custom-fields`                         | —      | —    | —                                                          | —       |
| Print a label _(opened from a list)_                             | `inventory.documents.label`                       | —      | —    | —                                                          | —       |
| Expiring stock                                                   | `inventory.expiring`                              | —      | —    | —                                                          | —       |
| Integrity                                                        | `inventory.integrity`                             | —      | —    | —                                                          | —       |
| Batch _(opened from a list)_                                     | `inventory.lots.detail`                           | —      | —    | —                                                          | —       |
| Lots & serials                                                   | `inventory.lots.list`                             | —      | —    | —                                                          | —       |
| Movements                                                        | `inventory.movements.list`                        | —      | —    | —                                                          | —       |
| Whose stock                                                      | `inventory.ownership`                             | —      | —    | —                                                          | —       |
| Pack bench                                                       | `inventory.packing.bench`                         | —      | —    | —                                                          | —       |
| Walk _(opened from a list)_                                      | `inventory.picking.detail`                        | —      | —    | —                                                          | —       |
| Picking _(opened from a list)_                                   | `inventory.picking.guided`                        | —      | —    | —                                                          | —       |
| Walks                                                            | `inventory.picking.list`                          | —      | —    | —                                                          | —       |
| Pick & pack throughput                                           | `inventory.picking.throughput`                    | —      | —    | —                                                          | —       |
| At risk                                                          | `inventory.planning`                              | —      | —    | —                                                          | —       |
| What matters                                                     | `inventory.planning.classes`                      | —      | —    | —                                                          | —       |
| Why this number _(opened from a list)_                           | `inventory.planning.explain`                      | —      | —    | —                                                          | —       |
| Cost to keep                                                     | `inventory.planning.holding`                      | —      | —    | —                                                          | —       |
| Not selling                                                      | `inventory.planning.idle`                         | —      | —    | —                                                          | —       |
| Planning settings                                                | `inventory.planning.settings`                     | —      | —    | —                                                          | —       |
| Preorders                                                        | `inventory.preorders`                             | —      | —    | —                                                          | —       |
| Spending limits                                                  | `inventory.purchase-orders.approval-rules`        | —      | —    | —                                                          | —       |
| New spending limit / Spending limit _(opened from a list)_       | `inventory.purchase-orders.approval-rules.detail` | —      | —    | —                                                          | —       |
| Sign-offs                                                        | `inventory.purchase-orders.approvals`             | —      | —    | —                                                          | —       |
| New purchase order / Purchase order _(opened from a list)_       | `inventory.purchase-orders.detail`                | —      | —    | —                                                          | —       |
| Overdue deliveries                                               | `inventory.purchase-orders.late`                  | —      | —    | —                                                          | —       |
| Purchase orders                                                  | `inventory.purchase-orders.list`                  | —      | —    | —                                                          | —       |
| Receive a delivery / Delivery _(opened from a list)_             | `inventory.receiving.detail`                      | —      | —    | —                                                          | —       |
| Receiving                                                        | `inventory.receiving.list`                        | —      | —    | —                                                          | —       |
| Scan a delivery _(opened from a list)_                           | `inventory.receiving.scan`                        | —      | —    | —                                                          | —       |
| Stock versus your books                                          | `inventory.reconciliation.books`                  | —      | —    | —                                                          | —       |
| Reorder                                                          | `inventory.reorder`                               | —      | —    | —                                                          | —       |
| Reports                                                          | `inventory.reports`                               | —      | —    | —                                                          | —       |
| How it is performing                                             | `inventory.reports.performance`                   | —      | —    | —                                                          | —       |
| Send a report / Scheduled report _(opened from a list)_          | `inventory.reports.schedule`                      | —      | —    | —                                                          | —       |
| Sent to your inbox                                               | `inventory.reports.schedules`                     | —      | —    | —                                                          | —       |
| Set up your stock                                                | `inventory.setup`                                 | —      | —    | —                                                          | —       |
| Stock sources                                                    | `inventory.sources`                               | —      | —    | —                                                          | —       |
| Add a source / Stock source _(opened from a list)_               | `inventory.sources.detail`                        | —      | —    | —                                                          | —       |
| Edit stock in a grid                                             | `inventory.stock.grid`                            | —      | —    | —                                                          | —       |
| Import from a spreadsheet                                        | `inventory.stock.import`                          | —      | —    | —                                                          | —       |
| Stock item _(opened from a list)_                                | `inventory.stock.item`                            | —      | —    | —                                                          | —       |
| Stock                                                            | `inventory.stock.list`                            | —      | —    | —                                                          | —       |
| Where this number came from _(opened from a list)_               | `inventory.stock.provenance`                      | —      | —    | —                                                          | —       |
| Bills to pay                                                     | `inventory.supplier-bills`                        | —      | —    | —                                                          | —       |
| Enter an invoice / Supplier invoice _(opened from a list)_       | `inventory.supplier-bills.detail`                 | —      | —    | —                                                          | —       |
| Sent back                                                        | `inventory.supplier-returns`                      | —      | —    | —                                                          | —       |
| Send something back / Return _(opened from a list)_              | `inventory.supplier-returns.detail`               | —      | —    | —                                                          | —       |
| New supplier / Supplier _(opened from a list)_                   | `inventory.suppliers.detail`                      | —      | —    | —                                                          | —       |
| Suppliers                                                        | `inventory.suppliers.list`                        | —      | —    | —                                                          | —       |
| Supplier performance                                             | `inventory.suppliers.scorecards`                  | —      | —    | —                                                          | —       |
| New transfer / Transfer _(opened from a list)_                   | `inventory.transfers.detail`                      | —      | —    | —                                                          | —       |
| Transfers                                                        | `inventory.transfers.list`                        | —      | —    | —                                                          | —       |
| Units                                                            | `inventory.units`                                 | —      | —    | —                                                          | —       |
| Warehouse mode                                                   | `inventory.warehouse`                             | —      | —    | —                                                          | —       |
| New location / Location _(opened from a list)_                   | `inventory.warehouses.detail`                     | —      | —    | —                                                          | —       |
| Locations                                                        | `inventory.warehouses.list`                       | —      | —    | —                                                          | —       |

### Invoicing (`invoicing`) — 8 panes

| Pane                                                 | Key                          | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------------- | ---------------------------- | ------ | ---- | --------- | ------- |
| string / Invoice _(opened from a list)_              | `invoicing.invoice.edit`     | —      | —    | —         | —       |
| Preview _(opened from a list)_                       | `invoicing.invoice.preview`  | —      | —    | —         | —       |
| Invoices                                             | `invoicing.invoices.list`    | —      | —    | —         | —       |
| New template / Print template _(opened from a list)_ | `invoicing.template.edit`    | —      | —    | —         | —       |
| Preview _(opened from a list)_                       | `invoicing.template.preview` | —      | —    | —         | —       |
| Print templates                                      | `invoicing.templates`        | —      | —    | —         | —       |
| New workflow / Workflow _(opened from a list)_       | `invoicing.workflow.edit`    | —      | —    | —         | —       |
| Workflows                                            | `invoicing.workflows`        | —      | —    | —         | —       |

### Messages (`chat`) — 5 panes

| Pane                                | Key                  | Design | Ease  | Gap to 10                                                                            | Persona |
| ----------------------------------- | -------------------- | ------ | ----- | ------------------------------------------------------------------------------------ | ------- |
| Inbox                               | `chat.inbox`         | 8      | 8     | each row previews the shop's own last reply without saying who spoke last            | P01     |
| Conversation _(opened from a list)_ | `chat.inbox.thread`  | 6 → 8  | 5 → 8 | 234 fixed (conversation squeezed to one line); at 360px the reply box needs a scroll | P01     |
| Overview                            | `chat.overview`      | —      | —     | —                                                                                    | —       |
| Quick replies                       | `chat.quick-replies` | —      | —     | —                                                                                    | —       |
| Chat settings                       | `chat.settings`      | —      | —     | —                                                                                    | —       |

### Partners (`partner`) — 8 panes

| Pane                            | Key                        | Design | Ease | Gap to 10 | Persona |
| ------------------------------- | -------------------------- | ------ | ---- | --------- | ------- |
| Bootcamp _(opened from a list)_ | `partner.bootcamp.detail`  | —      | —    | —         | —       |
| Bootcamps                       | `partner.bootcamps`        | —      | —    | —         | —       |
| Clients                         | `partner.clients.list`     | —      | —    | —         | —       |
| Commissions                     | `partner.commissions.list` | —      | —    | —         | —       |
| Your listing                    | `partner.profile`          | —      | —    | —         | —       |
| Referrals                       | `partner.referrals.list`   | —      | —    | —         | —       |
| Resources                       | `partner.resources`        | —      | —    | —         | —       |
| Your tier                       | `partner.tier`             | —      | —    | —         | —       |

### Scheduling (`scheduling`) — 17 panes

| Pane                                                             | Key                               | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------------------------- | --------------------------------- | ------ | ---- | --------- | ------- |
| Availability                                                     | `scheduling.availability`         | —      | —    | —         | —       |
| New booking / Booking _(opened from a list)_                     | `scheduling.bookings.detail`      | —      | —    | —         | —       |
| Bookings                                                         | `scheduling.bookings.list`        | —      | —    | —         | —       |
| Calendar                                                         | `scheduling.calendar`             | —      | —    | —         | —       |
| Linked calendars _(opened from a list)_                          | `scheduling.calendar.connections` | —      | —    | —         | —       |
| New place / Place _(opened from a list)_                         | `scheduling.locations.detail`     | —      | —    | —         | —       |
| Places                                                           | `scheduling.locations.list`       | —      | —    | —         | —       |
| Booking rules                                                    | `scheduling.policies`             | —      | —    | —         | —       |
| New rule set / Rule set _(opened from a list)_                   | `scheduling.policies.detail`      | —      | —    | —         | —       |
| Reports                                                          | `scheduling.reports`              | —      | —    | —         | —       |
| New resource / Resource _(opened from a list)_                   | `scheduling.resources.detail`     | —      | —    | —         | —       |
| People & equipment                                               | `scheduling.resources.list`       | —      | —    | —         | —       |
| New repeating booking / Repeating booking _(opened from a list)_ | `scheduling.series.detail`        | —      | —    | —         | —       |
| Repeating bookings                                               | `scheduling.series.list`          | —      | —    | —         | —       |
| New service / Service _(opened from a list)_                     | `scheduling.services.detail`      | —      | —    | —         | —       |
| Services                                                         | `scheduling.services.list`        | —      | —    | —         | —       |
| Waiting list                                                     | `scheduling.waitlist`             | —      | —    | —         | —       |

### Selling (`commerce`) — 55 panes

| Pane                                      | Key                                     | Design | Ease  | Gap to 10                                                                                                                                             | Persona |
| ----------------------------------------- | --------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Account credit                            | `commerce.account-credit.list`          | —      | —     | —                                                                                                                                                     | —       |
| Bundle _(opened from a list)_             | `commerce.bundle.detail`                | —      | —     | —                                                                                                                                                     | —       |
| Bundles                                   | `commerce.bundles.list`                 | —      | —     | —                                                                                                                                                     | —       |
| Basket _(opened from a list)_             | `commerce.cart.detail`                  | —      | —     | —                                                                                                                                                     | —       |
| Carts                                     | `commerce.carts.list`                   | 8      | 7     | at 360px the In progress / Walked away / Came back views disappear; not checked: a real abandoned cart (the sweep does not run in local dev)          | P01     |
| Categories                                | `commerce.categories.list`              | —      | —     | —                                                                                                                                                     | —       |
| Category _(opened from a list)_           | `commerce.category.detail`              | 8      | 7     | the parent picker is a long box of every category inside the form                                                                                     | P01     |
| Sales channels                            | `commerce.channels.list`                | —      | —     | —                                                                                                                                                     | —       |
| Checkout session _(opened from a list)_   | `commerce.checkout-session.detail`      | —      | —     | —                                                                                                                                                     | —       |
| Checkout sessions                         | `commerce.checkout-sessions.list`       | —      | —     | —                                                                                                                                                     | —       |
| Collection _(opened from a list)_         | `commerce.collection.detail`            | —      | —     | —                                                                                                                                                     | —       |
| Collections                               | `commerce.collections.list`             | —      | —     | —                                                                                                                                                     | —       |
| Build template _(opened from a list)_     | `commerce.configurator-template.detail` | —      | —     | —                                                                                                                                                     | —       |
| Configurator                              | `commerce.configurator.list`            | —      | —     | —                                                                                                                                                     | —       |
| Core charges set up as choices            | `commerce.core-choices.list`            | 7      | 8     | with nothing to change the toolbar still shows a disabled "Change all 0"                                                                              | P01     |
| Cores owed                                | `commerce.cores.list`                   | 8      | 7     | at 360px order numbers break mid-number and the action buttons sit off-screen                                                                         | P01     |
| Discount _(opened from a list)_           | `commerce.discount.detail`              | 8      | 7     | a "Name" section holding a "Name" field; nothing near the top says it applies to the whole order                                                      | P01     |
| Discounts                                 | `commerce.discounts.list`               | 8      | 7     | at 360px the list scrolls sideways and its State is off-screen; the code badge is plain grey                                                          | P01     |
| Compatibility list _(opened from a list)_ | `commerce.fitment.domain.detail`        | 8      | 7     | sixteen picture tiles fill the top of the form, above the makes and models that matter                                                                | P01     |
| Fitment                                   | `commerce.fitment.list`                 | 8      | 7     | at 360px "Entries" is cut off at the edge ("5 make")                                                                                                  | P01     |
| Gift card _(opened from a list)_          | `commerce.giftcard.detail`              | —      | —     | —                                                                                                                                                     | —       |
| Gift cards                                | `commerce.giftcards.list`               | —      | —     | —                                                                                                                                                     | —       |
| sparx.market                              | `commerce.market`                       | —      | —     | —                                                                                                                                                     | —       |
| Markup rule _(opened from a list)_        | `commerce.markup-rule.detail`           | 6 → 8  | 7     | 233 fixed (name shown twice); how the price is worked out sits below the fold                                                                         | P01     |
| Markup rules                              | `commerce.markup-rules.list`            | 8      | 8     | the "Quotes" badge is the only cue to what a rule prices                                                                                              | P01     |
| Order _(opened from a list)_              | `commerce.order.detail`                 | 8 → 8  | 6 → 8 | 232 fixed: "Paid so far" was net of refunds; at 360px the toolbar keeps only the total                                                                | P01     |
| Orders                                    | `commerce.orders.list`                  | 8      | 7     | at 360px Total is cut off at the right edge ("$1,587.0")                                                                                              | P01     |
| Price list _(opened from a list)_         | `commerce.pricelist.detail`             | 8      | 8     | rated on its "no longer here" state only; not checked: the editor (Gillett has no price list)                                                         | P01     |
| Price lists                               | `commerce.pricing.list`                 | —      | —     | —                                                                                                                                                     | —       |
| Product type _(opened from a list)_       | `commerce.product-types.detail`         | —      | —     | —                                                                                                                                                     | —       |
| Product types                             | `commerce.product-types.list`           | —      | —     | —                                                                                                                                                     | —       |
| Product listings                          | `commerce.product.channels`             | —      | —     | —                                                                                                                                                     | —       |
| Product configurator                      | `commerce.product.configurator`         | —      | —     | —                                                                                                                                                     | —       |
| Product _(opened from a list)_            | `commerce.product.detail`               | 8      | 7     | "On sale" shows twice (badge and banner); the description is a small scrolling box; at 360px Save, View, Share and Take off sale all hide in the menu | P01     |
| Product fitment                           | `commerce.product.fitment`              | —      | —     | —                                                                                                                                                     | —       |
| Product reviews & questions               | `commerce.product.reviews`              | —      | —     | —                                                                                                                                                     | —       |
| Product subscriptions                     | `commerce.product.subscriptions`        | —      | —     | —                                                                                                                                                     | —       |
| Products                                  | `commerce.products.list`                | 8      | 7     | at 360px price and status are off-screen; two ways to page at once                                                                                    | P01     |
| Payment provider _(opened from a list)_   | `commerce.provider.detail`              | 8      | 8     | "Chosen: finish setup to go live" and "Details still needed" say it twice; the dark-mode callout is a loud bright blue                                | P01     |
| Payment providers                         | `commerce.providers`                    | 7      | 7     | at 360px the description wraps one word per line beside its badge; "Available" badges are plain grey                                                  | P01     |
| Questions & answers                       | `commerce.qa.list`                      | —      | —     | —                                                                                                                                                     | —       |
| Questions queue _(opened from a list)_    | `commerce.qa.queue`                     | —      | —     | —                                                                                                                                                     | —       |
| Reports                                   | `commerce.reports`                      | 8      | 8     | revenue in whole dollars beside an average in cents; the day chart has no axis labels                                                                 | P01     |
| Take a sale                               | `commerce.sale.new`                     | 8      | 7     | the item list scrolls inside a pane that also scrolls; Write it down sits pale until the sale is complete with no word on what is missing             | P01     |
| Return _(opened from a list)_             | `commerce.return.detail`                | 8      | 8     | the returned line shows the $600.00 price each while it settled at $793.50 with tax and deposit                                                       | P01     |
| Returns                                   | `commerce.returns.list`                 | 8      | 8     | at 360px the customer and date columns are gone and the stage filters fold into a menu                                                                | P01     |
| Reviews                                   | `commerce.reviews.list`                 | —      | —     | —                                                                                                                                                     | —       |
| Reviews queue _(opened from a list)_      | `commerce.reviews.queue`                | —      | —     | —                                                                                                                                                     | —       |
| Selling settings                          | `commerce.settings`                     | 8      | 8     | a narrow centered column in a wide pane; the resting Save reads as a pale button                                                                      | P01     |
| Shipping                                  | `commerce.shipping.list`                | 9      | 9     | product groups and the rest sit below the fold with no summary at the top                                                                             | P01     |
| Delivery profile _(opened from a list)_   | `commerce.shipping.profile.detail`      | —      | —     | —                                                                                                                                                     | —       |
| Delivery region _(opened from a list)_    | `commerce.shipping.zone.detail`         | 9      | 8     | the priority stepper needs a long note to explain itself                                                                                              | P01     |
| Subscription _(opened from a list)_       | `commerce.subscription.detail`          | —      | —     | —                                                                                                                                                     | —       |
| New subscription _(opened from a list)_   | `commerce.subscription.new`             | —      | —     | —                                                                                                                                                     | —       |
| Subscriptions                             | `commerce.subscriptions.list`           | —      | —     | —                                                                                                                                                     | —       |
| Tax                                       | `commerce.tax.list`                     | 8      | 8     | a place that is off still shows a No rate set warning beside it                                                                                       | P01     |
| Tax place _(opened from a list)_          | `commerce.tax.zone.detail`              | 9      | 8     | the rate, the part that matters, sits below the fold under the paperwork fields                                                                       | P01     |
| Wishlists                                 | `commerce.wishlists.list`               | —      | —     | —                                                                                                                                                     | —       |

### SEO (`seo`) — 4 panes

| Pane                              | Key                  | Design | Ease | Gap to 10 | Persona |
| --------------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Site checks                       | `seo.audits`         | —      | —    | —         | —       |
| Page check _(opened from a list)_ | `seo.audits.detail`  | —      | —    | —         | —       |
| Search performance                | `seo.performance`    | —      | —    | —         | —       |
| Search Console                    | `seo.search-console` | —      | —    | —         | —       |

### Site (`builder`) — 10 panes

| Pane                               | Key                  | Design | Ease | Gap to 10                                                                                                 | Persona |
| ---------------------------------- | -------------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------- | ------- |
| Blueprint _(opened from a list)_   | `builder.blueprint`  | 8      | 7    | the action that adds this design is out of view; at 360px the toolbar holds only the menu                 | P01     |
| Blueprints                         | `builder.blueprints` | 8      | 8    | two ways to page at once: "Load 25 more" and page numbers                                                 | P01     |
| Saved piece _(opened from a list)_ | `builder.component`  | —      | —    | —                                                                                                         | —       |
| Saved pieces                       | `builder.components` | —      | —    | —                                                                                                         | —       |
| Email designs                      | `builder.email`      | 7      | 6    | three toolbar rows on desktop; at 360px the toolbar fills half the screen and the canvas scrolls sideways | P01     |
| Form submissions                   | `builder.forms`      | 8      | 8    | no search; the "Read" badge is plain grey                                                                 | P01     |
| Page results                       | `builder.pages`      | —      | —    | —                                                                                                         | —       |
| Site                               | `builder.site`       | 8      | 8    | at 360px the web address breaks mid-word ("gille / ttdiesel")                                             | P01     |
| Editor                             | `builder.studio`     | 7      | 6    | at 360px the page is cut off sideways and the status line runs off the edge                               | P01     |
| Submission _(opened from a list)_  | `builder.submission` | 7      | 7    | the status sits in a grey box; at 360px "Mark as handled", the main action, hides in the menu             | P01     |

### Social (`social`) — 8 panes

| Pane                                   | Key                  | Design | Ease | Gap to 10 | Persona |
| -------------------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Approvals                              | `social.approvals`   | —      | —    | —         | —       |
| Cadence                                | `social.cadence`     | —      | —    | —         | —       |
| Calendar                               | `social.calendar`    | —      | —    | —         | —       |
| New post / Post _(opened from a list)_ | `social.composer`    | —      | —    | —         | —       |
| Connections                            | `social.connections` | —      | —    | —         | —       |
| Inbox                                  | `social.inbox`       | —      | —    | —         | —       |
| Insights                               | `social.insights`    | —      | —    | —         | —       |
| Posts                                  | `social.queue`       | —      | —    | —         | —       |

### Wholesale (`b2b`) — 11 panes

| Pane                                               | Key                              | Design | Ease | Gap to 10                                                                              | Persona |
| -------------------------------------------------- | -------------------------------- | ------ | ---- | -------------------------------------------------------------------------------------- | ------- |
| New account / Account _(opened from a list)_       | `b2b.account.detail`             | 6 → 8  | 7    | 233 fixed (name shown twice); a long single form, Save off until a change              | P01     |
| Accounts                                           | `b2b.accounts.list`              | 8      | 8    | at 360px "Credit used", the figure most needed, is dropped                             | P01     |
| Approvals                                          | `b2b.approvals`                  | 8      | 8    | the rule's approver picker cuts off the approver's name at desktop width               | P01     |
| New invoice / Invoice _(opened from a list)_       | `b2b.invoice.detail`             | 7      | 7    | at 360px Print or save as PDF and Open the full bill hide in the menu                  | P01     |
| Wholesale invoices                                 | `b2b.invoices.list`              | 8      | 7    | at 360px each row keeps only number and standing: who owes it and how much are dropped | P01     |
| Wholesale orders                                   | `b2b.orders.list`                | —      | —    | —                                                                                      | —       |
| New price tier / Price tier _(opened from a list)_ | `b2b.pricing-tier.detail`        | 8      | 8    | the "1 account" badge names no account and links nowhere                               | P01     |
| Price tiers                                        | `b2b.pricing-tiers.list`         | 7      | 8    | the "% off" badges are plain grey; at 360px the account count is dropped               | P01     |
| Quote _(opened from a list)_                       | `b2b.quote.detail`               | 8      | 8    | the "Submitted" badge reads nearly grey                                                | P01     |
| Quotes                                             | `b2b.quotes.list`                | 8      | 8    | filtered to one account, "Who asked" still repeats its name on every row               | P01     |
| Product trade pricing                              | `commerce.product.trade-pricing` | 8      | 8    | each tier says how many businesses are in it without naming them                       | P01     |

### Workbench (`platform`) — 29 panes

| Pane                                                                      | Key                               | Design | Ease | Gap to 10 | Persona |
| ------------------------------------------------------------------------- | --------------------------------- | ------ | ---- | --------- | ------- |
| Dashboard _(opened from a list)_                                          | `analytics.dashboard.view`        | —      | —    | —         | —       |
| Dashboards                                                                | `analytics.dashboards.list`       | —      | —    | —         | —       |
| Your feedback                                                             | `platform.feedback.list`          | —      | —    | —         | —       |
| Feedback _(opened from a list)_                                           | `platform.feedback.thread`        | —      | —    | —         | —       |
| Link _(opened from a list)_                                               | `platform.link.unresolved`        | —      | —    | —         | —       |
| Move in                                                                   | `platform.migrate`                | —      | —    | —         | —       |
| Past moves _(opened from a list)_                                         | `platform.migrate.history`        | —      | —    | —         | —       |
| string / Move in: what happened / string / Move in _(opened from a list)_ | `platform.migrate.run`            | —      | —    | —         | —       |
| Pulse                                                                     | `platform.pulse`                  | —      | —    | —         | —       |
| AI connections                                                            | `platform.settings.ai`            | —      | —    | —         | —       |
| Web address _(opened from a list)_                                        | `platform.settings.domain`        | —      | —    | —         | —       |
| Domains                                                                   | `platform.settings.domains`       | —      | —    | —         | —       |
| Business details                                                          | `platform.settings.general`       | —      | —    | —         | —       |
| Industry                                                                  | `platform.settings.industry`      | —      | —    | —         | —       |
| Connection _(opened from a list)_                                         | `platform.settings.integration`   | —      | —    | —         | —       |
| Integrations                                                              | `platform.settings.integrations`  | —      | —    | —         | —       |
| Modules                                                                   | `platform.settings.modules`       | —      | —    | —         | —       |
| Notifications                                                             | `platform.settings.notifications` | —      | —    | —         | —       |
| Partner access                                                            | `platform.settings.partner`       | —      | —    | —         | —       |
| Sample data                                                               | `platform.settings.sample-data`   | —      | —    | —         | —       |
| Security                                                                  | `platform.settings.security`      | —      | —    | —         | —       |
| Site _(opened from a list)_                                               | `platform.settings.site`          | —      | —    | —         | —       |
| Sites                                                                     | `platform.settings.sites`         | —      | —    | —         | —       |
| Team                                                                      | `platform.settings.team`          | —      | —    | —         | —       |
| Teammate _(opened from a list)_                                           | `platform.settings.team.member`   | —      | —    | —         | —       |
| Start here                                                                | `workbench.home`                  | —      | —    | —         | —       |
| Set up step by step                                                       | `workbench.onboarding`            | —      | —    | —         | —       |
| Describe your business                                                    | `workbench.onboarding.story`      | —      | —    | —         | —       |
| Get set up                                                                | `workbench.welcome`               | —      | —    | —         | —       |

### Your team (`staff`) — 6 panes

| Pane                                       | Key                    | Design | Ease | Gap to 10 | Persona |
| ------------------------------------------ | ---------------------- | ------ | ---- | --------- | ------- |
| Tickets and licenses                       | `staff.certifications` | —      | —    | —         | —       |
| People                                     | `staff.people`         | —      | —    | —         | —       |
| New person / Person _(opened from a list)_ | `staff.person`         | —      | —    | —         | —       |
| Schedule                                   | `staff.schedule`       | —      | —    | —         | —       |
| Time off                                   | `staff.timeoff`        | —      | —    | —         | —       |
| Timesheets                                 | `staff.timesheets`     | —      | —    | —         | —       |

<!-- PANES:END -->

---

## Outside the console

The doors in and the customer's side. Not generated, because they are not
registered surfaces; listed by hand from the spine and the persona's deliverable
inventory.

| Screen                                               | Where                             | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------------- | --------------------------------- | ------ | ---- | --------- | ------- |
| sparx.works home                                     | web :3003 `/`                     | —      | —    | —         | —       |
| sparx.works pricing                                  | web :3003 `/pricing`              | —      | —    | —         | —       |
| sparx.works wholesale (B2B) module page              | web :3003                         | —      | —    | —         | —       |
| Create your account                                  | workbench :3011 `/sign-up`        | —      | —    | —         | —       |
| Sign in                                              | workbench :3011 `/sign-in`        | —      | —    | —         | —       |
| Reset password                                       | workbench :3011 `/reset-password` | —      | —    | —         | —       |
| Accept an invite                                     | workbench :3011 `/accept-invite`  | —      | —    | —         | —       |
| First-run setup                                      | workbench :3011 (first-run gate)  | —      | —    | —         | —       |
| Gillett site — home                                  | published site                    | —      | —    | —         | —       |
| Gillett site — parts catalog                         | published site                    | —      | —    | —         | —       |
| Gillett site — product page                          | published site                    | —      | —    | —         | —       |
| Gillett site — cart and checkout                     | published site                    | —      | —    | —         | —       |
| Gillett site — shopper account and orders            | published site                    | —      | —    | —         | —       |
| Gillett site — trade (wholesale) sign-in and reorder | published site                    | —      | —    | —         | —       |
| Gillett site — book a service                        | published site                    | —      | —    | —         | —       |
| Gillett site — contact, about, locations             | published site                    | —      | —    | —         | —       |
| Gillett site — blog / articles                       | published site                    | —      | —    | —         | —       |
| Gillett site — legal pages                           | published site                    | —      | —    | —         | —       |
| Gillett site — 404                                   | published site                    | —      | —    | —         | —       |
| Order confirmation email                             | event-worker log                  | —      | —    | —         | —       |
| Invoice email                                        | event-worker log                  | —      | —    | —         | —       |
| MCP connection (AI client to Gillett's data)         | api-mcp                           | —      | —    | —         | —       |

---

## How this list was built

Generated by [tools/gen-pane-ratings.mjs](tools/gen-pane-ratings.mjs) from every
surface registered in `sparx/apps/workbench/lib/surfaces/catalog/*.ts`, grouped by
module and named the way the rail names it (`MODULE_LABELS` in
`sparx/apps/workbench/lib/surfaces/nav.ts`).

Regenerate before a run, never during one, and diff the result. The script
refuses to overwrite a block that already carries scores.
