# 448 — Two of the three ways a return ends tell the customer nothing

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 109
**Surface:** Selling › Returns › a return, and the whole `return.*` event family
**Filed:** 2026-09-08
**Fixed:** 2026-09-08
**Confirmed by:** P03 · Juniper Row · act 109

## What happened

Jo Kim sent a Marlow Knit back and asked for a size up. Devi approved it, marked
it received, and sent the replacement. Jo Kim got two emails and then silence.

That is not an omission. It is a **broken promise**, in writing, in a customer's
inbox, over Devi's name. The second email — the one the platform sends when a
return arrives back — ends:

> We'll email you again the moment your **exchange** is on its way.

There is no such email. There never was.

## The shape of it

A return has three endings, and only the money one wrote to anybody.

| Stage           | Event              | Automation | Template | In the trigger picker | Customer told |
| --------------- | ------------------ | ---------- | -------- | --------------------- | ------------- |
| requested       | `return.requested` | staff      | —        | **no**                | (staff alert) |
| approved        | `return.approved`  | yes        | yes      | yes                   | yes           |
| received        | `return.received`  | yes        | yes      | yes                   | yes           |
| refunded        | `return.refunded`  | yes        | yes      | yes                   | yes           |
| **swapped**     | `return.exchanged` | **none**   | **none** | **no**                | **NO**        |
| **turned down** | **no event**       | **none**   | **none** | **no**                | **NO**        |

Devi's whole reason for being on this platform is _"handle a return without three
messages back and forth"_, and returns are **22% of her orders**. Exchanges are
the normal case; refunds the exception. So the platform handled her exception and
left her normal case to her inbox.

## The other half: she was told it was handled

Both silences had console copy over them saying otherwise.

**Turning one down** opens a dialog that states, flatly:

> The customer keeps the item and no money changes hands. **They are told the
> reason you give here.**

`deny()` published no event at all. Devi types a careful explanation into that box
and it goes into a staff note. Nobody is told anything, and she has no way to
know that, because the sentence says the opposite.

## Why nobody could fix it themselves either

Two more doors were shut, which is what makes this a blocker rather than a gap.

1. **`return.exchanged` was not in the automations trigger list** (nor was
   `return.requested`). A shop cannot write a rule about an event the picker does
   not offer, and nothing on screen says an event exists but is not listed.
2. **Even a hand-built rule would have failed silently.** `return.exchanged` had
   no registered resolver, and `resolveFields` returns an EMPTY map for an
   unregistered event — deliberately, so nothing is ever fabricated. Every
   customer-email seed is guarded on `customer.email is_set`. With no fields, that
   guard can never pass, **and a non-matching automation writes no run and no
   error**. The rule sits `active` with 0 runs forever, indistinguishable from one
   that has simply had nothing to do.

That last one was confirmed by watching it happen: a swap settled on Devi's
screen at 22:03:17, the event reached the bus (`sparx.return.exchanged`, seq 40867) and the automation fan-in (seq 40868), the worker consumed it — and no run
row was ever written.

## How to reproduce

Every time, on any tenant.

1. A shopper asks to return something and picks **a replacement**.
2. Approve it, mark it received, and **Send the replacement**.
3. Read the shopper's inbox: an approval email, a received email that promises a
   third, and nothing else.
4. Or: **Turn down** a return, typing a reason. Read the inbox. Nothing.

## Why it matters

`return.received` is sent to every shopper on every return on the platform, and
it makes a promise the software can only keep one time in three. The other two
thirds end in a customer waiting on an email that does not exist, and then
emailing the shop to ask — which is the exact cost this product was bought to
remove.

At the time of the fix, **15 swaps were sitting approved or received** across the
platform, each one queued up to end in that silence.

## The fix

The whole lifecycle, because four of six were wired and the two that were not are
the two that end the conversation.

**1. `return.denied` is now an event.** Published by `deny()` with the reason in
the payload — a fact about THIS decision, not about the row, since the reason is
written to the same `staffNote` an approval uses and could not be told apart
later. Added to the platform catalog, the commerce topic union, and Terraform (a
publish to an unprovisioned topic fails silently in production, and
`check:events` caught it before this line was written).

**2. `return.exchanged` carries what went out.** `settleExchange` already built
the label for its staff note and threw it away; it now rides on the event, for the
same reason a subscription's one-time pay link does.

**3. Both have resolvers.** `RETURN_OUTCOME_EVENTS` hydrates the return, order and
customer — so `customer.email` resolves and the guard can pass — then merges the
two payload facts on top. They use a soft string reader, not the throwing one: a
swap carries no reason and a refusal carries no replacement, so each is missing
one by design, and one absent field must not take the whole resolve down. **My own
test caught that before it shipped.**

**4. Two shipped emails**, in the voice of the three that existed. The swap notice
does not offer tracking, because a replacement still has no delivery record of its
own — saying "on its way" and nothing more is the true version of what the shop
knows. The refusal leads with the shop's own words and invites a reply.

**5. All six events are in the trigger picker**, named as things that happen —
"A replacement is sent", "A return is turned down" — so a shop can write its own.

### Where the code changed

- `wizeworks/packages/events/src/types.ts`, `wizeworks/packages/commerce/src/events.ts` — `return.denied`
- `terraform/envs/prod/main.tf` — its Pub/Sub topic
- `wizeworks/packages/commerce/src/services/return-service.ts` — publish on deny; carry the label on exchange
- `wizeworks/packages/automation/src/resolvers/builtins.ts` — `RETURN_OUTCOME_EVENTS`, `maybeStr`
- `wizeworks/packages/automation-actions/src/seeds/returns.ts` + `seeds/index.ts` — two seeds
- `wizeworks/packages/builder-schemas/src/{default-emails.ts, default-emails-silica.ts, binding.ts, email-tokens.ts}`
- `wizeworks/packages/builder/src/services/email-default-refresh.ts` — empty sets, per that file's own rule for a new template
- `wizeworks/services/api-rest/src/lib/email-data.ts` — the two fields, empty so their rows self-drop
- `{piggles,sparx}/apps/workbench/surfaces/automations/automations-catalog.ts`
- Tests: `automation/test/integration/return-endings.test.ts` (5),
  `automation-actions/src/seeds/returns.test.ts` (4),
  `{piggles,sparx}/apps/workbench/surfaces/automations/automations-catalog.test.ts` (4 each)

Guards run red separately. Removing the resolver reddens all five engine tests —
including the end-to-end one, which reproduces the original symptom exactly: an
active automation, no run, no error. Hardening the soft string reddens two and
leaves three green. Dropping either seed reddens two of the four seed tests;
pointing one at a missing template reddens a different one. Removing a trigger
from the picker reddens three of the four catalog tests.

**Reaching the tenants that already exist:** nothing to run. `reconcileSystemSeeds`
is a daily idempotent backfill over every tenant whose module is already active,
so both seeds install themselves. Verified by running that same path against
Juniper Row: six return automations, all active.

## Confirmed by

P03 · Juniper Row · act 109. The whole lifecycle driven on her own screen — a
return started from order O-000016, approved, received, and settled by sending a
Silk twill scarf — plus the engine test above, which proves the link the screen
could not: the resolver produces the address the send is guarded on, and a swap
now writes a run where it wrote nothing before.

## Rating effect

`Selling › Returns › a return` and `Automations` — recorded in
[rating.md](../rating.md).
