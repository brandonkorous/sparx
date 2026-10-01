# 914: The database talking, on the deal and in search

**Status:** fixed
**Severity:** **major**: one keystroke made a $1,200 deal worth $1,200,001.25,
and a business with more than 100 customers could not link the rest to a deal.
The other parts are copy.
**Found by:** P03 · Juniper Row · act 322
**Surface:** `crm.deal.detail` (Deal), the search box, `crm.segment.detail`
(Group of customers), and every money box, both consoles; the search index in
`wizeworks/packages/commerce`
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen as Devi; tests listed under each part

## What happened

Devi reopened her deal, "Thornbury spring linen order", to change its value
from $1,200 to $1,250. Then she searched for a few things she had made. Each
step turned up one more place where the screen said the database's words, or
did something with a number she did not ask for.

1. **The Value box was a plain number box.** It showed "1200", not "1200.00",
   and a number box hands back nothing for "1,250" or "$1,200", which saved as
   a deal worth $0.
2. **Clicking into a money box dropped the cursor inside the old amount.**
   She clicked the Value box, typed 1,250 and left it. The box read
   **1200001.25**. This was `MoneyTextInput`, the money box 46 screens use.
   Its two siblings select the old amount on click (issues 169 and 205); this
   one never did.
3. **The Customer list held the first 100 customers.** A business with more
   could not link the rest. It was a plain list, so it could not be searched
   either.
4. **Every search picker said "No customer matches that" while it was still
   looking.** The box waits a quarter second after each key before it asks the
   server. During that wait it reported nobody, even for Ravi, who is there.
   Same in the record picker, the bookings picker and the expense screen.
5. **"Companie".** The badge on a linked company cut the last "s" off the
   heading "Companies". "People" stayed "People".
6. **The search box's second lines were codes.** A group read
   **email-engaged**, a collection **high-jewellery**, an order
   **Tamsin Vale · placed**, a return **account_credit**, a task **high**, a
   picture **image/jpeg**.
7. **"Take a sale" twice.** Search for it and two rows came back that open the
   same till. This came from issue 904: the `+` on Orders is "Take a sale", and
   so is the till screen itself.
8. **Search headings in the platform's words.** "Segments" above records that
   live on Groups of customers; "Requests" above Help requests; nine more like
   them. Opening a group, the pane said "segment" 20 times under a tab that
   said "VIP customers", and "Archive" where its own list says "Put away".
9. **"Stage" on four tables, in a console that says Step.** Help requests, a
   company's deals and requests, and a customer's deals.
10. **"Standard Support".** The starter reply-time promise is named in title
    case after a help-desk product. Every request reads "Measured against
    'Standard Support'".
11. **Three group descriptions with an em dash**, saved into 39 accounts by an
    older version of the presets. The source was fixed long ago; a preset runs
    once, so the rows never were.

## Why it matters

Parts 1 and 2 put a wrong amount on a deal with no warning, and part 2 reached
every screen with a money box that opens holding an amount. Part 3 stopped work
outright for a bigger business. The rest are a console telling a business owner
something in words she does not use, or something untrue ("nobody matches").

## The fix

1. Value is a `MoneyTextInput`. It opens settled ("1200.00") through
   `moneyText`, reads "$1,200" and "1,250" with `readMoney`, and refuses what it
   cannot read with the same sentence as every other money box.
   `surfaces/crm/deal-detail.tsx`, both consoles.
2. `MoneyTextInput` selects its text on focus.
   `components/money-input.tsx`, both consoles. Guard:
   `components/money-focus.test.ts` reads all three money boxes and fails if
   any of them does not select on focus. Removing the new `onFocus` reddens it.
3. Customer is the `CustomerPicker` every other form uses, which searches the
   whole list on the server. Picking a person who buys for a business fills in
   Company when the deal has none.
4. Each picker counts "the box has not asked about this yet" as searching:
   `searching={search.isFetching || term !== query}`. Measured in the browser:
   "Searching…" for the first 200ms, then the list; never "No customer
   matches". `invoicing/customer-picker.tsx`,
   `scheduling/bookings-customer-picker.tsx`, `crm/record-picker.tsx`,
   `finance/expense-detail.tsx`, both consoles.
5. `objectSingular()` in `crm/associations-data.ts`: Person, Company, Deal,
   Request. Test: `associations-data.test.ts`, red when the old cut-the-s rule
   is put back.
6. `wizeworks/packages/commerce/src/search-words.ts` turns each stored code
   into words, and `universal-projection.ts` uses it: a group shows its own
   description (or "Fills itself from rules" / "Picked by hand"), a collection
   its kind, a return "Wants a refund", a task "High priority", a picture
   "Image", an invoice "Partly paid", a category nothing. The slug or handle
   stays a keyword, so it still finds the record. Orders are drawn in the
   console, so `orderStatusWords()` in `orders-list-filters.ts` hands search
   the list's own chip words: To pack, Packed, They have it, Canceled. Tests:
   `search-words.test.ts` (red when any code leaks through) and
   `orders-list-filters.test.ts`.
7. `createActions` skips a `+` when a listed screen already has that name and
   opens the same place. Test in `launcher-create.test.ts`, red without it.
8. Piggles' adapter has `entityLabels` now (`lib/product.ts`), filled from
   `PIGGLES_ENTITY_LABELS` in `lib/console/vocabulary.ts`, and the search box
   reads it first. The group pane is named "Group of customers", its `+` "New
   customer group" (what the list's own button says), and its 20 sentences say
   "group" and "put away". Naming the pane switched on `check:screen-names`,
   which found every one of those sentences. Test:
   `lib/console/entity-labels.test.ts`, red when a key names no real record
   kind.
9. "Step" on all four tables, and the ticket pane's "the next step". Piggles
   only; sparx keeps Stage.
10. The starter is "Usual hours" now, in
    `crm-schemas/src/builtins/tickets.ts` and the sample data that copies it.
    Nothing finds a policy by name, so a business that already has one keeps
    its own.
11. Migration `20270526000000_saved_groups_lose_their_em_dash` refreshes the
    three old descriptions where the row still holds the exact old text, one
    tenant at a time under RLS. Local: 39 rows, 0 left.

Also found while checking: `check:day-boxes` failed on the date box added to
Who is worth chasing in issue 908. It is the shared `DayInput` now.

## Confirmed by

> Re-ran P03 act 322 on Juniper Row. Clicked the deal's Value box and typed
> "1,250": it read 1250.00, and saved as 1250.00 in the database. Typed
> "$1,200" and saved: 1200.00. Typed "Ra" in Customer: "Searching…", then Ravi
> Naidoo and three more. The linked company's badge reads **Company**. In
> search: "take a sale" gives one row; "tamsin" shows her orders as To pack,
> Packed, They have it; "jewellery" shows the collection as Picked by hand;
> "vip" shows **Groups of customers** › VIP customers with its description.
> Opened that group: "In this group now", "Put this group away", and the
> description with a colon.

## After this ships

Search documents keep their old second lines until they are rebuilt. A SQL
change and a code change both raise no event. Run **ops.yml →
reindex-search** with apply ticked, once, after the release.

## Rating effect

Deal, Groups of customers and Help requests: notes added, scores unchanged.
