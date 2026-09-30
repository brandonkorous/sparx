# 823 — "by sparx" on the screen where she picks who handles her money

**Status:** fixed
**Severity:** brand leak + correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `platform.settings.integrations`, `platform.settings.integration`, `finance.subscription`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, before and after; both guards green
**Blocked on:** —

## What Devi saw

**Other software**, the card shelf where a business connects its payment
processor, its carrier and its sales channels. Under Card payments:

| | |
| --- | --- |
| **Manual payments** | by **sparx** · Connected · Community |
| **Piggles Pay** | by Piggles · Recommended · Community |
| **Custom gateway** | by **sparx** · Community |
| **sparx Shipping** | by **sparx** · Community |

A company she has never heard of, on the screen where she decides who handles
her money, two cards along from one that got it right.

## Why one card was right and three were not

The mechanism is `{platform}`, a token the route fills with the tenant's own
brand name. It is there, it works, and issue 128 already extended it to `vendor`
and `publisher` after they bit first. What it cannot do is fill a field that
never held a token:

```ts
/** Who the tenant's money relationship is actually with. */
function vendorFor(id: string): string {
  …
  default:
    // `custom` and `manual` — the tenant's own processor, or nobody's.
    return 'sparx';
}
```

The comment above it says the right thing. The value names the other brand.
Same in `provider-shippo`: `displayName: 'sparx Shipping'` and `vendor: 'sparx'`,
both literals. Same in `integration-framework`: `publisher: 'sparx'`.

Four literals, all of them `'{platform}'` now.
[[feedback_a_copy_edit_breaks_identity_lookups]]

## The badge that called the brand's own product a stranger

Worse, and quieter. Every card on the shelf carried a **Community** badge, whose
comment explains what it is for:

> A contributor's integration says so plainly — a tenant is trusting somebody
> other than sparx with their data, and that is theirs to know.

It was decided like this:

```tsx
{integration.publisher !== 'sparx' ? <Badge>Community</Badge> : null}
```

`publisher` is filled with the tenant's brand name two functions upstream. In
sparx it fills to "sparx", the comparison matches, and the badge stays off. In
Piggles it fills to "Piggles" and **never** matches — so every first-party
service on the shelf, including Piggles Pay, told a shop owner she was trusting
somebody else with her data.

And because it was on everything, it also told her nothing. A badge on every row
cannot be a distinction.

**A display string is not an identity.** The route emits `firstParty`, a boolean
decided from the UNFILLED descriptor before the brand name replaces the token,
and both consoles read that. Zero Community badges now, which is correct: every
integration on the shelf today is one we published.

## The guard was already red, and it was mine

`check:brand` was failing at the start of this act, on one string:

```
piggles/apps/workbench/surfaces/finance/subscription.tsx
  Your sparx bill controls
```

That is a regression from act 281's own 219-toolbar sweep, four days ago. The
sweep took each toolbar's name from the vocabulary, falling back to the catalog
title — and this pane renames its tab through `productCopy('finance.bill.title')`
instead of through `PIGGLES_SURFACES`, so the fallback used the platform's title
"Your sparx bill" and wrote it into the Piggles console.

Two mechanisms were renaming one pane and only one of them was where names live.
`'finance.subscription': 'What you pay us'` is in the vocabulary now, so the
rail, the tab, the bar and both guards agree.

## A hole the fix opened, and closing it

Giving that toolbar an expression label made `check:toolbar-names` drop from 370
to 369 without a word, because it matches `label="…"` and silently skips a
`label={…}`. Measured after teaching it to count them: **20 toolbars across both
consoles are named by an expression this scan cannot read.**

Small, and the shapes are mostly `` label={`${NOUN} actions`} `` derived from the
pane's own noun — but the number is printed in the green line now rather than
missing from the denominator. The same lesson as issue 817, one layer down.
[[feedback_structural_checks_go_blind]]

## And one error that could not be acted on

Opening a connection that does not exist:

> **Could not load this connection**
> This is a problem reaching the server. The connection itself is unaffected.
> **[Try again]**

The server had answered perfectly well, to say there is no such connection. Try
again will fail forever. Two causes with different remedies under one sentence.
[[feedback_one_outcome_two_causes]]

`PaneLoadError` already tells the two apart from the error it is handed, and owns
the rule that a missing thing gets no retry button. This call site passed neither
`error` nor `noun`, so it always said unreachable. **sparx's copy of the same
file passes both.** It reads:

> **That connection is no longer here**
> It has been deleted, or the address points at something that is not in this
> business. Nothing of yours has been lost.

## Files

- `wizeworks/packages/payments/src/integration.ts`
- `wizeworks/packages/provider-shippo/src/metadata.ts`
- `wizeworks/packages/integration-framework/src/integration.ts`
- `wizeworks/services/api-rest/src/routes/v1/integrations/index.ts` — `firstParty`
- `piggles|sparx/apps/workbench/surfaces/integrations/{integrations-list.tsx,data.ts,integration-detail.tsx}`
- `piggles/apps/workbench/surfaces/finance/subscription.tsx`, `lib/console/vocabulary.ts`
- `piggles/scripts/check-toolbar-names.mjs` — counts the labels it cannot read
- `scripts/{platform-brand-debt,foreign-brand-debt}.txt` — one banked string gone

## Noted, not fixed

**Payments jargon in the shared card blurbs.** "Common with ISO/agent-sold
merchant accounts" on 1stPayGateway, and "disputes, settlement, and PCI" on
Piggles Pay. Both are written for somebody who has chosen a processor before.
They are shared with sparx, whose reader knows them, so this wants the same
treatment the industry starters just got: the brand's own sentence at the
boundary, not an edit to the shared one.
