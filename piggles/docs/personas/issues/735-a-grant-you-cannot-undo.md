# 735 — A grant you cannot undo, and a picker that cannot tell two people apart

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 262
**Surface:** mypiggles + sparx workbench — Credit on account / Account credit
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: granted, over-took, took back, and read every sentence
**Blocked on:** —

Four separate faults on one pane, three of them found by trying to do the one
thing the pane exists for: put money on a customer's account.

## 1. A failed search reads as "you have no customer by that name"

Opening **Grant credit** and typing `mar` to find Marguerite Adeyemi. The panel
said **"No customer matches that. Try a different word."** Juniper Row has
Marguerite Adeyemi, Odile Marchetti and Marisol Vega.

**MEASURED 2026-09-19:** seventeen requests to `/v1/crm/customers` returned
**503** while the panel said that, four times, about four different spellings.
Nothing on screen suggested the server had been asked and had not answered.

```
GET /v1/crm/customers?q=mar&take=20    503
GET /v1/crm/customers?q=marg&take=20   503
```

The finder read `data` and `isFetching` and nothing else, so a search the
server never answered fell through to the empty branch. The empty branch makes
a claim about the shop's customer list at the moment the shop's customer list
was not consulted, and it blames the typing: "try a different word" sends her to
re-type a name that was right.

**The card three inches below it gets this right.** "Could not load balances /
Something went wrong reaching the server" — same file, same pane, same query
library. [[feedback_a_fix_leaves_its_neighbour_behind]]
[[feedback_one_outcome_two_causes]]

Fixed: `pickerState` names five moods, `failed` first, and the failed one
renders an `error` Alert rather than a line of text — an outage is not a
finding about the list.

## 2. Two customers called Priya Anand, and no way to tell them apart

Typing `Priya` returns three rows. Two of them read **Priya Anand**. One shows
an email; the other shows a blank space, because the picker rendered the name
and `customer.email` and nothing else.

A blank does not read as "the screen cannot identify this person". It reads as
a tidy row. Then money goes on the guess, onto an account the customer may
never see.

**And the third row was wrong too.** Priya Nandakumar buys for **Loom & Larder**,
which the picker never showed, because:

```
/v1/commerce/account-credit   →  customer: { …, company: r.customer.companyName }   renamed
/v1/crm/customers             →  whole Customer rows                                 companyName
```

Both feed the same `CustomerLite`, which declares `company`. One endpoint was
taught the rename and the other was not, so `customerName`'s company fallback
was **dead on every search result** and a trade buyer with no first name on file
would have read as "A customer".

Fixed: the search maps the wire row to `CustomerLite` in one place, so the pane
is handed one shape whichever endpoint filled it. `phone` and `createdAt` come
with it — both were already down the wire and dropped.
[[feedback_fetched_but_never_rendered]]

`whichPerson` now writes a second line that is never blank: company, email,
phone, or **"No email or phone yet, added Aug 24, 2026"**. On screen the three
Priyas now read as three different people.

## 3. A grant was permanent

**There was no way to take store credit back.** Not reduced, not corrected, not
by any screen in the console. `GrantAccountCreditInput.amountCents` is
`.refine((v) => v > 0)`, the only two endpoints are `grant` and the ledger read,
and grep found no third anywhere.

So: type `1850` where you meant `18.50` and the customer holds **$1,850** of
your money. The only way it ever comes off is if they spend it.

**The ledger always expected this.** `deltaCents` is signed, `AccountCreditReason`
has carried `adjust` since the schema shipped, and the history list on this very
pane has drawn `entry.deltaCents >= 0 ? '+' : '−'` from the start. Every part of
the design anticipated a line going the other way; nothing could write one.

The pane's own header says credit is "never reduced by typing over a number",
and that is right and is kept: this is not an editable balance. It is an
audited, noted, reversible ledger line, which is the thing that comment was
protecting.

Built:

- `TakeBackAccountCreditInput` — a POSITIVE amount meaning "remove this much".
  Its own input rather than a negative `grant`, because giving money away and
  correcting a mistake are two intentions with two audit actions, and on a field
  whose meaning flips with one leading character a sign is far too easy to send
  by accident.
