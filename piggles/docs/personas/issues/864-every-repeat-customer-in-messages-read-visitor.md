# 864 — Every repeat customer in Messages read "Visitor"

**Status:** fixed
**Severity:** **major** — the "who am I talking to" panel asked one question, does
`chat_conversations.customer_id` name a customer, and **nothing on the platform
has ever written that column**. The public widget is the only thing that creates
a conversation and it passes no customer id; the staff creator that accepts one
has no caller in either console. So the panel's whole identity half — order
count, lifetime spend, last ordered — was unreachable code, and the five-row
orders query the server ran to feed it was thrown away on arrival
**Found by:** P03 · act 307, opening Messages with the dev ports down, so by
reading the code and the database rather than the screen
**Surface:** mypiggles › Messages › one conversation, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** four new tests against the live database, proved red two ways

## The one question it asked

```tsx
{data?.linked ? <Badge>Customer</Badge> : <Badge>Visitor</Badge>}
…
{data?.linked ? ( /* orders, spend, last ordered */ ) : null}
```

`linked` is `conv.customerId !== null`. Measured on the development database:

```
chat_conversations                 8
  …with a customer_id              0
  …with a property_id              8
```

Zero of eight. Not a seeding accident either — **there is no writer.** The public
widget route builds the conversation and never passes `customerId`:

```ts
const { conversation } = await conversationService.create(ctx, {
  propertyId,
  subject: input.subject,
  source: …,
  visitorName: input.visitorName,
  visitorEmail: input.visitorEmail,   // ← collected, stored, never resolved
  visitorToken,
  message: { body: input.message, senderType: 'customer' },
});
```

`POST /v1/chat/conversations` (staff) does accept `customerId`, and a grep for a
caller in either console's `surfaces/**` returns nothing: no screen starts a
conversation at all. So the branch could not be reached by any path.

[[feedback_screen_over_a_function_nobody_calls]]

## The other half of the same failure

The server computes five recent orders on every load of that panel:

```ts
const orders = await tx.order.findMany({
  where: { customerId: customer.id },
  orderBy: { placedAt: 'desc' },
  take: 5,
  select: { id: true, orderNumber: true, status: true, total: true, placedAt: true },
});
```

`recentOrders` is declared on the console's own `CustomerContext` type, in both
consoles, and **drawn nowhere.** A query on every panel load whose only reader
threw the answer away. [[feedback_fetched_but_never_rendered]]

And it could not have been drawn as it stood. It carried `status` raw, and
"fulfilled" is the exact word `shippingState` exists to keep off the screen:
"reads as finished to everyone who has not worked in commerce, when it means the
opposite". A collection order would have claimed to be with a carrier.

## What it does now

**Three states, not two**, and the middle one is the point.

```
record   the conversation names a customer. Proof.
email    the address the visitor TYPED matches a customer on this site.
none     an anonymous visitor.
```

A shopper types an email into the widget's own name-and-email box — the setting
for which says, in the console, "Visitors give their name and email before the
chat starts, so you can follow up even if they leave." The shop very often
already has that address. So the panel now looks, and says what it found:

```
Jordan Hiker   [Possible customer]
They gave an email address you already have for Rosa Delgado, so the
history below is that customer’s.

6 orders · $412.50 spent · Last ordered 3 weeks ago

Their last 3 orders
O-000112   Ready to collect   Sep 14   $84.00
O-000098   Delivered          Aug 30   $212.50
O-000071   Delivered          Aug 02   $116.00
```

**The claim is never written down.** A typed address is a claim, not proof, so
`customer_id` stays null: writing it would attach a stranger's messages to a real
person's record for ever. A test asserts that explicitly.

**The badge is a weaker version of the same treatment**, not a different idea:
still colored, still soft, not the module's own hue. And the unknown state went
from `color="neutral"` to a **colorless** badge, which is sanctioned and needs no
approval, rather than a grey that is not ours to choose.

## Why the match is scoped to the site

`customers` is unique on `(tenant, property, email)` and separately on
`(tenant, email)` for the site-less tier. It is **not** unique on
`(tenant, email)`, because one owner's two businesses may each know the same
person. Measured on the same database:

