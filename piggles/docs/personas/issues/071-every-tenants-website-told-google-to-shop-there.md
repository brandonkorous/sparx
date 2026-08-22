# 071 — Every tenant's website told Google to "shop" there

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Thistle & Rye · standing checks
**Surface:** every tenant site — the page's meta description and its social card
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

The default description on every tenant site, the sentence a search engine prints
under the title and a social card shows beneath the name, was:

```tsx
description: `Shop ${site.name}.`,
```

Two things wrong with it at once.

**It assumes the business sells.** A sparx or Piggles site is content and/or
commerce — a CMS-only publisher, a CRM-only team and a B2B distributor all render
this exact layout, and none of them has a shop to send anyone to. That is a CORE
rule, and this is the single most-published sentence on the platform.

**Even where the assumption held, it said nothing.** "Shop Thistle & Rye." is the
title again with a verb in front. It is the one line a business gets to persuade
somebody in a search result, spent on nothing.

## What should have happened

The tenant's own words, or none. `site.tagline` is already resolved onto the site
context — the per-site brand tagline, which is a thing they actually wrote.

## How to reproduce

View source on any tenant site page that does not set its own `seoDescription`:
`<meta name="description" content="Shop {name}.">`, plus the same string in the
OpenGraph card. Every page, every tenant.

## Why it matters

It is what a stranger reads about the business before deciding whether to click,
and it is wrong for every tenant who does not sell and empty for every tenant who
does.

## Where it lives

[wizeworks/apps/site/app/layout.tsx](../../../../wizeworks/apps/site/app/layout.tsx) — `generateMetadata`, the `description` and its `openGraph` twin.

## The fix

The tagline where there is one, and **the tag omitted entirely where there is not**.

Omitting is the deliberate half. A crawler that finds no description writes a
snippet from the page itself, which is always truer than a template's guess about
what kind of business this is — where an invented one is a claim nobody made. That
is the same rule as [[feedback_never_present_absence_as_measurement]]: a value
nobody supplied must not render as one.

A cleared tagline and an unset one are treated alike — `?.trim() ?? ''`, then the
key is spread in only when non-empty. Pages that set their own `seoDescription`
override this either way, unchanged.

## Confirmed by

Re-run on 2026-08-21 on her live site. `/cart` and `/search` — pages that set no
`seoDescription` of their own, so they inherit the site-level default — now carry:

> Bread and pastries, baked here every morning.

Her own tagline, in all three tags (`description`, `og:description`,
`twitter:description`). Before the fix all three read "Shop Thistle & Rye."

(Her HOME page carries its own richer description and always did — it is the
inheriting pages that show the default, which is why they are the ones to check.)

The omit-when-empty half is verified in code but not on screen: proving it needs a
tenant with no tagline, and clearing hers would be editing her business's data.
