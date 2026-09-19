# 666 — The spending limit nobody could set

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 237
**Surface:** Stock — Sign-offs, Spending limits, and a purchase order's own pane
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 237 (a limit set, an order held, turned down, amended, held again, signed off)

## What she did

Devi had just committed $288.00 to Ashcombe Mills with nobody looking at it
([665](665-it-let-me-order-the-same-twelve-shirts-twice.md)), so she opened
**Sign-offs**. It was empty, and honest about why:

> **No order can be held for sign-off**
> You have not set a spending limit, so every order goes straight to the supplier
> however large it is. Set one under Spending limits and any order over it waits
> here for your yes.

So she went to **Spending limits**, pressed **Set a limit**, named it, typed
**200**, chose **The owner** as the approver, left the supplier and location on
their defaults, and pressed **Set the limit**.

> **Could not save that limit**
> Nothing was changed. Please try again. The problem is with Supplier id and
> Warehouse id.

She had not touched either field. They read "Any supplier" and "Any location" —
the values the form opens on, the values its own help text explains at length.

## The form's default state was the one it refused

`CreatePoApprovalRuleInput` took `supplierId: Uuid.optional()`. Not nullable. A
blank `<select>` meaning "no narrowing" sends **null**, not a missing key, and
the form does exactly that:

```ts
supplierId: draft.supplierId === '' ? null : draft.supplierId,
warehouseId: draft.warehouseId === '' ? null : draft.warehouseId,
requiredRole: draft.requiredRole === '' ? null : draft.requiredRole,
```

It sends that same object to **both** verbs. The patch schema accepted null on
all four fields; the create schema accepted it on none. So the identical payload
saved when editing a limit and 400'd when making one, and the only way through
the form at all was to narrow the limit to one supplier at one location — which
is not a spending limit, it is an exception to one.

Counted the same afternoon:

|                                                     | Count |
| :-------------------------------------------------- | ----: |
| Spending limits on the whole platform, every tenant | **0** |
| Purchase orders ever held for sign-off              | **0** |

Not "rarely used". **Never once used, by anybody, because it could not be.** Two
finished screens, an API, a service, a queue, a status of its own on the purchase
order, and an integration suite, over a create that rejected its own form.

### The workaround that kept the schema wrong

The purchase-order form sends the same shape of payload and does not break,
because its request builder strips each optional field first:

```ts
...(header.paymentTerms ? { paymentTerms: header.paymentTerms } : {}),
...(header.expectedArrivalAt ? { expectedArrivalAt: header.expectedArrivalAt } : {}),
```

Somebody hit this already and fixed it at their own call site. The schema stayed
wrong, and the next form to send an honest payload was the one that broke.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**It is a class, not an instance.** Measured across `@wizeworks/commerce-schemas`:
**23 fields over 36 create/update pairs** where the patch accepts a null the
create refuses. `create-update-parity.test.ts` now walks every pair generically,
carries those 23 as a named list that may only shrink, and asserts the count, so
a pair added tomorrow is covered without anyone remembering the file exists. The
four on this schema are gone from the list: removing the duplicated `.nullable()`
lines from the patch's `.extend({…})` leaves them inherited through `.partial()`,
so that pair can no longer drift at all.

### The check for this exact defect was already running, and green

`check:nullable-inputs` exists. Its header says what it is for in as many words:
_"a schema that refuses the null its own service writes … a box labelled 'Note
(optional)' could not be left empty, so a product group could not be created at
all."_ It had run on every push for weeks over a Spending limits form that could
not be saved.

It was blind twice over. [[feedback_structural_checks_go_blind]]

**One: it could only see fields written as `z.…`.** Its field pattern was
`/^\s{2,}(\w+)\s*:\s*(z\.[^
]*)$/`, and these schemas build most of their fields
from shared aliases — `Uuid`, `MoneyCents`, `Currency`, an exported enum.
**377 fields were invisible against 1,339 visible, and 146 of the 377 were
`Uuid`** — which is exactly the shape of a "which supplier / which location /
which person" field that a blank `<select>` nulls. `CreatePoApprovalRuleInput.supplierId`
was one of them.

**Two: its three-line window reached into the next field.** `acceptsNull` was
tested against the field's line plus the two after it, to catch a chain that wraps.
Those two lines are usually the NEXT fields, so a narrow field sitting above a
`.nullish()` one was masked by its neighbour. Proved by narrowing
`CreateTaxExemptionInput.customerId` and watching the check stay green because
`companyId` on the line below was fine. The window now stops where the next field
starts.