- `takeBackAccountCredit` — writes the negative ledger line with reason
  `adjust`, audits `commerce.accountcredit.takenback`, publishes
  `accountcredit.taken_back` (registered in `EventType`, `CommerceTopic` and the
  terraform topic map, so it is not a silent publish failure).
- It **REFUSES** rather than clamping when the amount is more than the balance,
  and the refusal names the balance. Quietly taking a smaller number and
  reporting success would leave her believing the number she typed is the number
  that happened. [[feedback_honor_the_users_choice]]
- **Take some back instead** on the form's heading row, which swaps the same
  three fields to the other direction, clears them so a number typed for one
  purpose never sits under the button that does the other, and puts a `danger`
  button on it. It is the one control on the pane that takes something away from
  a customer who may already be counting on it.
- The same refusal BEFORE the press: "That is more than $18.50, which is all
  they hold." Learning it from a round trip is learning it from the wrong place.

## 4. The toast never said how much

"Store credit added." Nothing else. Both endpoints answer with
`newBalanceCents` and the pane discarded it (`onSuccess: (_result, input)`), so
the only confirmation of an amount she had just typed was the word "added" —
and an amount is the one thing worth reading back after typing one. It is also
the fault that makes fault 3 expensive.

Now: **"$40.00 for Priya Nandakumar. Their balance is now $40.00."**

## Checked and NOT a defect

**The balances table holds 360px.** MEASURED: 327px of table in a 329px
scrollport, overflow 0. The Email column is already `hidden @md:table-cell`.

**The negative ledger badge is grey.** `entry.deltaCents >= 0 ? 'success' :
'neutral'`. Grey means nothing and the minus sign is already carrying the
direction, so this is a RULE #4 call site — it joins the 585 piggles instances
waiting on Brandon rather than being repainted here on a guess.

**Every grant is USD.** `onPick` hardcodes `currency: 'USD'`. Juniper Row's
sixteen orders are all USD and the tenant has no second currency, so nothing is
wrong on this screen today. Filed as latent, not fixed: picking a currency is a
control the pane would need a reason to grow.

## Files

- `wizeworks/packages/commerce-schemas/src/discounts.ts`
- `wizeworks/packages/commerce/src/services/discount-service.ts`
- `wizeworks/packages/commerce/src/events.ts`
- `wizeworks/packages/events/src/types.ts`
- `terraform/envs/prod/main.tf`
- `wizeworks/packages/commerce/src/mcp/write-tools.ts` — `take_back_account_credit`
- `wizeworks/services/api-rest/src/routes/v1/commerce/pricing.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/account-credit-words.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/account-credit-words.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/account-credit-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/account-credit.tsx`

## Proof

On screen, in Juniper Row's own console:

1. Pressed **Grant credit** and typed without touching the box. The words
   landed: the panel focuses its one field now. Before this, the first word
   typed went nowhere.
2. Typed `Priya`. Three rows, three different people: **Loom & Larder ·
   priya@loomandlarder.co.uk**, **priya.anand@example.com**, and **No email or
   phone yet, added Aug 24, 2026**.
3. Typed `Loom`. Found Priya Nandakumar by the shop she buys for.
4. Granted $40.00. Toast: **"Store credit added — $40.00 for Priya Nandakumar.
   Their balance is now $40.00."**
5. On Wren Ashcombe's $18.50, pressed **Take some back instead** and typed
   `50.00`. "That is more than $18.50, which is all they hold." Button disabled.
6. Typed `3.50` with a note. Balance $18.50 → **$15.00**, history gained
   **Adjusted by hand · −$3.50 · "Typed one digit too many the first time. This
   puts it right."**, and the help line re-read "They hold $15.00."

Both console typechecks, the commerce package, api-rest and ESLint all clean.
Piggles 1,036 tests / 114 files, sparx 906 / 101, commerce 221 / 21. All three
event checks pass with the new topic provisioned. The new pure module was proved
red by breaking what it guards: two deliberate breaks reddened exactly three
tests.
