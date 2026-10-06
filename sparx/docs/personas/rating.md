# sparx workbench — pane ratings

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-01

Every pane in the sparx workbench, scored on **Design** and **Ease** as the
personas open them. How and when to score is RULE #6 in [CLAUDE.md](CLAUDE.md);
this file is where the numbers live.

**Scored so far: 0 of 338 panes.** Plus the non-console list at the foot. Update
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

| Pane                                   | Key                   | Design | Ease | Gap to 10 | Persona |
| -------------------------------------- | --------------------- | ------ | ---- | --------- | ------- |
| Automation _(opened from a list)_      | `automations.detail`  | —      | —    | —         | —       |
| Automations                            | `automations.list`    | —      | —    | —         | —       |
| Recipe library                         | `automations.recipes` | —      | —    | —         | —       |
| Activity & reports                     | `automations.reports` | —      | —    | —         | —       |
| Automation run _(opened from a list)_  | `automations.run`     | —      | —    | —         | —       |
| Automation runs _(opened from a list)_ | `automations.runs`    | —      | —    | —         | —       |

### Campaigns (`funnels`) — 2 panes

| Pane                                           | Key                 | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------- | ------------------- | ------ | ---- | --------- | ------- |
| New campaign / Campaign _(opened from a list)_ | `funnels.campaign`  | —      | —    | —         | —       |
| Campaigns                                      | `funnels.campaigns` | —      | —    | —         | —       |

### Content (`cms`) — 18 panes

| Pane                                    | Key                             | Design | Ease | Gap to 10 | Persona |
| --------------------------------------- | ------------------------------- | ------ | ---- | --------- | ------- |
| Author _(opened from a list)_           | `cms.authors.detail`            | —      | —    | —         | —       |
| Authors                                 | `cms.authors.list`              | —      | —    | —         | —       |
| Content _(opened from a list)_          | `cms.content.detail`            | —      | —    | —         | —       |
| Content                                 | `cms.content.list`              | —      | —    | —         | —       |
| Legal pages                             | `cms.legal.list`                | —      | —    | —         | —       |
| Media _(opened from a list)_            | `cms.media.detail`              | —      | —    | —         | —       |
| Media                                   | `cms.media.list`                | —      | —    | —         | —       |
| Import redirects _(opened from a list)_ | `cms.redirects.import`          | —      | —    | —         | —       |
| Redirects                               | `cms.redirects.list`            | —      | —    | —         | —       |
| Tags & topics _(opened from a list)_    | `cms.taxonomy.detail`           | —      | —    | —         | —       |
| Tags & topics                           | `cms.taxonomy.list`             | —      | —    | —         | —       |
| Translations _(opened from a list)_     | `cms.translations.detail`       | —      | —    | —         | —       |
| Translations                            | `cms.translations.list`         | —      | —    | —         | —       |
| Content type _(opened from a list)_     | `cms.types.detail`              | —      | —    | —         | —       |
| Content types                           | `cms.types.list`                | —      | —    | —         | —       |
| Webhook _(opened from a list)_          | `cms.webhooks.detail`           | —      | —    | —         | —       |
| Webhooks                                | `cms.webhooks.list`             | —      | —    | —         | —       |
| Product translations                    | `commerce.product.translations` | —      | —    | —         | —       |

### Customers (`crm`) — 35 panes