```
marguerite.adeyemi@example.com   4 rows   1 tenant (Juniper Row)   4 different sites
imani.reyes@example.com          2 rows   1 tenant                1 site + 1 business-wide
```

An email-only lookup would have answered with whichever of Devi's four
Marguerites came back first and shown that one's spend. Every conversation
carries the site its widget was embedded on (8 of 8 do), so the site is asked
first and the business-wide tier second. Each of those two reads can match at
most one row, which is what makes the answer deterministic rather than usually
right. [[feedback_one_outcome_two_causes]]

The 47 business-wide customers of 745 are why the fallback exists: asking the
site first must not mean never asking at all.

## The orders are Selling's, so they are read as Selling's

`recentOrders` was deleted rather than rendered. The panel now reuses the
Commerce order data layer whole, which is the rule the CRM's own orders tab
already states in its header: "it does NOT re-model an order". So the delivery
state comes from `shippingState`, a collection order says "Ready to collect", the
rows wear the Commerce hue through a nested `ModuleScope`, and a click opens the
real order.

`countedOnly: true`, because the list sits directly beneath the lifetime figures
and those leave canceled orders out — the same flag, and the same reason, as
issue 332.

## Proved

**Four new integration tests against the live database**, and proved red twice:

```
drop the site scope (email-only lookup)   → 1 of 9 fails
stop the email match running at all       → 3 of 9 fail
```

The first is the one worth having. An email-only match passes the other three
tests, on this exact database, and answers with the wrong Marguerite.
[[feedback_a_test_that_cannot_go_red]]

**Six console tests** on `who-line.ts`, proved red 3 of 9 by making the email
badge say "Customer" and the unknown badge grey. The sharpest holds the badge
against the history: a spend history can never render under a badge saying the
shop has never met this person.

**Checks:** typecheck 0 on `api-rest` and both workbenches. Tests: api-rest 33
files / 269 plus chat integration 9/9 against the real DB; piggles workbench
chat+crm+commerce 34 / 358; sparx 30 / 299. ESLint and prettier clean.

## Files

- `wizeworks/services/api-rest/src/lib/chat/customer-context.ts` (the match)
- `wizeworks/services/api-rest/src/lib/chat/index.ts`
- `wizeworks/services/api-rest/test/integration/chat.test.ts`
- `{piggles,sparx}/apps/workbench/surfaces/chat/data.ts`
- `{piggles,sparx}/apps/workbench/surfaces/chat/thread.tsx`
- `{piggles,sparx}/apps/workbench/surfaces/chat/who-line.ts` (new)
- `piggles/apps/workbench/surfaces/chat/who-line.test.ts` (new)

## The thing to remember

**A boolean with no writer reads exactly like a boolean that is false.** Nothing
on the screen, in the types, or in the tests distinguished "this customer is not
linked" from "no customer has ever been linked, and none can be". The panel was
internally consistent, the endpoint returned 200, the shape matched, and the
answer was always the same one. [[feedback_absent_behaves_like_fine]]

The tell was the _server doing work for it_: a five-row order query, written
deliberately, feeding a field the console declared and never drew. Somebody
built both halves of this panel and neither half could run.

## Not a bug, checked and dropped

- **`attachments` on a chat message** is drawn nowhere and the public route does
  accept it (`PostMessageInput.attachments`), so a visitor can send a photograph
  the owner will not see. Real, but 0 of 31 messages on the database carry one and
  the widget has no file control to send one with, so drawing them would be a
  screen over a path with no caller — the same mistake this issue is about. Filed
  as a note against the widget, not as a fix here.
- **`readAt` on a chat message** is written (27 of 31) and drawn nowhere. It marks
  when **staff** read an inbound message, not when the customer read a reply, so
  rendering it would tell Devi something she already knows by being there.
- **`crm.orders.list`, titled "Customer orders"**, lists every order in the shop
  rather than one customer's. That reads wrong under a Customers rail, and it is
  what the pane is for — an all-orders lens from the CRM side, with a Customer
  column that only makes sense there. The per-customer list is the Orders tab on
  the customer. Recorded, not filed.
