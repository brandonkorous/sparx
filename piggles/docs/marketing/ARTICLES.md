# Piggles marketing — the article manifest

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-29

Every page to be built, what it has to answer, which features it owns, and which
screenshots it needs. Written **before** any of them so completeness can be
checked rather than hoped for.

Standards: [README.md](README.md). The feature list it covers: [FEATURES.md](FEATURES.md).

Legend: `[ ]` open · `[~]` in progress · `[x]` shipped · `[!]` blocked (say why)

## The count, stated up front

|                            |                                                             |
| -------------------------- | ----------------------------------------------------------- |
| Articles                   | **118**                                                     |
| Features covered           | **163 of 163** — every id owned exactly once                |
| Words, at 1,200–2,500 each | ~140,000 – 295,000                                          |
| Screenshots, at 3–6 each   | ~350 – 700 surfaces                                         |
| Image files                | ~700 – 1,400 (desktop light + dark always; mobile per shot) |

Counted, not estimated. Run from `piggles/docs/marketing/`:

```
grep -c '^- \[ \] \*\*' ARTICLES.md                      # articles
grep -oE 'Owns \*\*[^*]+\*\*' ARTICLES.md | sed 's/Owns \*\*//; s/\*\*//' \
  | tr ',' '\n' | tr -d ' ' | sort > /tmp/a.txt
grep -oE '^\| [A-Z]+-[0-9]+' FEATURES.md | sed 's/^| //' | sort > /tmp/f.txt
comm -23 /tmp/f.txt <(sort -u /tmp/a.txt)                # orphans — must be empty
uniq -d /tmp/a.txt                                       # double-owned — must be empty
```

As at 2026-08-29 that returns 118, and both `comm` and `uniq -d` return nothing.

This is a large programme and the number is not padding — it is what a platform
with 163 capabilities costs to explain properly. It is ordered into four waves
below so it ships continuously rather than all at once, and so the first wave
proves the format before the other hundred are written to it.

**Mobile captures are per shot, not universal.** The README's "both viewports"
rule is the registry's default; an article about the pack bench does not need a
phone-shaped picture of it. Mobile is **required** for `/platform/on-your-phone`,
everything under scanning and picking, and any article whose argument is that you
can do this standing up.

## The route family

`/apps/<app>/<topic>` for anything belonging to an app. `/platform/<topic>` for
console-wide subjects that belong to none. Commercial subjects extend the pages
that already exist.

Each app page becomes a **hub**: the existing `does[]` and `chapters[]` stay as
the glance, and each chapter gains links into the articles beneath it. Reasoning
in [README.md](README.md).

## Waves

| Wave  | What is in it                                                                              | Why this order                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `/platform` (5), Stock's unmentioned capabilities (7), Sell's unmentioned capabilities (4) | Proves the format, and closes the biggest credibility gaps first — a reader searching "batch tracking" or "fitment" currently finds nothing |
| **2** | The rest of Stock and Sell, plus Partners                                                  | The two largest apps finished, and the buying side that hangs off them                                                                      |
| **3** | Customers, Messages, Bookings, Invoices, Money                                             | The people-and-money half                                                                                                                   |
| **4** | Site, Content, Get Found, Team, Automations, Connections, Home, commercial                 | Everything remaining                                                                                                                        |

---

## Wave 0 — the rails

Not articles. The scaffolding every article needs, and the gate that proves the
programme finished.

- [ ] 0.1 The `/apps/<app>/<topic>` route, its layout, and the article components
      (lede, section, figure, limits block, neighbours). Built on silicaui +
      Tailwind, inheriting `data-group` from the app hub.
- [ ] 0.2 `/platform` hub and its route family.
- [ ] 0.3 `scripts/check-feature-coverage.mjs` — parses FEATURES.md and this
      file, fails on an orphan id, a double-owned id, or an `[x]` article whose
      shots are not in the registry. Wired into `pnpm check:*` and the pre-push
      guard. **Must be proved able to go red** before it counts as done.