| Pane                                          | Key                        | Design | Ease | Gap to 10 | Persona |
| --------------------------------------------- | -------------------------- | ------ | ---- | --------- | ------- |
| Company _(opened from a list)_                | `crm.account.detail`       | —      | —    | —         | —       |
| Companies                                     | `crm.accounts.list`        | —      | —    | —         | —       |
| Customer _(opened from a list)_               | `crm.customer.detail`      | —      | —    | —         | —       |
| Customers                                     | `crm.customers.list`       | —      | —    | —         | —       |
| Dashboard _(opened from a list)_              | `crm.dashboard.detail`     | —      | —    | —         | —       |
| Dashboards                                    | `crm.dashboards`           | —      | —    | —         | —       |
| Deal _(opened from a list)_                   | `crm.deal.detail`          | —      | —    | —         | —       |
| Deals                                         | `crm.deals.list`           | —      | —    | —         | —       |
| Duplicates                                    | `crm.duplicates.list`      | —      | —    | —         | —       |
| Connect a mailbox _(opened from a list)_      | `crm.mailbox.connect`      | —      | —    | —         | —       |
| Mailboxes                                     | `crm.mailboxes.list`       | —      | —    | —         | —       |
| Booking links                                 | `crm.meeting-links`        | —      | —    | —         | —       |
| Record type _(opened from a list)_            | `crm.object-type.detail`   | —      | —    | —         | —       |
| Record types                                  | `crm.object-types.list`    | —      | —    | —         | —       |
| Customer orders                               | `crm.orders.list`          | —      | —    | —         | —       |
| Connect a phone system _(opened from a list)_ | `crm.phone-system.connect` | —      | —    | —         | —       |
| Phone systems                                 | `crm.phone-systems.list`   | —      | —    | —         | —       |
| Pipeline _(opened from a list)_               | `crm.pipeline.detail`      | —      | —    | —         | —       |
| Pipelines                                     | `crm.pipelines.list`       | —      | —    | —         | —       |
| Record _(opened from a list)_                 | `crm.record.detail`        | —      | —    | —         | —       |
| Records _(opened from a list)_                | `crm.records.list`         | —      | —    | —         | —       |
| Report _(opened from a list)_                 | `crm.report.builder`       | —      | —    | —         | —       |
| Build a report                                | `crm.report.library`       | —      | —    | —         | —       |
| Reports                                       | `crm.reports`              | —      | —    | —         | —       |
| Scoring                                       | `crm.scoring`              | —      | —    | —         | —       |
| Segment _(opened from a list)_                | `crm.segment.detail`       | —      | —    | —         | —       |
| Segments                                      | `crm.segments.list`        | —      | —    | —         | —       |
| How the CRM behaves                           | `crm.settings`             | —      | —    | —         | —       |
| Response times                                | `crm.sla-policies`         | —      | —    | —         | —       |
| Saved paragraphs                              | `crm.snippets.list`        | —      | —    | —         | —       |
| Task _(opened from a list)_                   | `crm.task.detail`          | —      | —    | —         | —       |
| Tasks                                         | `crm.tasks.list`           | —      | —    | —         | —       |
| Email templates                               | `crm.templates.list`       | —      | —    | —         | —       |
| Request _(opened from a list)_                | `crm.ticket.detail`        | —      | —    | —         | —       |
| Requests                                      | `crm.tickets.list`         | —      | —    | —         | —       |

### Dropshipping (`dropship`) — 7 panes

| Pane                                  | Key                         | Design | Ease | Gap to 10 | Persona |
| ------------------------------------- | --------------------------- | ------ | ---- | --------- | ------- |
| Product dropshipping                  | `commerce.product.dropship` | —      | —    | —         | —       |
| Profitability                         | `dropship.analytics`        | —      | —    | —         | —       |
| Supplier order _(opened from a list)_ | `dropship.order.detail`     | —      | —    | —         | —       |
| Supplier orders                       | `dropship.orders.list`      | —      | —    | —         | —       |
| Supplier products                     | `dropship.products.list`    | —      | —    | —         | —       |
| Supplier _(opened from a list)_       | `dropship.supplier.detail`  | —      | —    | —         | —       |
| Suppliers                             | `dropship.suppliers.list`   | —      | —    | —         | —       |

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

