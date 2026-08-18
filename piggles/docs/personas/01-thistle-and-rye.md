# P01 — Marisol Vega · Thistle & Rye

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Food & drink (`food`) · **Rail groups:** web · sell · money

## Account

Fill in during the run.

| Field         | Value                      |
| ------------- | -------------------------- |
| Email         | `p01.marisol@piggles.test` |
| Tenant id     | —                          |
| Subdomain     | —                          |
| Published URL | —                          |

## The person

Marisol Vega, 34, she/her. Baked for someone else for nine years and opened her
own place eleven months ago. Runs the shop with one part-time counter assistant.

She is comfortable with a phone and impatient with software. She has a Square
terminal, an Instagram account with 2,300 followers, and a website a cousin built
in 2023 that she cannot edit and is embarrassed by. She has never used a CRM, has
never heard the word "SKU", and if a screen asks her to configure anything before
it shows her something, she will close the tab and go back to the oven.

**What made her look:** three people in one week asked whether she takes orders
online for collection, and she had to say no.

## The business

**Thistle & Rye** — a bakery and small counter café. One shop, six days a week
(closed Mondays), 07:00–14:00 or until it sells out.

- Sells over the counter, and wants **collection orders paid in advance**
- Takes **celebration cake** orders — a conversation, a deposit, a date
- Supplies **two local cafés** with loaves weekly, invoiced monthly
- No delivery, no shipping, no second location

## Why she is here today

Three jobs, in her words:

1. "A website that looks like the shop and that I can change myself."
2. "People order the bread the night before and pick it up."
3. "Stop chasing the two cafés for money on WhatsApp."

## Onboarding answers

Type these exactly.

| Question       | Answer                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| Business name  | `Thistle & Rye`                                                               |
| Trade          | Food & drink                                                                  |
| What do you do | I need a website · I sell things · I invoice people                           |
| Look           | Whatever the trade shelf offers first that is not the showcase — record which |

The ampersand is deliberate. It travels through the tenant name, the site name,
the subdomain slug, the page title, the OG image and the invoice header, and each
of those is a place it can come back as `&amp;`.

## The data

### Products — the counter

| Name                              | Price  | Notes                                  |
| --------------------------------- | ------ | -------------------------------------- |
| Country sourdough, whole loaf     | $8.50  | daily                                  |
| Country sourdough, half loaf      | $4.75  | daily                                  |
| Seeded rye                        | $9.00  | Tue/Thu/Sat only                       |
| Cardamom buns, box of six         | $16.00 | weekends                               |
| Morning bun                       | $4.25  | single                                 |
| Butter croissant                  | $4.00  | single                                 |
| Ham, gruyère and mustard baguette | $11.50 | lunch, limited daily quantity of 24    |
| Drip coffee, 12oz                 | $3.50  | counter only, not for collection order |

### Products — made to order

| Name                                            | Price   | Notes                             |
| ----------------------------------------------- | ------- | --------------------------------- |
| Celebration cake, 8" — two layers, buttercream  | $95.00  | needs 5 days' notice, $30 deposit |
| Celebration cake, 10" — two layers, buttercream | $135.00 | needs 5 days' notice, $30 deposit |

### Wholesale customers

| Business           | Contact        | Email                       | Terms  |
| ------------------ | -------------- | --------------------------- | ------ |
| Ferrous Coffee Bar | Dane Whitlock  | `dane@ferrouscoffee.test`   | Net 14 |
| The Reading Room   | Ines Marchetti | `ines@readingroomcafe.test` | Net 14 |

Weekly standing order, invoiced at month end: 12 × whole sourdough, 6 × seeded
rye, per café, per week.

### Content she wants on the site

- **About** — she trained in Lyon, the starter is called Agnes and is six years
  old, the flour is milled 40 miles away
- **What we bake** — the weekly bake schedule as an actual table
- **Collection orders** — how it works, cut-off is 8pm the night before
- **Find us** — 114 Mercer Lane, opening hours, the fact that Monday is closed

## The run

### Act 1 — Discover, and sign up

Start at `http://localhost:3020` as a stranger. Read the homepage the way she
would: does it tell a bakery owner that this is for her within one screen? Follow
a real call to action into signup — do not type the signup URL.

**Done when:** the account exists and she has been carried to onboarding without
having chosen a plan, entered a card, or read the word "module".

### Act 2 — Onboarding

Answer as above. Watch the rail preview change as boxes are ticked, and read the
sentence that claims everything is included either way.

**Done when:** "Setting things up" completes and the browser lands in the console
on `mypiggles`, signed in, without a second sign-in.

### Act 3 — What did she actually get? (the deep spine check)