- [ ] 0.4 App hubs gain an article index; each chapter links to the articles under it.
- [ ] 0.5 Extend `content/shots.ts` and `scripts/shot-plan.mjs` past Stock — the
      plan currently knows four surfaces in one app.
- [ ] 0.6 Confirm `wildroot-flowers` seeds every module an article needs to
      photograph. Today it carries eight and the comment claims all of them;
      `inventory` was missing. Whether Stock photographs full or empty turns on this.

---

## Wave 1

### /platform

- [ ] **P1** `/platform/your-workspace` — "Keep things open the way you keep paper on a desk"
      Owns **PLAT-01, PLAT-02, PLAT-03, PLAT-08**.
      The argument: every other product makes you close one thing to look at another. The awkward case: you are on the phone to a supplier with the order, the stock line and the customer's history all needed at once.
      Shots: windows mode with three panes · tabs mode, same panes · the layouts menu · the rail with an app put away.

- [ ] **P2** `/platform/finding-and-opening-things` — "Two keystrokes to anything"
      Owns **PLAT-04, PLAT-05, PLAT-06, PLAT-07**.
      The argument: search that returns records, not pages. The awkward case: the same list, filtered four different ways by four different people, saved.
      Shots: the launcher mid-search · a modifier opening a pane alongside · a saved view menu · the column chooser.

- [ ] **P3** `/platform/on-your-phone` — "Standing up, with one hand"
      Owns **PLAT-11**. Mobile shots **required**.
      The argument: not a companion app and not a cut-down viewer — the same console. The awkward case: a market stall with no counter and no laptop.
      Shots: the phone nav sheet · a list · a record · the app grid. All mobile.

- [ ] **P4** `/platform/moving-in` — "Bringing what you already have"
      Owns **PLAT-12**.
      The argument: the reason people do not switch is the day they would lose. The awkward case: a spreadsheet whose columns are named nothing like ours, and a run that half-worked.
      Shots: pick a source · the column mapper mid-guess · the staged preview · a run outcome naming what landed and what did not.

- [ ] **P5** `/platform/your-first-week` — "What the first few days look like"
      Owns **PLAT-13, PLAT-14, PLAT-15**.
      The argument: an empty account is the hardest screen in any product. The awkward case: wanting to try something properly before trusting it with real records.
      Shots: sample data being seeded · a first-run guide chip · an empty state with the mascot · a feedback thread with a reply.

### /apps/stock — the unmentioned ones

- [ ] **ST5** `/apps/stock/batches-serials-and-expiry` — "Which batch, and how long it has"
      Owns **STOCK-05**.
      The argument: for anything perishable or traceable, a quantity is not enough. The awkward case: a recall, and knowing which customers got which batch.
      Shots: batches with dates, one expired · a serial unit's history · the expiring list · a recall in progress.

- [ ] **ST2** `/apps/stock/where-that-number-came-from` — "The working, shown"
      Owns **STOCK-02**.
      The argument: every stock system disagrees with the shelf eventually; ours can tell you why. The awkward case: the count says nine, the screen says eleven, and somebody has to find the two.
      Shots: a stock line · its provenance view, movement by movement · the same for a number that is wrong.

- [ ] **ST7** `/apps/stock/working-with-a-scanner` — "A scanner and a phone is the whole setup"
      Owns **STOCK-08**. Mobile shots **required**.
      The argument: warehouse work is not desk work. The awkward case: a casual worker who must not see costs or be able to adjust a quantity — the `scanner` role exists for exactly this.
      Shots: warehouse mode on a phone · scan-to-receive · scan-to-pick · put-away suggestion.

- [ ] **ST10** `/apps/stock/making-things` — "When what you sell is not what you bought"
      Owns **STOCK-11**.
      The argument: a bouquet, a gift box, a kit, a rebuilt part. The awkward case: how many can you actually build right now, given what is on the shelf.
      Shots: a recipe with its components · buildable quantity · a run planned · a run completed and the stock it moved.