| Pane                                                             | Key                                               | Design | Ease | Gap to 10 | Persona |
| ---------------------------------------------------------------- | ------------------------------------------------- | ------ | ---- | --------- | ------- |
| Product stock                                                    | `commerce.product.stock`                          | —      | —    | —         | —       |
| On the way                                                       | `inventory.advance-ship-notices`                  | —      | —    | —         | —       |
| Shipment _(opened from a list)_                                  | `inventory.advance-ship-notices.detail`           | —      | —    | —         | —       |
| Plan a run / Run _(opened from a list)_                          | `inventory.assemblies.detail`                     | —      | —    | —         | —       |
| Runs                                                             | `inventory.assemblies.list`                       | —      | —    | —         | —       |
| Waiting list                                                     | `inventory.backorders`                            | —      | —    | —         | —       |
| Owed _(opened from a list)_                                      | `inventory.backorders.detail`                     | —      | —    | —         | —       |
| Shared barcodes                                                  | `inventory.barcodes.conflicts`                    | —      | —    | —         | —       |
| Product labels                                                   | `inventory.barcodes.labels`                       | —      | —    | —         | —       |
| Barcodes                                                         | `inventory.barcodes.list`                         | —      | —    | —         | —       |
| New shelf / Shelf _(opened from a list)_                         | `inventory.bins.detail`                           | —      | —    | —         | —       |
| Shelf labels                                                     | `inventory.bins.labels`                           | —      | —    | —         | —       |
| Shelves                                                          | `inventory.bins.list`                             | —      | —    | —         | —       |
| New recipe / Recipe _(opened from a list)_                       | `inventory.boms.detail`                           | —      | —    | —         | —       |
| Recipes                                                          | `inventory.boms.list`                             | —      | —    | —         | —       |
| Consignment settlement                                           | `inventory.consignment`                           | —      | —    | —         | —       |
| Settlement _(opened from a list)_                                | `inventory.consignment.detail`                    | —      | —    | —         | —       |
| How stock is valued                                              | `inventory.costing.settings`                      | —      | —    | —         | —       |
| What your stock cost you                                         | `inventory.costing.uncosted`                      | —      | —    | —         | —       |
| Cost vs plan                                                     | `inventory.costing.variance`                      | —      | —    | —         | —       |
| Counting schedules                                               | `inventory.count-schedules`                       | —      | —    | —         | —       |
| New counting schedule / Counting schedule _(opened from a list)_ | `inventory.count-schedules.detail`                | —      | —    | —         | —       |
| New count / Stock count _(opened from a list)_                   | `inventory.counts.detail`                         | —      | —    | —         | —       |
| Stock counts                                                     | `inventory.counts.list`                           | —      | —    | —         | —       |
| Your own columns                                                 | `inventory.custom-fields`                         | —      | —    | —         | —       |
| Print a label _(opened from a list)_                             | `inventory.documents.label`                       | —      | —    | —         | —       |
| Expiring stock                                                   | `inventory.expiring`                              | —      | —    | —         | —       |
| Integrity                                                        | `inventory.integrity`                             | —      | —    | —         | —       |
| Batch _(opened from a list)_                                     | `inventory.lots.detail`                           | —      | —    | —         | —       |
| Lots & serials                                                   | `inventory.lots.list`                             | —      | —    | —         | —       |
| Movements                                                        | `inventory.movements.list`                        | —      | —    | —         | —       |
| Whose stock                                                      | `inventory.ownership`                             | —      | —    | —         | —       |
| Pack bench                                                       | `inventory.packing.bench`                         | —      | —    | —         | —       |
| Walk _(opened from a list)_                                      | `inventory.picking.detail`                        | —      | —    | —         | —       |
| Picking _(opened from a list)_                                   | `inventory.picking.guided`                        | —      | —    | —         | —       |
| Walks                                                            | `inventory.picking.list`                          | —      | —    | —         | —       |
| Pick & pack throughput                                           | `inventory.picking.throughput`                    | —      | —    | —         | —       |
| At risk                                                          | `inventory.planning`                              | —      | —    | —         | —       |
| What matters                                                     | `inventory.planning.classes`                      | —      | —    | —         | —       |
| Why this number _(opened from a list)_                           | `inventory.planning.explain`                      | —      | —    | —         | —       |
| Cost to keep                                                     | `inventory.planning.holding`                      | —      | —    | —         | —       |
| Not selling                                                      | `inventory.planning.idle`                         | —      | —    | —         | —       |
| Planning settings                                                | `inventory.planning.settings`                     | —      | —    | —         | —       |
| Preorders                                                        | `inventory.preorders`                             | —      | —    | —         | —       |
| Spending limits                                                  | `inventory.purchase-orders.approval-rules`        | —      | —    | —         | —       |
| New spending limit / Spending limit _(opened from a list)_       | `inventory.purchase-orders.approval-rules.detail` | —      | —    | —         | —       |
| Sign-offs                                                        | `inventory.purchase-orders.approvals`             | —      | —    | —         | —       |
| New purchase order / Purchase order _(opened from a list)_       | `inventory.purchase-orders.detail`                | —      | —    | —         | —       |
| Overdue deliveries                                               | `inventory.purchase-orders.late`                  | —      | —    | —         | —       |
| Purchase orders                                                  | `inventory.purchase-orders.list`                  | —      | —    | —         | —       |
| Receive a delivery / Delivery _(opened from a list)_             | `inventory.receiving.detail`                      | —      | —    | —         | —       |
| Receiving                                                        | `inventory.receiving.list`                        | —      | —    | —         | —       |
| Scan a delivery _(opened from a list)_                           | `inventory.receiving.scan`                        | —      | —    | —         | —       |
| Stock versus your books                                          | `inventory.reconciliation.books`                  | —      | —    | —         | —       |
| Reorder                                                          | `inventory.reorder`                               | —      | —    | —         | —       |
| Reports                                                          | `inventory.reports`                               | —      | —    | —         | —       |
| How it is performing                                             | `inventory.reports.performance`                   | —      | —    | —         | —       |
| Send a report / Scheduled report _(opened from a list)_          | `inventory.reports.schedule`                      | —      | —    | —         | —       |
| Sent to your inbox                                               | `inventory.reports.schedules`                     | —      | —    | —         | —       |
| Set up your stock                                                | `inventory.setup`                                 | —      | —    | —         | —       |
| Stock sources                                                    | `inventory.sources`                               | —      | —    | —         | —       |
| Add a source / Stock source _(opened from a list)_               | `inventory.sources.detail`                        | —      | —    | —         | —       |
| Edit stock in a grid                                             | `inventory.stock.grid`                            | —      | —    | —         | —       |
| Import from a spreadsheet                                        | `inventory.stock.import`                          | —      | —    | —         | —       |
| Stock item _(opened from a list)_                                | `inventory.stock.item`                            | —      | —    | —         | —       |
| Stock                                                            | `inventory.stock.list`                            | —      | —    | —         | —       |
| Where this number came from _(opened from a list)_               | `inventory.stock.provenance`                      | —      | —    | —         | —       |
| Bills to pay                                                     | `inventory.supplier-bills`                        | —      | —    | —         | —       |
| Enter an invoice / Supplier invoice _(opened from a list)_       | `inventory.supplier-bills.detail`                 | —      | —    | —         | —       |
| Sent back                                                        | `inventory.supplier-returns`                      | —      | —    | —         | —       |
| Send something back / Return _(opened from a list)_              | `inventory.supplier-returns.detail`               | —      | —    | —         | —       |
| New supplier / Supplier _(opened from a list)_                   | `inventory.suppliers.detail`                      | —      | —    | —         | —       |
| Suppliers                                                        | `inventory.suppliers.list`                        | —      | —    | —         | —       |
| Supplier performance                                             | `inventory.suppliers.scorecards`                  | —      | —    | —         | —       |
| New transfer / Transfer _(opened from a list)_                   | `inventory.transfers.detail`                      | —      | —    | —         | —       |
| Transfers                                                        | `inventory.transfers.list`                        | —      | —    | —         | —       |
| Units                                                            | `inventory.units`                                 | —      | —    | —         | —       |
| Warehouse mode                                                   | `inventory.warehouse`                             | —      | —    | —         | —       |
| New location / Location _(opened from a list)_                   | `inventory.warehouses.detail`                     | —      | —    | —         | —       |
| Locations                                                        | `inventory.warehouses.list`                       | —      | —    | —         | —       |

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

