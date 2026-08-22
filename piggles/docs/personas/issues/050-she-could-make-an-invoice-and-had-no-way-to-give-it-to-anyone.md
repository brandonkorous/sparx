# 050 — She could make an invoice and had no way to give it to anyone

**Status:** fixed
**Severity:** **blocker** (invoicing could do everything to a document except deliver it)
**Found by:** P01 · Thistle & Rye · act 10 — "Send it"
**Surface:** mypiggles › Invoices › the invoice editor
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — INV-000001 sent to `dane@ferrouscoffee.test`

## What happened

The invoice was right to the cent. Marisol went to send it, and there was
nothing to press. The whole document's outward actions were:

> **Print or save as PDF** · **Copy payment link**

Both hand the job back to her own email client. There was no Send anywhere — not
in the toolbar, not in the overflow, not on the stage control.

## Why it matters

An invoice that cannot be sent is not an invoice; it is a note to self. Everything
around it works — numbering, totals, snapshots, payments, aging — and the one act
the whole feature exists to enable was missing.

The screen also **promises** it. The address field's help text reads, in the
product's own words:

> **Where the invoice gets sent**

Nothing sent anything there. She would fill it in and wait.

## Why it happened

There was no route, no template, and no action. `@wizeworks/email` had
`billing-receipt` and `billing-payment-failed` — but those are **us billing the
tenant**, not the tenant billing their customer. The only tenant→customer
document mail that existed was `document-signature-request`.

## The fix

The whole path, following the shape `signature-mail.ts` already set:

- **`invoice-sent`** — a React Email template, registered in `TemplateId`,
  `TEMPLATE_IDS`, the fixtures, the events template union and the email-worker's
  zod delivery gate. (That gate is why the registration matters: a template
  missing from it does not fail loudly — the event is acked, one warning is
  logged, and the email is gone.)
- **`invoice-mail.ts`** in api-rest — assembles the props and publishes
  `email.send`, per the platform rule that outbound mail goes through the bus.
- **`POST /v1/invoicing/documents/:id/send`**.
- **A Send button in the toolbar**, not the overflow: making an invoice and
  sending it is one errand, and the second half of it is not a thing to go
  hunting for. It becomes **Send again** once it has gone, with a tooltip naming
  where and when.

## What is in the email, and why

There is no public invoice page (the payment-link route says so in its own
comment) and the event path carries no attachment. A mail that only ANNOUNCED an
invoice would announce something the recipient cannot open — so **the document
travels in the body**: who it is from, the number, every line with its
arithmetic, the total, what is still owed, the due date, and her note.

That is also what a café's bookkeeper actually wants: something readable on a
phone and forwardable, not a link behind a login.

## And it is HER invoice, not ours

The template uses `EmailLayout` (the tenant frame) with `header={false}`, not
`PlatformEmailLayout`. The platform chassis paints OUR wordmark in the masthead,
and Dane at Ferrous Coffee Bar has never heard of us — a software product's name
over a bakery's invoice reads like a billing service nobody hired, or a scam.

Every line names the business instead:

> **Subject:** Invoice INV-000148 from Rosa Flowers
> **Invoice from Rosa Flowers**
> Hi Ferrous Coffee Bar, here is invoice INV-000148 from Rosa Flowers. It is due
> by September 3, 2026.
> **$424.00** — Still owed of $624.00
> Country sourdough, whole loaf · 48 × $8.50 · $408.00
> …
> Questions about this invoice? Reply to this email and it goes straight to Rosa
> Flowers.

Three refusals are deliberate, and each has a test:

- **No due date invented.** A business that agreed no terms has none, and putting
  a deadline on a customer that nobody set is worse than saying nothing.
- **No "Tax $0.00" and no "Already paid" on an untouched invoice.** Only rows
  that are true of this document.
- **Leads with what is STILL OWED** once part is paid — asking for money already
  handed over is how a good customer stops being one.

**8 tests** on the rendered output, including that no masthead names the platform.

## Confirmed

Sent INV-000001 to `dane@ferrouscoffee.test`. The confirm named the recipient and
what would travel with it; the toolbar button became **Send again**, and the
record survived a reload.

## Left standing

`document-signature-request` has the same wrong chassis and admits it in its own
comment ("renders in sparx chrome for now; the per-tenant brand pass will re-skin
the tenant-facing templates"). Not touched here — it is one line, but it changes
an email that already ships, and it belongs with that pass rather than with this
one.