- [ ] **ST12** `/apps/stock/what-matters-most` — "Not everything deserves the same attention"
      Owns **STOCK-13**.
      The argument: ABC without the acronym. The awkward case: cash tied up in things that have not moved in a year.
      Shots: the classification list · not-selling · cost to keep · the settings that drive it.

- [ ] **ST17** `/apps/stock/stock-reports` — "The same answer, every Monday, without asking"
      Owns **STOCK-18**.
      The argument: scheduled reports to an inbox beat a dashboard nobody opens.
      Shots: the report library · a report run · a schedule being set · the resulting email.

- [ ] **ST16** `/apps/stock/getting-your-stock-in` — "From a spreadsheet, without losing a week"
      Owns **STOCK-17, STOCK-19**.
      The argument: import with a preview of what it is about to do. The awkward case: buying in cases and selling in singles.
      Shots: import preview · the grid editor · units set up · your own columns.

### /apps/sell — the unmentioned ones

- [ ] **SE3** `/apps/sell/what-fits-what` — "It fits a 2019, not a 2020"
      Owns **SELL-06**.
      The argument: some products only make sense against something else — a vehicle, a machine, a model. The awkward case: a customer who knows their machine and not your part number.
      Shots: a compatibility tree · faceted search on the storefront side · bulk fitment assignment · the fitment panel on a product.

- [ ] **SE6** `/apps/sell/at-the-counter` — "Somebody is standing in front of you"
      Owns **SELL-09**.
      The argument: the counter sale is the same catalogue, the same stock, the same customer record. The awkward case: a walk-in who turns out to be an existing account.
      Shots: take-a-sale mid-sale · attaching a customer · the order it produced · stock moving as a result.

- [ ] **SE8b** `/apps/sell/money-on-account` — "Credit, and what happens to it"
      Owns **SELL-14**.
      The argument: a refund you keep, a goodwill gesture, a deposit. The awkward case: credit that outlives the reason for it.
      Shots: granting credit · the balance on a customer · it being spent · the ledger behind it.

- [ ] **SE10b** `/apps/sell/wishlists-and-waiting-lists` — "What people want that you have not got"
      Owns **SELL-17**.
      The argument: demand you can see is demand you can buy for. The awkward case: one unit arrives and four people are waiting.
      Shots: a wishlist · a waiting list · an offer being made · the offer accepted.

- [ ] **SE3b** `/apps/sell/your-own-kinds-of-product` — "Fields the software never heard of"
      Owns **SELL-03**.
      The argument: a product type carries the fields that matter to your trade. The awkward case: needing a field on some products and not others.
      Shots: a product type's fields · a product wearing them · the same fields filtering a list · the storefront showing one.

---

## Wave 2

### /apps/stock — the rest

- [ ] **ST1** `/apps/stock/what-you-have-and-where` — Owns **STOCK-01, STOCK-03**. Quantity per place, not one number. Awkward case: a cooler and a dry store are two different places to a florist. Shots: levels · locations · shelves · bin contents.
- [ ] **ST3** `/apps/stock/moving-it-between-places` — Owns **STOCK-04**. Awkward case: stock in transit belongs to neither end. Shots: a transfer · shipped · received · a discrepancy.
- [ ] **ST4** `/apps/stock/counting-it` — Owns **STOCK-06**. Awkward case: counting without closing. Shots: a count in progress · variances · approval · a counting schedule.
- [ ] **ST6** `/apps/stock/barcodes-and-labels` — Owns **STOCK-07**. Awkward case: two products, one barcode. Shots: the barcode list · a conflict · label printing · a label.
- [ ] **ST8** `/apps/stock/picking-and-packing` — Owns **STOCK-09**. Mobile required. Awkward case: the item is not on the shelf and the order still has to go. Shots: a pick walk · guided picking · a short pick · the pack bench.
- [ ] **ST9** `/apps/stock/when-you-run-out` — Owns **STOCK-10**. Awkward case: selling something that has not arrived, honestly. Shots: backorders · what is owed · preorders · the promise date.
- [ ] **ST11** `/apps/stock/knowing-what-to-order` — Owns **STOCK-12**. Awkward case: a number with no supplier behind it, said out loud rather than guessed. Shots: the reorder list · the explanation of one line · safety buffer · forecast.
- [ ] **ST13** `/apps/stock/what-it-cost-you` — Owns **STOCK-14**. Awkward case: the same item bought at three prices. Shots: cost layers · landed cost · cost vs plan · valuation as at a date.
- [ ] **ST14** `/apps/stock/checking-the-numbers` — Owns **STOCK-15**. Awkward case: the books and the shelf disagree and both are documented. Shots: reconciliation · integrity · shrinkage · an oversell incident.
- [ ] **ST15** `/apps/stock/stock-you-do-not-own` — Owns **STOCK-16**. Awkward case: consignment that must never be counted as an asset. Shots: ownership · non-owned list · unsettled · a settlement.