| Pane                                | Key                  | Design | Ease | Gap to 10 | Persona |
| ----------------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Inbox                               | `chat.inbox`         | —      | —    | —         | —       |
| Conversation _(opened from a list)_ | `chat.inbox.thread`  | —      | —    | —         | —       |
| Overview                            | `chat.overview`      | —      | —    | —         | —       |
| Quick replies                       | `chat.quick-replies` | —      | —    | —         | —       |
| Chat settings                       | `chat.settings`      | —      | —    | —         | —       |

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

### Selling (`commerce`) — 53 panes

| Pane                                      | Key                                     | Design | Ease | Gap to 10 | Persona |
| ----------------------------------------- | --------------------------------------- | ------ | ---- | --------- | ------- |
| Account credit                            | `commerce.account-credit.list`          | —      | —    | —         | —       |
| Bundle _(opened from a list)_             | `commerce.bundle.detail`                | —      | —    | —         | —       |
| Bundles                                   | `commerce.bundles.list`                 | —      | —    | —         | —       |
| Basket _(opened from a list)_             | `commerce.cart.detail`                  | —      | —    | —         | —       |
| Carts                                     | `commerce.carts.list`                   | —      | —    | —         | —       |
| Categories                                | `commerce.categories.list`              | —      | —    | —         | —       |
| Category _(opened from a list)_           | `commerce.category.detail`              | —      | —    | —         | —       |
| Sales channels                            | `commerce.channels.list`                | —      | —    | —         | —       |
| Checkout session _(opened from a list)_   | `commerce.checkout-session.detail`      | —      | —    | —         | —       |
| Checkout sessions                         | `commerce.checkout-sessions.list`       | —      | —    | —         | —       |
| Collection _(opened from a list)_         | `commerce.collection.detail`            | —      | —    | —         | —       |
| Collections                               | `commerce.collections.list`             | —      | —    | —         | —       |
| Build template _(opened from a list)_     | `commerce.configurator-template.detail` | —      | —    | —         | —       |
| Configurator                              | `commerce.configurator.list`            | —      | —    | —         | —       |
| Core charges set up as choices            | `commerce.core-choices.list`            | —      | —    | —         | —       |
| Cores owed                                | `commerce.cores.list`                   | —      | —    | —         | —       |
| Discount _(opened from a list)_           | `commerce.discount.detail`              | —      | —    | —         | —       |
| Discounts                                 | `commerce.discounts.list`               | —      | —    | —         | —       |
| Compatibility list _(opened from a list)_ | `commerce.fitment.domain.detail`        | —      | —    | —         | —       |
| Fitment                                   | `commerce.fitment.list`                 | —      | —    | —         | —       |
| Gift card _(opened from a list)_          | `commerce.giftcard.detail`              | —      | —    | —         | —       |
| Gift cards                                | `commerce.giftcards.list`               | —      | —    | —         | —       |
| sparx.market                              | `commerce.market`                       | —      | —    | —         | —       |
| Order _(opened from a list)_              | `commerce.order.detail`                 | —      | —    | —         | —       |
| Orders                                    | `commerce.orders.list`                  | —      | —    | —         | —       |
| Price list _(opened from a list)_         | `commerce.pricelist.detail`             | —      | —    | —         | —       |
| Price lists                               | `commerce.pricing.list`                 | —      | —    | —         | —       |
| Product type _(opened from a list)_       | `commerce.product-types.detail`         | —      | —    | —         | —       |
| Product types                             | `commerce.product-types.list`           | —      | —    | —         | —       |
| Product listings                          | `commerce.product.channels`             | —      | —    | —         | —       |
| Product configurator                      | `commerce.product.configurator`         | —      | —    | —         | —       |
| Product _(opened from a list)_            | `commerce.product.detail`               | —      | —    | —         | —       |
| Product fitment                           | `commerce.product.fitment`              | —      | —    | —         | —       |
| Product reviews & questions               | `commerce.product.reviews`              | —      | —    | —         | —       |
| Product subscriptions                     | `commerce.product.subscriptions`        | —      | —    | —         | —       |
| Products                                  | `commerce.products.list`                | —      | —    | —         | —       |
| Payment provider _(opened from a list)_   | `commerce.provider.detail`              | —      | —    | —         | —       |
| Payment providers                         | `commerce.providers`                    | —      | —    | —         | —       |
| Questions & answers                       | `commerce.qa.list`                      | —      | —    | —         | —       |
| Questions queue _(opened from a list)_    | `commerce.qa.queue`                     | —      | —    | —         | —       |
| Reports                                   | `commerce.reports`                      | —      | —    | —         | —       |
| Take a sale                               | `commerce.sale.new`                     | —      | —    | —         | —       |
| Return _(opened from a list)_             | `commerce.return.detail`                | —      | —    | —         | —       |
| Returns                                   | `commerce.returns.list`                 | —      | —    | —         | —       |
| Reviews                                   | `commerce.reviews.list`                 | —      | —    | —         | —       |
| Reviews queue _(opened from a list)_      | `commerce.reviews.queue`                | —      | —    | —         | —       |
| Selling settings                          | `commerce.settings`                     | —      | —    | —         | —       |
| Shipping                                  | `commerce.shipping.list`                | —      | —    | —         | —       |
| Delivery profile _(opened from a list)_   | `commerce.shipping.profile.detail`      | —      | —    | —         | —       |
| Delivery region _(opened from a list)_    | `commerce.shipping.zone.detail`         | —      | —    | —         | —       |
| Subscription _(opened from a list)_       | `commerce.subscription.detail`          | —      | —    | —         | —       |
| New subscription _(opened from a list)_   | `commerce.subscription.new`             | —      | —    | —         | —       |
| Subscriptions                             | `commerce.subscriptions.list`           | —      | —    | —         | —       |
| Tax                                       | `commerce.tax.list`                     | —      | —    | —         | —       |
| Tax place _(opened from a list)_          | `commerce.tax.zone.detail`              | —      | —    | —         | —       |
| Wishlists                                 | `commerce.wishlists.list`               | —      | —    | —         | —       |

