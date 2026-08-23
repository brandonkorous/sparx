# 101 — Her salon's website put another company's logo in the browser tab

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** the published site — every page
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on the live site 2026-08-22

## What happened

Every page of Halo & Hem's website carried this, from the day it was published:

```html
<link rel="icon" href="/sparx-icon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon.ico" sizes="any" />
```

The **sparx** mark. In the browser tab of a Piggles customer's own website, in the
bookmark when a client saves it, and in the history list when they come back — a
company Nia has never heard of, on the site she is about to print on a card.

It was on the homepage, the booking page, the contact page and the 404, because it
is in the site layout and applies to every route.

## Why it matters

This is the sparx-product leak that piggles/CLAUDE.md RULE #0 exists to stop, and
it is on the **customer's** side of the glass — the worst place for it. Every
earlier instance found in this run
([090](090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md),
[091](091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)) was
inside the console where only the owner sees it or was fixed before publication;
this one has been shipping to every visitor of every unbranded tenant site on the
platform.

It is also invisible to the owner in the way that costs most: a favicon is the one
piece of a site's chrome nobody looks at while building it
([[feedback_absent_behaves_like_fine]]). Nia would only ever notice it on somebody
else's phone.

## How to reproduce

Every time, on any tenant that has not uploaded a favicon.

1. Open the published site.
2. Look at the browser tab, or read the page source for `rel="icon"`.

## Where it lives

[wizeworks/apps/site/app/layout.tsx](../../../../wizeworks/apps/site/app/layout.tsx),
in `generateMetadata`. The decision is stated in the comment above it:

```ts
// The tenant's own favicon always wins. Until they set one, fall back to
// the sparx mark (public/) rather than the browser's default globe — a
// brand-new site still looks finished.
icons: favicon
  ? { icon: favicon }
  : {
      icon: [
        { url: '/sparx-icon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
    },
```

It is a deliberate choice, made when sparx was the only product, and it reasons
about **finish** rather than about **whose brand it is**. The same fallback also
sat on the "Site not found" and suspended-site metadata, both of which are served
on a tenant's own host.

## The fix

**No vendor mark. The tenant's own favicon, or nothing.**

```ts
...(favicon ? { icons: { icon: favicon } } : {}),
```

The browser's own default is the honest fallback: it says nothing, which is the
correct amount for a site whose owner has not chosen a mark yet. A default globe
for a week costs a new site very little; another company's logo in the tab costs
it the thing a favicon is for.

The two error-page fallbacks went with it, for the same reason — a suspended site
is still served on the tenant's domain.

**Brand-blind, deliberately.** The obvious alternative — look the platform brand up
and serve Piggles' mark to a Piggles tenant — was not taken: it fixes whose logo it
is and not the fact that it is a logo the business did not choose. The better long
term answer is a generated letter-mark from the site's own name and accent, the way
`/api/og` already draws its social card; that is a bigger build and is not needed
to stop the leak.

## Confirmed by

Re-run on the live site 2026-08-22: `rel="icon"` is absent from Halo & Hem's pages
entirely.

Then, as Nia, closing it properly rather than leaving her site iconless: uploaded a
mark (a brass ring over an ivory H, in her own theme colors) from
Your site › Logo & favicon, and the live pages now carry
`<link rel="icon" href="…/v1/public/media/c69c440d…">` — her own.

## Rating effect

`My Site › Your site` and the published site are scored in [rating.md](../rating.md).