### /apps/sell — the rest

- [ ] **SE1** `/apps/sell/your-catalogue` — Owns **SELL-01, SELL-02**. Awkward case: sizes and colours that do not all exist. Shots: a product with variants · options · collections · categories.
- [ ] **SE2** `/apps/sell/bundles-and-gift-cards` — Owns **SELL-04, SELL-05**. Awkward case: a bundle whose parts have their own stock. Shots: a bundle · its stock effect · a gift card issued · redeemed.
- [ ] **SE4** `/apps/sell/built-to-order` — Owns **SELL-07**. Awkward case: a price that depends on choices. Shots: a template · the customer-side chooser · the resulting order · the build.
- [ ] **SE5** `/apps/sell/orders` — Owns **SELL-08, SELL-10**. Awkward case: an order from a channel you do not control. Shots: the order list · an order · carts · abandoned checkouts.
- [ ] **SE7** `/apps/sell/repeat-orders` — Owns **SELL-11**. Awkward case: somebody wants to skip one month, not cancel. Shots: a subscription · skipping an occurrence · changing the card · the stats.
- [ ] **SE8** `/apps/sell/prices-and-discounts` — Owns **SELL-12, SELL-13**. Awkward case: two discounts that could both apply. Shots: a price list · bulk breaks · a discount's rules · the resulting price.
- [ ] **SE9** `/apps/sell/returns` — Owns **SELL-15**. Awkward case: it came back damaged. Shots: a return request · inspection · received · refund issued.
- [ ] **SE10** `/apps/sell/reviews-and-questions` — Owns **SELL-16**. Awkward case: a bad review that is fair. Shots: the queue · moderating one · a reply · questions answered.
- [ ] **SE11** `/apps/sell/delivery-and-tax` — Owns **SELL-18, SELL-19**. Awkward case: one country, several tax treatments. Shots: zones · rates · a profile · an exemption.
- [ ] **SE12** `/apps/sell/getting-paid` — Owns **SELL-20**. Awkward case: a provider having a bad day. Shots: providers · one configured · health · a payment on an order.
- [ ] **SE13** `/apps/sell/selling-in-more-places` — Owns **SELL-21**. Awkward case: the same product listed differently per channel. Shots: channels · a product's listings · channel revenue · a comparison.
- [ ] **SE14** `/apps/sell/selling-to-businesses` — Owns **SELL-22**. Awkward case: one account that negotiated its own price on three items. Shots: a trade account · price tiers · an account override · the resolved price.
- [ ] **SE15** `/apps/sell/quotes-and-paying-on-terms` — Owns **SELL-25**. Awkward case: a customer at their credit limit mid-order. Shots: a quote · converted to an order · a credit limit · a hold.
- [ ] **SE16** `/apps/sell/wholesale-sign-off-and-invoicing` — Owns **SELL-26**. Awkward case: their buyer needs their manager. Shots: the approval queue · a rule · a wholesale invoice · marked paid.
- [ ] **SE17** `/apps/sell/selling-what-you-never-touch` — Owns **SELL-23**. Awkward case: the supplier is out and the customer is yours. Shots: a supplier catalogue · a markup rule · a routed order · the margin report.
- [ ] **SE18** `/apps/sell/what-sold` — Owns **SELL-24**. Shots: top products · revenue summary · channel comparison · conversion funnel.