### SEO (`seo`) — 4 panes

| Pane                              | Key                  | Design | Ease | Gap to 10 | Persona |
| --------------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Site checks                       | `seo.audits`         | —      | —    | —         | —       |
| Page check _(opened from a list)_ | `seo.audits.detail`  | —      | —    | —         | —       |
| Search performance                | `seo.performance`    | —      | —    | —         | —       |
| Search Console                    | `seo.search-console` | —      | —    | —         | —       |

### Site (`builder`) — 10 panes

| Pane                               | Key                  | Design | Ease | Gap to 10 | Persona |
| ---------------------------------- | -------------------- | ------ | ---- | --------- | ------- |
| Blueprint _(opened from a list)_   | `builder.blueprint`  | —      | —    | —         | —       |
| Blueprints                         | `builder.blueprints` | —      | —    | —         | —       |
| Saved piece _(opened from a list)_ | `builder.component`  | —      | —    | —         | —       |
| Saved pieces                       | `builder.components` | —      | —    | —         | —       |
| Email designs                      | `builder.email`      | —      | —    | —         | —       |
| Form submissions                   | `builder.forms`      | —      | —    | —         | —       |
| Page results                       | `builder.pages`      | —      | —    | —         | —       |
| Site                               | `builder.site`       | —      | —    | —         | —       |
| Editor                             | `builder.studio`     | —      | —    | —         | —       |
| Submission _(opened from a list)_  | `builder.submission` | —      | —    | —         | —       |

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