**This is P01's job for the whole roster.** Verify in the database, not by
inference:

```sql
select id, name, platform_brand, is_system from tenants where name = 'Thistle & Rye';
select key, value from tenant_settings where tenant_id = '…';   -- modules, industry, onboarding.story, piggles.railGroups
select name, subdomain from properties where tenant_id = '…';
select count(*) from products where tenant_id = '…';
select count(*) from crm_pipelines where tenant_id = '…';
```

- `platform_brand = 'piggles'`, `is_system = false`
- the subdomain is on **`piggles.site`**, never `sparx.zone`
- **all fifteen modules read as on** — every app, regardless of what was ticked
- `settings.industry = 'food'`
- the CRM has a **pipeline** (its absence silently empties the Deals board)
- the food pack's sample rows are there, and the chosen template's pages exist
- the primary site is named **Thistle & Rye**, not "Marisol's workspace"

**Done when:** each of the above is confirmed or filed. Anything not checked is
written down as not checked.

### Act 4 — First impressions of the console

Before touching anything: read Home as she would. Does it greet her, say
something true, and offer a next step? Open the rail. Are the fifteen apps
present, named in her words, and does anything on screen name a product she
cannot buy?

Open **All apps** from the rail footer and confirm the flat-plan sentence.

**Done when:** every rail app has been opened once and the panel read.

### Act 5 — Deal with the sample data

The furnish filled her account with a stranger's products. Decide as she would:
does she understand what it is, and can she clear it? Find the control. If
clearing loses something she typed, that is a blocker.

**Done when:** the catalogue is hers, and how you got there is recorded.

### Act 6 — The catalogue

Add all ten products above through the UI. Real prices, real descriptions in her
voice, at least three with a photo. Set the baguette's daily quantity to 24, and
make the two cakes require notice and carry a deposit.

Watch for: the money field's currency symbol, the code/SKU field appearing before
she has typed anything, whether a product can exist without a photo, and what a
description longer than two lines does to the list.

**Done when:** ten products exist, priced, described, and visible in the list.

### Act 7 — The site

Open My Site. Replace the template's words with hers across all four pages, put
the real address and hours on Find us, and get the products onto a page a
customer can order from. Change the look to something bakery-ish — warm, not
pink-by-default — and check the header and footer are hers.

**Done when:** four real pages, no template placeholder text anywhere, published.

### Act 8 — Be the customer

Open the **published site** in a clean browser at the tenant's real URL. Not the
preview pane. Then:

1. Read it on a phone width (390px, in an iframe).
2. Order two sourdough loaves and a box of buns for collection tomorrow.
3. Pay (test card).
4. Get to the end and see confirmation.

**Done when:** the order exists on the site side and the money is right including
tax, or the exact point it broke is filed.

### Act 9 — The order, from behind the counter

Back in the console: the new order is in Sell, the customer exists in Customers,
and marking it collected does what she expects. Check that the first-run
checklist noticed.

**Done when:** the order is fulfilled and its state is right in both places.

### Act 10 — The two cafés

Add both wholesale customers. Raise a month-end invoice to Ferrous Coffee Bar for
four weeks of the standing order — 48 sourdough, 24 rye — on Net 14. Send it.
Record a partial payment of $200. Then look at Money and see whether it tells her
what she is owed.

**Done when:** the invoice is correct to the cent, its balance is right after the
partial payment, and Money reflects both.

### Act 11 — A day in the life

Small things she would actually do, in one sitting:

- Mark the seeded rye out of stock for today and confirm the site says so
- Change Monday's hours note, publish, and see it live
- Write the "Collection orders" page and publish it
- Search for "Ferrous" in the top bar and land somewhere useful
- Open the console on a 390px phone width and do one real job on it

**Done when:** each is done or filed.

## What only this persona proves

The spine, in depth: signup → onboarding → furnish → handoff → first run,
confirmed in the database rather than inferred. Every later persona trusts this
act 3 and only reports what differs.

Also: the `food` pack and starter, an ampersand in a business name, a
made-to-order product with a deposit, and a bakery's actual mixed business — walk
in, order ahead, wholesale on terms.

## Verification

| Check                                                    | Result |
| -------------------------------------------------------- | ------ |
| Tenant is `piggles`, non-system, on `piggles.site`       | —      |
| Fifteen modules on, industry `food`, pipeline present    | —      |
| Site named for the business, ampersand intact everywhere | —      |
| Ten products, priced and described, live on the site     | —      |
| A stranger completed a paid collection order             | —      |
| Wholesale invoice correct, partial payment reflected     | —      |
| Published site holds at 390px                            | —      |
| Console usable at 390px for one real job                 | —      |
| Nothing on any screen names a sparx product              | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
