# 058 — Every new page said the business name twice

**Status:** fixed
**Severity:** minor (cosmetic, but on the browser tab and in search results, for every page without a hand-written SEO title)
**Found by:** P01 · Thistle & Rye · act 11 — publishing the Collection orders page
**Surface:** the tenant site › any Builder or silica page
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 11 — the tab now reads `Collection orders · Thistle & Rye`

## What happened

She published a new page and the browser tab read:

> **Collection orders · Thistle & Rye · Thistle & Rye**

## Why it happened

Two places append the brand, and each is right on its own.

The root layout sets the standard Next title template:

```ts
title: { default: site.name, template: `%s · ${site.name}` }
```

and the catch-all route's page title filled its own fallback in full:

```ts
const title = clean(silicaPage.seoTitle) ?? `${silicaPage.name} · ${site.name}`;
```

so the template appended a brand to a string that already had one. It only shows
on a page with NO hand-written SEO title — which is every page anyone has just
made, and the moment a title matters most is the moment it is first shared.

Both branches of that route did it (silica pages and Builder pages), and the CMS
branch had the same shape one step further along: its last fallback is the site's
own name, which the template would have rendered as `Thistle & Rye · Thistle &
Rye`.

## The fix

The page title is now just the page's name and the template owns the suffix.

`openGraph` is handled separately, because it has no template and a social card
is seen with none of the site around it — so `ogTitle` keeps the brand
explicitly. The CMS branch's site-name fallback uses `{ absolute: site.name }`,
which is Next's own way of saying "this is the whole title, not a page within a
site".

Checked the rest of the storefront: no other route doubled up — `/products`,
`/cart` and `/search` were already passing bare page titles through the template.

## Confirmed

`document.title` → **`Collection orders · Thistle & Rye`**
`og:title` → **`Collection orders · Thistle & Rye`**
