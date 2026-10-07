# 941 — A journal was told to add the first thing it sells

**Status:** fixed (act 2)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 2, the console as a non-seller sees it
**Surface:** mypiggles › Home: the checklist, Start something and the all-clear line (Piggles console, api-rest, `@wizeworks/db`)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P09 · The Marrow Review · act 2, her Home after the fix
**Blocked on:** —

## What happened

Rosalind signed up The Marrow Review, a journal that sells nothing, and ticked
**I need a website** and **I deal with customers**. Nothing about selling or
invoicing.

Her first Home:

- **Let us get you going**: "Three things and your business is running here."
  **Add the first thing you sell**, Add someone you work with, **Send your first
  invoice**. Her persona file names this exact screen as at minimum a major.
- **Start something**: **Add a product**, **Send an invoice**, Add a customer,
  Work on my site. No way to write anything.
- After she cleared the practice data, **You are all caught up**: "Everything is
  sent, everyone has had a reply, nobody is waiting from your website, no
  bookings are waiting, nothing is late, **nothing is sold out and nothing is
  running low**."

Her answer was saved at signup (`settings.piggles.railGroups`) and nothing on
Home read it. The rail does not answer the question either: by design it starts
with every default app whatever was ticked (issue 011), so it cannot tell a
journal from a shop.

## The fix

- **`GET /v1/tenant/rail`** returns `does`: the groups she ticked, or null.
- **The checklist** asks the jobs for her answer (`first-run-steps.ts`):
  "I need a website" brings a new job, **Publish your first piece**; "I sell
  things" brings Add the first thing you sell; "I deal with customers" brings Add
  someone you work with; "I invoice people" brings Send your first invoice. A
  business that never answered keeps the original three. The intro counts them
  ("Two things and your business is running here").
- **Publish your first piece** ticks on her own published articles. The count
  comes from `/v1/sample-data/own?kind=article`: published entries that are
  neither practice rows nor a design's example articles.
- **Start something** offers the buttons for her answer: **Write something**,
  Add a customer, Work on my site.
- **The all-clear sentence** leaves out reassurance about apps she said she does
  not use. A count that needs her is never filtered: a journal that one day
  takes an order is still told.
- The customer step's line no longer promises "orders and invoices"; the
  Practice data screen's last line says "Practice records", not "Sample
  records".

## Proof

- `first-run-steps.test.ts`, 4 cases. Ignoring the answer reddens 2.
- `signals.test.ts`: Start something for a journal, and the all-clear filter.
  Ignoring the answer in either reddens 1.
- On screen, as Rosalind: **Two things and your business is running here**,
  **Publish your first piece** and Add someone you work with; Start something
  read **Write something**, Add a customer, Work on my site; the all-clear read
  "Everyone has had a reply, nobody is waiting from your website and no
  bookings are waiting."

## Not changed

- Her rail still carries Sell, Stock, Invoices and Money. That is the rule from
  issue 011 (ticks add to a default rail; the signup preview shows it), and All
  apps puts any of them away.
