# 103 — A hair salon was told it had to publish a returns policy

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › Content › Legal pages
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen 2026-08-22

## What happened

Nia opened Legal pages to publish her privacy policy and read:

> **0 of 4 required pages ready**

Under **Pages you should have — these are the policies a business like yours is
normally expected to publish**: Privacy Policy, Terms of Service, Cookie Policy,
and **Return Policy**.

> **Return Policy** — How customers can send an item back to you.

She sells nothing online. She has no products, no orders, no delivery, no cart on
her site. There is nothing anybody could send back. The screen told her she was
one of four documents short of ready, and one of the four was about a business she
does not run.

## Why it matters

**On Piggles this could never come right by itself.** sparx charges per active
module, so "required once the shop is on" means something there. Piggles ships
every app switched on for everybody and does not price them (piggles/CLAUDE.md
RULE #2) — so `commerce.enabled` is true for a hair salon, a bookkeeper and a
choir, and "0 of 4" was the permanent state of every Piggles business that does
not sell.

Her two honest options were both bad: publish a returns policy that is false about
her business, or leave a checklist reading "0 of 4" forever on the one screen whose
job is to tell her she is legally squared away.

## Where it lives

[wizeworks/packages/cms/src/legal-service.ts](../../../../wizeworks/packages/cms/src/legal-service.ts):

```ts
async function commerceEnabledTx(tx: TxClient, tenantId: string): Promise<boolean> {
  const t = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  return Boolean(modules?.commerce?.enabled);
}
```

**The right rule was already in the same file, twenty lines away**, written for the
Shipping Policy and reasoned out in full:

> The Shipping Policy is optional, because selling is not shipping — a bakery
> taking collection orders has commerce switched on and posts nothing. But a
> business that DOES ship and has no shipping policy should be told, so the prompt
> has to come from **evidence rather than from a default**.
>
> `Product.requiresShipping` is NOT that evidence: it defaults to `true`… **A
> default is not a decision anybody made.**

Every word of that applies to `modules.commerce.enabled` on Piggles. Shipping got
the evidence test; returns kept the flag.

## The fix

The same rule, applied to the same question:

```ts
/** Whether this business actually SELLS THINGS, on evidence. */
async function sellsThingsTx(tx: TxClient): Promise<boolean> {
  const product = await tx.product.findFirst({
    where: { status: 'active', deletedAt: null },
    select: { id: true },
  });
  if (product) return true;
  const order = await tx.order.findFirst({ select: { id: true } });
  return order !== null;
}
```

A live product, or an order that has actually been placed. Either is a decision
somebody made; a module flag that ships on is not.

Note it does NOT hide the Return Policy — it moves it from **required** to
**optional**, where it sits beside Shipping and Refund. A salon that starts selling
shampoo online gets it back as required the moment there is a live product, which
is exactly when it starts being true.

## Confirmed by

Re-run as Nia on 2026-08-22: the header reads **0 of 3 required ready**, Return
Policy has moved down to **Optional pages**, and after publishing and reviewing
the three real ones the pane reads:

> **Your required pages are all set** — Every page you are expected to have is
> published, up to date, and linked in your footer.

She also hid the Return, Shipping and Refund links from her footer, which the pane
supports directly and which is the right end state for a business that sells
nothing online. The three published policies resolve from the live footer:
`/privacy-policy`, `/terms-of-service`, `/cookie-policy`, all 200.

## One more thing on this pane, not filed separately

**"This is still the starter wording" is a claim the software cannot make.** Nia
rewrote all three policies — the commerce language in them was false for a salon,
so "orders, payments and deliveries" became "taking and keeping your appointment",
and so on — and every row still said her text was the starter's. The badge is
really about `legal_disclaimer_ack_at`, which nobody has pressed yet. "You have not
marked this as checked yet" is the same prompt and is true either way.

## Rating effect

`Content › Legal pages` is scored in [rating.md](../rating.md).