Widening those two things turned up **45 more fields** a service already writes
null into and its own schema refused — every one a save that comes back 422 with
no field named. Among them: a new product with no location, a new version with no
cost or no barcode, a delivery rate with no free-over threshold, a tax exemption
with no certificate, a review left by somebody not signed in, an order with no
billing address. All 45 are widened to `.nullish()`, which the check's own
reasoning makes safe by construction: the service already writes null there when
the field is absent, so an explicit null is the same write.

Both blind spots are now proved red by breaking what they guard.

## Four more, found by walking the rest of it

### 1. "Place order" did not place the order

With the limit in force, her $288 order was held — correctly. The confirm dialog
said:

> This sends the order and locks it. You will not be able to change the items or
> quantities afterwards. As the goods arrive you book them in under Receiving.

and the toast said **"PO-000004 placed"**, over a pane that said, twice, in the
next two inches of screen, that nothing had been ordered and the supplier had not
seen it. [[feedback_a_promise_in_copy_is_a_contract]]

Both now run through `placingWords`, which resolves the order against the live
limits using **the same pure resolver the server runs**, so the warning and the
outcome cannot disagree:

> **Send PO-000004 for sign-off?**
> This order is over your "Anything over $200" limit, which holds anything of
> $200.00 or more. It will NOT go to Ashcombe Mills yet: it waits under Sign-offs
> until somebody approves it, and nothing can be received against it until they
> do. It stays editable while it waits.
> [Keep it a draft] [**Send it for sign-off**]

> **PO-000004 is waiting for sign-off**
> Nothing has been ordered. Ashcombe Mills has not seen it. Find it under Sign-offs.

Under every limit, the words are the old ones. An order that really is placed must
not be hedged about.

### 2. A rule that said "The owner" was signable by anyone, and said so

The order's own pane read:

> **Anybody who can approve spending can sign it off.** Held by "Anything over $200".

The rule said **The owner**. The pane read `requiredApproverName` — null, because
the console cannot yet name one person — and fell straight through to the loosest
sentence available, skipping the role the rule does carry. `approverLabel()` was
written to answer exactly this question and was called only on the rules list.
[[feedback_fetched_but_never_rendered]]

**And the server agreed with the wrong sentence.** `decidePoApproval` checked
`requiredApproverUserId` and nothing else. The endpoint gates on `editor`, so a
rule reading "The owner signs it off" was satisfied by the most junior person who
could raise the order in the first place — 100% of what the screen can express,
since the named-person control is not built yet.

The route header already makes this argument about WRITING a rule: _"a spending
control that an ordinary editor can raise the threshold on is not a control, and
the person the rule constrains is exactly the person who must not be able to edit
it."_ It was true one step along, on signing, and nobody had gone there.

`canSignOff(actorRole, requiredRole)` is now a tested pure function in
commerce-schemas; the route passes the signer's role; the service refuses with
_"This order has to be signed off by the owner"_. A rule naming a role nobody
recognises still admits whoever the endpoint let in — holding an order forever
with no possible approver is the worse failure.

### 3. An order sent back looked like an ordinary draft

Turning an order down **requires** a reason. The server refuses a "no" without
one, and the box asking for it promises:

> Required. The buyer sees it, and it stays on the order's history.

Devi turned PO-000004 down with a reason, opened it, and read:

> Draft · Ashcombe Mills · Landing at Main Warehouse
> **Not sent yet. You can still change anything on it.**

Nothing else. Not that it had been refused, not by whom, not why. The reasonable
next move is to place the identical order again and be refused again.

The trail was unreachable rather than unrendered. `useOrderApprovals` carried the
comment _"Every status: the point of a trail is the rejections"_ directly above
`status: 'pending'` — and there was no value of `status` that meant "all", so the
route could not have answered it either. Asking for one order now returns that
order's whole trail; asking with no order still means the queue, which is pending.

The buyer's pane now carries it:

> **Sent back**
> **This was sent back to you**
> Devi Raman turned it down. Change what they asked for and place it again: it
> goes back to them, not to the supplier.
>
> **What they asked for**
> Ask Ashcombe for a price on 24 first. We nearly always pay less per shirt at two
> dozen.
> **[See every sign-off]**