### /apps/partners

- [ ] **B1** `/apps/partners/your-suppliers` — Owns **BUY-01**. Awkward case: two suppliers for one thing at different lead times. Shots: suppliers · one supplier · what they supply · lead times.
- [ ] **B2** `/apps/partners/purchase-orders` — Owns **BUY-02**. Awkward case: a line that arrives at a different price. Shots: a PO · lines · submitted · closed.
- [ ] **B3** `/apps/partners/who-can-spend-what` — Owns **BUY-03**. Awkward case: an urgent order above somebody's limit. Shots: spending limits · a PO waiting · sign-off · the audit trail.
- [ ] **B4** `/apps/partners/whats-on-its-way` — Owns **BUY-04, BUY-05**. Awkward case: a delivery that is late and a customer waiting on it. Shots: on the way · overdue · receiving · scan-to-receive.
- [ ] **B5** `/apps/partners/what-they-charged-you` — Owns **BUY-06, BUY-07**. Awkward case: the invoice does not match the order. Shots: a supplier bill · price variance · a return to supplier · credit.
- [ ] **B6** `/apps/partners/are-they-any-good` — Owns **BUY-08**. Awkward case: a cheap supplier who is never on time. Shots: scorecards · one supplier's record · on-time-in-full · the price ladder.

---

## Wave 3

### /apps/customers

- [ ] **CU1** `/apps/customers/the-record` — Owns **CUST-01, CUST-02**. Shots: a customer · the timeline · a company · its people.
- [ ] **CU2** `/apps/customers/your-own-kinds-of-record` — Owns **CUST-03, CUST-04**. Awkward case: a thing your trade has that no CRM ships. Shots: a record type · its fields · a record · a relationship.
- [ ] **CU3** `/apps/customers/groups-that-keep-themselves-current` — Owns **CUST-05**. Shots: a segment's rules · the preview count · members · history.
- [ ] **CU4** `/apps/customers/two-of-the-same-person` — Owns **CUST-06**. Awkward case: merging loses something. Shots: duplicates found · a comparison · a merge · bulk merge.
- [ ] **CU5** `/apps/customers/deals-and-pipelines` — Owns **CUST-07**. Shots: a pipeline · a deal · the funnel · win/loss by person.
- [ ] **CU6** `/apps/customers/what-you-said-you-would-do` — Owns **CUST-08**. Shots: today's tasks · a task on a record · overdue · completion.
- [ ] **CU7** `/apps/customers/support-requests` — Owns **CUST-09, CUST-10**. Awkward case: a promise you are about to break, before you break it. Shots: requests · one request · a response-time policy · a breach.
- [ ] **CU8** `/apps/customers/who-is-worth-calling` — Owns **CUST-11**. Awkward case: a score nobody trusts. Shots: a model · a score · its explanation · a recompute.
- [ ] **CU9** `/apps/customers/your-email-and-phone-in-here` — Owns **CUST-12, CUST-13**. Shots: connecting a mailbox · correspondence on a record · a phone system · a logged call.
- [ ] **CU10** `/apps/customers/let-them-book-you` — Owns **CUST-14**. Shots: a booking link · the chooser · the booking it made · on the calendar.
- [ ] **CU11** `/apps/customers/reports-and-dashboards` — Owns **CUST-15**. Shots: the report library · the builder · a report · a dashboard.

### /apps/messages

