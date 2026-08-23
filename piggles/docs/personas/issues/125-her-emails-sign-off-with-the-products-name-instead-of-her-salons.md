# 125 — Her emails sign off with the product's name instead of her salon's

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 9
**Surface:** every email a tenant sends — the footer sign-off
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Surfaced while fixing [122](122-every-email-her-salon-sends-is-signed-with-another-companys-name.md).
The footer's top line is the business name, linked home — the sign-off a client
reads at the bottom of a reminder. On Nia's it rendered:

> **Piggles**

Her salon is called Halo & Hem. It has a name, a logo, a published theme and its own
Instagram link two lines below, all of which the same footer was drawing correctly.

## What should have happened

The email is on behalf of the shop, so the shop signs it.

## Where it lives

- [packages/email-platform/src/services/brand-service.ts](../../../../wizeworks/packages/email-platform/src/services/brand-service.ts) — `siteThemeToBrand`
- [packages/email/src/components/brand.tsx](../../../../wizeworks/packages/email/src/components/brand.tsx) — `defaultBrand`

## The cause

`BrandTokens.siteNameIsPlatformDefault` is the flag that distinguishes "the shop is
called this" from "we had no name and fell back to ours". Its own comment explains
why it has to exist:

> The wordmark needs the distinction and cannot infer it: it used to ask
> `siteName !== 'sparx'`, which hardcoded one brand as the meaning of "unbranded"
> and put that brand's name on the other brand's email. Whoever builds the fallback
> knows the answer; nobody downstream can work it out.

`defaultBrand` ships it as `true`. **Nothing ever set it false.** Every resolved
brand is merged over `defaultBrand`, so the flag arrived as `true` for a
fully-branded tenant, and all three readers concluded the shop had no name of its
own:

- the footer sign-off (this issue),
- `_layout.tsx`'s `senderName` on every platform template,
- `wordmark.tsx`'s `hasName`, which is why a shop's name never appears as the
  masthead when it has no logo to draw instead.

A flag that is only ever switched on is not a flag. It was invisible because the
one reader with a visible failure — the wordmark — falls back to a logo, and Nia
has a logo.

## The fix

`siteThemeToBrand` sets the flag alongside the name, because the function that
supplies `Property.name` is the only one that knows where it came from. All three
readers were correct all along and now get a true answer.

## Confirmed by

> Re-ran the reminder preview as Nia. The footer's sign-off reads **Halo & Hem**,
> linked to her site; the attribution line under it reads **Sent with Piggles**. The
> two say different things because they mean different things.