It counts repeats ("sent back 2 times"), it is honest when the reason went missing,
and it disappears the moment the order is resubmitted: a stale refusal beside
"waiting for sign-off" reads as the NEW request having already been turned down.

### 4. "Orders over $200" holds an order of exactly $200

`resolveApprovalRule` compares `totalCents >= minAmountCents`, and has to —
"leave it at 0 to hold every order", which the form promises, is only true of
`>=`. So the number is a floor and the word was wrong, everywhere it appeared.
It now reads "**$200.00 or more**", and the field says so outright: _"An order for
exactly this much is held too, so a limit of $200 catches a $200 order."_

## Two smaller ones the walk turned up

- **The empty state named a screen it would not open.** Every branch of the
  Sign-offs empty state sends her to Spending limits, and none of them offered a
  way there — the same shape as the reorder list naming Suppliers with nothing to
  press ([663](663-the-buying-list-i-could-not-buy-from.md)). She had to go back
  to the search box and type it. There is a button now.
- **"Nothing waiting" over an order that was waiting.** Deciding an approval
  invalidates the purchase orders; placing a purchase order did not invalidate the
  approvals, so an order placed while the Sign-offs pane was open left it reading
  "Nothing waiting". The mirror went one way. It goes both ways now, held to the
  queue's real key by a test rather than by hope.

## Driven end to end

```
Spending limits → Set a limit → "Anything over $200" · Any supplier · Any
  location · The owner → Set the limit → SAVED (the first one on the platform)
PO-000004 $288 → Place order → the dialog names the limit and refuses to say
  "sends" → "PO-000004 is waiting for sign-off. Nothing has been ordered."
Sign-offs → 1 order waiting · "The owner to sign" → Send back, with a reason
the order → "This was sent back to you" + the reason, on the buyer's screen
  → 12 becomes 24 → Place order → held again at $576
Sign-offs → Approve → "It has gone to Ashcombe Mills."
  → "Nothing is waiting on you. You are holding every order of $200.00 or more."
  → PO-000004 submitted, ordered, expected 2026-10-09 off the supplier's lead time
```

## What was good here, and was already good

- The empty state already refused to say "everything has been dealt with" over a
  business with no limit set, and already distinguished "no limit" from "limit
  switched off". It had simply never been able to reach its third branch.
- `resolveApprovalRule` is pure, stated rather than inherited ("highest cleared
  threshold wins, then sort order, then age"), and shared — which is why the
  console's new warning cannot disagree with the server's decision.
- The approval trail is append-only and the amount is snapshot at request time,
  so editing an order after sign-off cannot retroactively change what was signed
  for. That is the hole a spending control exists to close, and it was closed.
- `pending` is counted tenant-wide whatever the view is filtered to, so "Nothing
  waiting" stays meaningful while reading history.
- Deleting a limit is `SET NULL`, not cascade: the orders it held keep their rows,
  and the queue says "Held by a rule since removed" rather than losing the record.

## Files

- `wizeworks/packages/commerce-schemas/src/procurement.ts` + `procurement.test.ts`
- `wizeworks/packages/commerce-schemas/src/create-update-parity.test.ts` (new)
- `scripts/check-nullable-inputs.mjs` (two blind spots), plus the 45 fields it then found across
  `commerce-schemas/src/{cart,discounts,inventory,pricing,procurement,products,returns,reviews,shipping,site,tax,bundles,product-types/schema}.ts`
  and `crm-schemas/src/{orders,order-payments,order-fulfillments}.ts`
- `wizeworks/packages/inventory/src/services/purchase-order-approvals.ts`
- `wizeworks/packages/inventory/test/integration/procurement.test.ts`
- `wizeworks/services/api-rest/src/routes/v1/inventory/po-approvals.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/po-approvals-words.ts` (new) + test
- `piggles|sparx/apps/workbench/surfaces/inventory/{po-approvals.tsx,po-approvals-data.ts,po-approvals-empty.ts}` + test
- `piggles|sparx/apps/workbench/surfaces/inventory/{po-approval-rule-detail.tsx,po-approval-rules.tsx}`
- `piggles|sparx/apps/workbench/surfaces/inventory/{purchase-order-detail.tsx,purchase-order-procurement.tsx,purchase-orders-data.ts}`