- [ ] **M1** `/apps/messages/sending-to-everyone` — Owns **MSG-01**. Shots: a broadcast · the audience · scheduled · results.
- [ ] **M2** `/apps/messages/sequences` — Owns **MSG-02**. Awkward case: somebody who replies mid-sequence. Shots: a sequence · its steps · enrolled people · one person's position.
- [ ] **M3** `/apps/messages/making-sure-it-arrives` — Owns **MSG-03, MSG-04**. Awkward case: the DNS records, done for you and explained anyway. Shots: adding a sending address · verification · the suppression list · a bounce landing on it.
- [ ] **M4** `/apps/messages/writing-it-once` — Owns **MSG-05**. Shots: a template · merge fields · saved paragraphs · one in use.
- [ ] **M5** `/apps/messages/how-it-performed` — Owns **MSG-06**. Shots: stats · opens and clicks · revenue attributed · a comparison.
- [ ] **M6** `/apps/messages/live-chat` — Owns **MSG-07**. Shots: the inbox · a conversation · quick replies · volume.

### /apps/bookings

- [ ] **BK1** `/apps/bookings/your-calendar` — Owns **BOOK-01, BOOK-02**. Awkward case: your dentist appointment has to block a slot. Shots: the calendar · a booking · a linked calendar · the block it creates.
- [ ] **BK2** `/apps/bookings/what-you-offer` — Owns **BOOK-03, BOOK-04**. Awkward case: a job that needs a person **and** a room. Shots: services · a service · people and equipment · places.
- [ ] **BK3** `/apps/bookings/when-you-are-free` — Owns **BOOK-05**. Awkward case: the exceptions are the real work. Shots: hours · an exception · the resulting availability · what a customer sees.
- [ ] **BK4** `/apps/bookings/the-rules` — Owns **BOOK-06**. Awkward case: a late cancellation, and a deposit you actually keep. Shots: a policy · a deposit · a cancellation inside the window · outside it.
- [ ] **BK5** `/apps/bookings/repeats-and-waiting-lists` — Owns **BOOK-07, BOOK-08**. Shots: a series · changing one occurrence · the waiting list · an offer.
- [ ] **BK6** `/apps/bookings/the-day-itself` — Owns **BOOK-09**. Shots: today · check-in · completion · a no-show.

### /apps/invoices

- [ ] **I1** `/apps/invoices/writing-one` — Owns **MONEY-01**. Shots: a new invoice · lines · terms and tax · the preview.
- [ ] **I2** `/apps/invoices/before-it-goes-out` — Owns **MONEY-02**. Awkward case: two people must agree before a customer sees it. Shots: a workflow · an invoice waiting · sign-off · a signature request.
- [ ] **I3** `/apps/invoices/how-it-looks` — Owns **MONEY-03**. Shots: templates · editing one · the printed sheet · the default set.
- [ ] **I4** `/apps/invoices/who-has-paid` — Owns **MONEY-04**. Awkward case: a part payment. Shots: the list by state · recording a payment · what is still owed · a write-off.

### /apps/money

- [ ] **MO1** `/apps/money/what-came-in` — Owns **MONEY-05**. Awkward case: one deposit covering eleven orders. Shots: payments · payouts · a deposit opened · the orders behind it.
- [ ] **MO2** `/apps/money/what-went-out` — Owns **MONEY-06**. Shots: spending · a cost · bills to pay · repeating costs.
- [ ] **MO3** `/apps/money/did-we-make-money` — Owns **MONEY-07**. Awkward case: profit on one job, not the month. Shots: profit · by job · one job opened · the costs on it.
- [ ] **MO4** `/apps/money/where-it-comes-from` — Owns **MONEY-08**. Shots: channels · traffic sources · a comparison · top customers.
- [ ] **MO5** `/apps/money/your-accountant` — Owns **MONEY-09**. Awkward case: giving somebody read-only access to the money and nothing else. Shots: categories · the accounting connection · reconciliation · the `viewer` role.

---

## Wave 4

### /apps/site

