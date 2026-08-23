# 122 — Every email her salon sends is signed with another company's name

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › My Site › Email designs › Preview — and every email a tenant sends
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Nia opened the booking reminder to check what her clients actually receive, and
pressed Preview. Her logo, her colours, her footer links, her Instagram. Then, at
the very bottom, in her own brand colour:

> Sent with **sparx**

linking to `https://sparx.works/?ref=powered-by`.

Halo & Hem is a **Piggles** business. Nia has never heard of sparx. Every
confirmation, reminder, change notice, cancellation, receipt, invoice and order
email her salon sends carries a link to a different company's marketing site, in
front of her clients, on every send.

## What should have happened

The line credits the product the business actually bought, or it says nothing.

## How to reproduce

1. My Site › Email designs › any email › Preview.
2. Scroll to the footer. Every time, before the fix: **Sent with sparx**.

## Why it matters

It is the highest-traffic surface either brand has — every tenant, every
transactional send, in the recipient's inbox — and it names the wrong company. A
Piggles customer who clicks it lands on a competitor-shaped signup page.

`wizeworks/CLAUDE.md` RULE #0 already banned exactly this ("No product names in
user-facing strings … anything a person reads comes from the brand's lexicon"),
and the machinery to obey it was already built: `BrandTokens.platform` exists for
this, `usePlatform()` reads it, and a comment in
`packages/email/src/components/brand.tsx` records the last sweep — "110-odd
literals across 29 files, every one of which reached a Piggles owner naming the
wrong company."

That sweep fixed the React templates. It missed the **silica frame**, which is the
engine every tenant-facing email actually renders through ("ONE engine", docs/120
slice 7). The one file it did not reach is the one wrapped around every send.

## Where it lives

- [packages/email/src/silica/frame.ts](../../../../wizeworks/packages/email/src/silica/frame.ts) — `footerSection`
- [packages/email-platform/src/services/brand-service.ts](../../../../wizeworks/packages/email-platform/src/services/brand-service.ts) — `resolveEmailBrand`

## The fix

Two halves, because the leak had two causes.

**The frame stopped carrying a literal.** `attributionHtml()` reads the product's
own name and home from `brand.platform` and renders nothing at all when the send
cannot say which product it is from. Crediting a guess is worse than crediting
nobody, and it is the same call the palette floor already makes when it renders
achromatic rather than wearing somebody's colours.

**The brand resolver started supplying it.** `brand.platform` was only ever set by
`email-worker`, on the React template path. The silica path — every transactional
send, plus the studio preview and the test send — had no route to it, which is why
a literal was there in the first place. `resolveEmailBrand` now resolves the
identity from the tenant's `platform_brand` and attaches it, so every silica caller
inherits it without asking.

Also removed in passing: `brand.siteName ?? 'sparx'`, the same literal one line up,
which signed an unbranded send with one product's name whichever product made it.

## A boundary check that does not check this

`wizeworks/CLAUDE.md` states that `check:boundaries` fails on "a brand name literal
in a user-facing string under `wizeworks/**`". It does not — the script checks
imports and banned packages only, and has no string rule at all. The documented
guard would have caught this on the day it was written, and there was nothing to
catch it. Filed as [128](128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md).

## Confirmed by

> Re-ran the preview as Nia. The footer now reads **Halo & Hem** for the sign-off
> and **Sent with Piggles** underneath, with the link pointing at Piggles' own home
> and a `?ref=powered-by` tag.
