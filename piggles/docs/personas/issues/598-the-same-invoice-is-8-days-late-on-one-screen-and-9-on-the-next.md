# 598 — The same invoice is 8 days late on one screen and 9 on the next

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Invoices, and mypiggles › Money › Owed to you
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen, both panes)

## What happened

Two things, and the second only showed up because I went looking for the first.

**One: my invoice list disagreed with itself.**

Eight invoices, every one of them printed **Due Sep 8, 2026**. Seven said
**"9 days late"**. INV-000001 said **"8 days late"**.

Nothing about INV-000001 is different. Same date on the screen, same customer as
two of the others, same shop. The only difference is that somebody happened to
raise it at midday and the rest were raised around 2:45 in the morning.

**Two: the same invoice was a different age on the next screen along.**

| screen              | INV-000001  |
| ------------------- | ----------- |
| Invoices            | 8 days late |
| Money › Owed to you | 9 days late |

Same invoice. Same afternoon. Two answers.

## Why it matters

"How late is it" is the number I chase people on. If it is not the same number
everywhere then it is not a number, it is an opinion, and I would find that out
in front of a customer.

The second one is worse than it looks. It is not a rounding wobble: **it is the
whole shop, for seven hours of every day.**

## Where it lives

Two different causes with the same face.

### One: elapsed milliseconds, not calendar days

`workbench/surfaces/invoicing/types.ts`:

```ts
const elapsed = Math.floor((Date.now() - due.getTime()) / 86_400_000);
```

That counts 24-hour periods, so the HOUR on the due date decides the answer. An
invoice due at 02:41 has clocked 9 whole periods by the time one due at 12:00 has
clocked 8, and both of them print "Sep 8".

**This exact bug is described, in detail, in two other files that fixed it.**
`surfaces/finance/format.ts`:

> Each had its own copy of `(now - dueAt) / 86_400_000` … so from early evening
> onward a US reader's bill due TODAY was badged "1 day late".

and `packages/crm/…/billing-ar.ts`:

> two invoices BOTH PRINTED "Due Sep 8, 2026" on adjacent rows, one marked "1 day
> late" and the other "Not yet due" … The label a shop reads was decided by a
> time she was never shown.

Invoicing never got either fix. That is [[a fix leaves its neighbour behind]] for
the fifth time, and the clearest instance yet: the rule was written down twice,
with the symptom spelled out, and the third copy went on doing the old thing.

**Fixed:** the rule now lives in one place, `lib/console/days.ts`, with the
reasoning and a test. `format.ts` re-exports it and invoicing calls it. There is
no third copy to be wrong.

### Two: the server keeps a different calendar from the business

Devi's shop is registered in **America/Denver**. At the moment I was looking it
was 9:38 in the evening on September 16th in Denver, and **03:38 on September
17th in UTC**.

- Invoices counts in the console, on her day → Sep 16 → **8 days**.
- Owed to you counts on the server, in UTC → Sep 17 → **9 days**.

So for the seven hours between her evening and UTC midnight, every unpaid
invoice on the Money side of the console is a day older than it is. Both screens
were doing the arithmetic correctly; they were doing it on different days.

**Fixed: the server counts on the business's clock.** `daysPastDue` takes the
tenant's IANA zone and resolves "today" in it. The DUE side stays UTC, because
that is the basis the date is printed in, so the number and the printed date can
never disagree.

A business that has not said where it is keeps UTC exactly as before. Most have
not — 36 of the 39 on this database — so this widens the rule rather than
changing it out from under anybody.

**Every path that decides "is this late" now takes the zone, not just the screen
that found it:**

| path                                    | what it decides                              |
| --------------------------------------- | -------------------------------------------- |
| `finance/receivables` route             | the chase list and its aging buckets         |
| `billing-document-service.aging()`      | the AR aging report                          |
| `deriveDocumentStatus`                  | the stored `overdue` status                  |
| `billing-from-order-service`            | an order's invoices, as the order shows them |
| `b2b-escalation-service`                | credit hold and suspension                   |
| `automation-actions` billing merge tags | the dunning ladder's 7 / 14 / 30 days        |

The last two are why this was worth doing properly rather than patching the one
screen. The dunning ladder matches `overdueDays` on an EXACT day, and the
escalation ladder stops an account ordering. A day early on either of those is
not a display detail — it is an email a customer should not have had yet and an
account that should not have been on hold.

The escalation query boundary moved with it: `startOfBusinessDay` replaces a
hand-rolled UTC midnight, so the query that selects a document as late and the
count that ages it cannot pick different days.

## Guard

**`lib/console/days.test.ts`**, 6 tests in each console. The one this exists for:

```ts
const earlyMorning = daysPastDue('2026-09-08T02:41:59.579Z', NOW);
const midday = daysPastDue('2026-09-08T12:00:00.000Z', NOW);
const lateEvening = daysPastDue('2026-09-08T23:58:00.000Z', NOW);
expect(earlyMorning).toBe(8);
expect(midday).toBe(8);
expect(lateEvening).toBe(8);
```

Proven red: putting `floor((now - dueAt) / 86_400_000)` back fails **2 of 6** —
`expected 9 to be 8`, which is the exact pair of rows on Devi's screen.

**`packages/crm/…/billing-aging.test.ts`**, 5 new tests (14 total). It asserts
the business clock, asserts that UTC gives a DIFFERENT answer in the same
instant, asserts that a zone-less business is unchanged, asserts a nonsense zone
degrades to UTC rather than throwing inside a finance report, and asserts the
aging BUCKET moves and not just the label.

Proven red: reverting to `utcDay(now)` fails **3 of 14**, and the three
zone-less-business cases stay green — which is the point. A guard that reddened
on all five would be testing "it returns a number", not "it returns the
business's number".

## Confirmed

Both panes, after the change, every invoice due Sep 8:

```
Invoices             INV-000001 … INV-000010  →  8 days late
Money › Owed to you  INV-000001 … INV-000010  →  8 days late
```

## The console counts on her shop's clock too

I nearly wrote this up as "still open", on the assumption that the business
timezone was not available in the console. It is. `useBusinessZone()` has been
there since issue 081 — a salon set her week to 09:00 and her diary showed a
full head of color at three in the morning — reading the same
`GET /v1/tenant/business` field the server now counts on.

So the client side is wired to it as well, and the gap is closed rather than
recorded:

| screen                       | now counts on   |
| ---------------------------- | --------------- |
| Invoices (`describeDue`)     | the shop's zone |
| Bills to pay (`daysPastDue`) | the shop's zone |
| Spending (`billState`)       | the shop's zone |
| One cost (`billState`)       | the shop's zone |

Her books stay with her shop, not with whichever airport she opens the console
in. Without a zone on file it is this computer's day, which is the right guess
and, as of this issue, no longer the only guarantee.

Worth recording that checking took one grep and would have saved a wrong
paragraph. "The console has no field for it" was a claim about the code that I
had not opened the code to make.

## Still open

Nothing from this issue.