| Pane                                               | Key                              | Design | Ease | Gap to 10 | Persona |
| -------------------------------------------------- | -------------------------------- | ------ | ---- | --------- | ------- |
| New account / Account _(opened from a list)_       | `b2b.account.detail`             | —      | —    | —         | —       |
| Accounts                                           | `b2b.accounts.list`              | —      | —    | —         | —       |
| Approvals                                          | `b2b.approvals`                  | —      | —    | —         | —       |
| New invoice / Invoice _(opened from a list)_       | `b2b.invoice.detail`             | —      | —    | —         | —       |
| Wholesale invoices                                 | `b2b.invoices.list`              | —      | —    | —         | —       |
| Wholesale orders                                   | `b2b.orders.list`                | —      | —    | —         | —       |
| New price tier / Price tier _(opened from a list)_ | `b2b.pricing-tier.detail`        | —      | —    | —         | —       |
| Price tiers                                        | `b2b.pricing-tiers.list`         | —      | —    | —         | —       |
| Quote _(opened from a list)_                       | `b2b.quote.detail`               | —      | —    | —         | —       |
| Quotes                                             | `b2b.quotes.list`                | —      | —    | —         | —       |
| Product trade pricing                              | `commerce.product.trade-pricing` | —      | —    | —         | —       |

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