- [ ] **S1** `/apps/site/building-pages` — Owns **SITE-01, SITE-02**. Shots: the canvas · adding a piece · reordering · a saved piece reused.
- [ ] **S2** `/apps/site/look-and-feel` — Owns **SITE-03, SITE-04**. Awkward case: one colour change, everywhere, without hunting. Shots: theme tokens · the change propagating · the header · the footer.
- [ ] **S3** `/apps/site/starting-from-a-blueprint` — Owns **SITE-05**. Awkward case: what a blueprint does **not** overwrite. Shots: the gallery · a blueprint · installing it · the result.
- [ ] **S4** `/apps/site/publishing` — Owns **SITE-06, SITE-07, SITE-08**. Awkward case: publishing something broken, and getting back. Shots: preview · pre-publish checks with a gap · publish · history and a rollback.
- [ ] **S5** `/apps/site/more-than-one-site` — Owns **SITE-09, SITE-13**. Awkward case: two unrelated businesses, one owner. Shots: the sites list · switching · a second site's identity · per-site page results.
- [ ] **S6** `/apps/site/your-web-address` — Owns **SITE-10**. Awkward case: a domain bought somewhere else. Shots: domains · adding one · the DNS records · verified with a certificate.
- [ ] **S7** `/apps/site/forms-and-what-people-send-you` — Owns **SITE-11**. Shots: a form on a page · the submissions list · one submission · it becoming a customer.
- [ ] **S8** `/apps/site/designing-email` — Owns **SITE-12**. Awkward case: email clients ignore half of what a browser does. Shots: the email builder · a template · the preview · the sent result.

### /apps/content

- [ ] **C1** `/apps/content/giving-content-a-shape` — Owns **CONT-01, CONT-07**. Awkward case: a kind of thing you publish that is not an article. Shots: a content type · its fields · tags and topics · a listing page.
- [ ] **C2** `/apps/content/writing-and-publishing` — Owns **CONT-02, CONT-03, CONT-04, CONT-06**. Awkward case: a mistake published on a Friday. Shots: the editor · revisions · restoring one · scheduled, with an author.
- [ ] **C3** `/apps/content/media` — Owns **CONT-05**. Shots: the library · an upload · alt text · reuse across pages.
- [ ] **C4** `/apps/content/other-languages` — Owns **CONT-08**. Shots: translations · one entry in two languages · a product's fields · what a visitor sees.
- [ ] **C5** `/apps/content/moving-a-url` — Owns **CONT-09**. Awkward case: a rebuild that would have lost your rankings. Shots: redirects · adding one · a bulk import · the result.
- [ ] **C6** `/apps/content/the-pages-the-law-wants` — Owns **CONT-10**. Shots: legal pages · the checklist · one generated · on the site.
- [ ] **C7** `/apps/content/using-it-somewhere-else` — Owns **CONT-11**. Awkward case: content that has to reach a screen we did not build. Shots: webhooks · one configured · a delivery · the payload.

### /apps/get-found

- [ ] **F1** `/apps/get-found/how-you-are-doing-in-search` — Owns **FIND-01, FIND-03**. Shots: performance · queries · the Search Console link · a page's numbers.
- [ ] **F2** `/apps/get-found/site-checks` — Owns **FIND-02**. Awkward case: a problem named specifically, on a specific page. Shots: the checks list · one page's check · a fix · re-run.
- [ ] **F3** `/apps/get-found/posting-to-social` — Owns **FIND-04, FIND-05, FIND-06, FIND-07**. Awkward case: posting the same thing eight times, and stopping. Shots: the composer with targets · the calendar · slots and cadence · the approval queue.
- [ ] **F4** `/apps/get-found/the-social-inbox` — Owns **FIND-08**. Shots: the inbox · a thread · a reply · statuses.
- [ ] **F5** `/apps/get-found/what-worked` — Owns **FIND-09**. Shots: insights · per-post metrics · best time to post · a comparison.

### /apps/team

- [ ] **T1** `/apps/team/adding-somebody` — Owns **TEAM-01**. Shots: inviting · the invite they get · accepting · them in the list.
- [ ] **T2** `/apps/team/who-can-see-what` — Owns **TEAM-02**. Awkward case: a casual warehouse worker who must not see cost. Shots: the roles list with their limits · assigning one · the `scanner` view · what it cannot reach.
- [ ] **T3** `/apps/team/hours-and-time-off` — Owns **TEAM-03**. Shots: timesheets · the schedule · time off requested · approved.
- [ ] **T4** `/apps/team/tickets-and-licences` — Owns **TEAM-04**. Awkward case: a licence that lapsed and nobody noticed. Shots: certifications · one person's · an expiry warning · the reminder.
- [ ] **T5** `/apps/team/keeping-the-account-safe` — Owns **TEAM-05**. Shots: security · two-factor being set up · backup codes · active sessions.

### /apps/automations

- [ ] **A1** `/apps/automations/building-one` — Owns **AUTO-01**. Awkward case: "unless", which is where most automations go wrong. Shots: the canvas · a trigger · a condition and a branch · an action configured.
- [ ] **A2** `/apps/automations/ready-made-ones` — Owns **AUTO-02**. Shots: the gallery · a recipe · adopting it · the copy you can edit.
- [ ] **A3** `/apps/automations/what-it-actually-did` — Owns **AUTO-03**. Awkward case: an automation that ran and did nothing useful. Shots: runs · one run step by step · a failure · the reports.

### /apps/connections

- [ ] **N1** `/apps/connections/other-tools` — Owns **AUTO-04**. Shots: the catalogue · connecting one · its settings · it working.
- [ ] **N2** `/apps/connections/your-own-ai-key` — Owns **AUTO-05**. The argument: **we never run AI on our credential.** Shots: providers · adding a key · usage · the cost, which is theirs.
- [ ] **N3** `/apps/connections/telling-it-how-to-behave` — Owns **AUTO-06, AUTO-07**. Awkward case: an assistant that can read everything and change nothing. Shots: instructions · an instruction being edited · the permission matrix · a tool switched off.
- [ ] **N4** `/apps/connections/your-own-ai-client` — Owns **AUTO-08**. Awkward case: the jargon is unavoidable here, and this is the advanced context where it is allowed. Shots: the MCP endpoint · a client connected · a question answered from real data · the permissions that bounded it.

### /apps/home

- [ ] **H1** `/apps/home/what-needs-you-today` — Owns **PLAT-16, PLAT-17, PLAT-09, PLAT-10**. Awkward case: a product that notifies you about everything is a product you mute. Shots: Home's signals · Pulse · notification routing · a job running in the status bar.

### Commercial

- [ ] **PR1** `/pricing/what-you-get` — Owns **COMM-01**. Extends the existing `/pricing`. The argument: no tiers, and why that is a decision rather than a simplification.
- [ ] **PR2** `/pricing/what-counts-against-it` — Owns **COMM-02, COMM-03, COMM-04**. Awkward case: hitting a limit mid-task. The rule to state plainly: **the thing in flight finishes, and nothing already made is taken away.** Shots: the meters · a warning before it bites · the one-tap expansion with the price on it · reducing again.
- [ ] **PR3** `/how-it-works/getting-in` — Owns **COMM-05, COMM-06**. Awkward case: three domains, one login, and why that is not a hoop. Shots: signup · the "what do you do" step · the rail preview matching the result · landing in the console.
- [ ] **PR4** `/tools` — Owns **COMM-07**. **Already built** — seventeen tools live. Needs only the index to say what they are for and to link into the articles they touch. Mark `[x]` when that pass is done.

---

## Verification

Before any article is `[x]`, all of [README.md](README.md)'s six conditions hold.
Before the programme is done, all three of these are true and provable:

```
node scripts/check-feature-coverage.mjs     # 0 orphans, 0 double-owned, shots in registry
grep -c 'topical\|none' docs/marketing/FEATURES.md   # 0
grep -c '^- \[ \]' docs/marketing/ARTICLES.md        # 0
```

The middle one is the real test. A hundred and fourteen pages that ship without
moving a single row out of `topical` would mean we wrote a longer version of the
same site.
