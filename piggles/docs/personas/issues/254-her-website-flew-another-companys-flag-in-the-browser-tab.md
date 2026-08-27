# 254 — Her website flew another company's flag in the browser tab

**Status:** fixed
**Severity:** major
**Found by:** Brandon, mid-run — noticed while act 11 had her published site open
**Surface:** every tenant website, both brands › the browser tab, the bookmark bar
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi's shop tab said **Juniper Row**, and the icon beside it was a small Ember
square with a dark "x" in it: the **sparx** mark. Not Piggles. Not hers. The mark
of a company she has never heard of, on the website she sells from.

Every tenant of both brands had it, on every page, unless they had uploaded a
favicon of their own.

## What should have happened

A customer's website carries the customer's identity and nobody else's. This is
[RULE #0](../../../CLAUDE.md) — Piggles tenants must never see sparx, and it goes
further than that: a tenant site should not carry the PLATFORM's mark either,
whichever platform it is. The tab is the tenant's.

## Why it matters

- **It is the one asset nobody thinks to check.** You look at your header, your
  colors, your logo. The favicon is 16 pixels in a strip of browser chrome, so it
  is the last thing anyone audits and the first thing that sits there for months.
- **It was the wrong company entirely.** Not a platform credit in the footer,
  which is disclosed and deliberate — a foreign logo in the tab of a site whose
  owner signed up with a different product.
- **It followed people home.** A favicon is what a bookmark shows. Every customer
  who bookmarked a Piggles tenant's shop got the sparx mark in their bookmark bar,
  permanently, with no way for the owner to know.
- **The console PROMISES otherwise.** Site identity opens with "The name, logo,
  and links people see across juniper-row.piggles.site — its header, footer, and
  **browser tab**." The screen makes the claim; the site did not honor it.

## Where it lives

The fix for this had already been half-written, and the half that was missing is
the whole lesson.

[layout.tsx](../../../../wizeworks/apps/site/app/layout.tsx) was careful. It emitted
an icon only when the tenant had chosen one, and its comment explained exactly
why, in as many words: _"a Piggles salon's site advertised sparx, a company its
owner has never heard of"_. The reasoning was right and the change was real.

But `wizeworks/apps/site/public/favicon.ico` was still on disk — the sparx mark, 1,981
bytes, at the exact path every browser asks for **when the document does not
declare an icon**. Emitting no icon did not mean the browser drew nothing. It
meant the browser fell back to the convention, and the convention was answered by
the very file the fix was written to stop serving.

```
head:            (no <link rel="icon">)          ← the fix
GET /favicon.ico  200  image/x-icon  1981 bytes  ← the sparx "x"
```

**A deletion in the code was undone by a file the code never mentions.** Nothing
imported it, nothing referenced it, `grep` for "favicon.ico" across the app
returned nothing — and it shipped on every tenant domain regardless, because
`public/` is served by path, not by reference. The comment describing the fix and
the behavior on the wire disagreed for as long as that file existed.

A second sparx asset, `public/sparx-icon.svg`, was reachable the same way on every
tenant domain. Unreferenced, so equally invisible, and equally served.

## The fix

`public/favicon.ico` and `public/sparx-icon.svg` are deleted, and
[app/favicon.ico/route.tsx](../../../../wizeworks/apps/site/app/favicon.ico/route.tsx)
now owns the path. Two answers, both the tenant's own:

| the tenant      | `/favicon.ico`                                  |
| --------------- | ----------------------------------------------- |
| chose a favicon | 307 to their image                              |
| chose none      | their INITIAL, drawn on their own primary color |
| unknown host    | 404 — no owner to speak for                     |

The generated initial is Brandon's call, taken against two alternatives. Blank was
the first instinct and is honest, but it says nothing and makes every unbranded
site's tab identical — an owner with her own site open beside two others cannot
pick hers out. Falling back to the Piggles mark fixes the wrong-BRAND half while
keeping a second company on a customer's screen, which is the thing that caused
this.

A letter in the owner's own color is unmistakably her site, looks finished, and
puts nobody else's logo anywhere. Juniper Row draws a **J** on her `#c77618`;
Thistle & Rye a **T** on their green; Threadline a **T** on their red. Same shape,
never the same mark.

It also happens to be the only one of the three that a shared package is allowed
to do. `wizeworks/` may not branch on brand ([wizeworks/CLAUDE.md](../../../../wizeworks/CLAUDE.md)
RULE #0), so "show the Piggles mark to Piggles tenants" would have required the
exact conditional the boundary forbids. Drawing the TENANT's identity needs no
brand awareness at all.

`layout.tsx` now always declares an icon — the upload directly, so the CDN caches
the image rather than a redirect to it, and `/favicon.ico` otherwise — so the
generated mark is stated rather than left to a browser convention. That convention
being load-bearing and unstated is what this issue was.

## Confirmed

Driven on the running site, all three branches:

```
Juniper Row    (chose one)   307 → …/media/2161e0cb…      then 200 image/jpeg
Thistle & Rye  (chose none)  200  image/png  374 bytes    a "T" on their green
Threadline     (chose none)  200  image/png  369 bytes    a "T" on their red
unknown host                 404
/sparx-icon.svg              404
```

And in the document head, where the promise is made:

```
Juniper Row     <link rel="icon" href="...media/2161e0cb...?tenant=juniper-row">
Thistle & Rye   <link rel="icon" href="/favicon.ico">
```

Devi's own favicon was set through the console the way she would have — Site
identity › Logo & favicon › Choose a picture › Save — and it reached her site's
tab. The pane's promise about the browser tab is now true.

`check:boundaries` green. Typecheck, lint and prettier clean on both files.

## Also seen while here, not filed

- The site caches its tenant payload for five minutes (`revalidate: 300` in
  `resolveSite`), so a newly chosen favicon does not appear for up to that long.
  Deliberate, and the cache is tagged (`tenant:<slug>:<property>`), so the save
  could purge it. Left alone: it is a delay, not a wrong answer.
- `properties.brand_override.businessName` for Juniper Row reads **"Saffron &
  Sage Catering"** — a leftover from whatever blueprint seeded her. Nothing shows
  it today, which is the only reason it is not its own issue.
- `wizeworks/apps/site/public/test-supplier-feed.csv` is served on every tenant
  domain. Not brand, so not this issue, but it is a test fixture on customers'
  websites.

## Related

The same shape as [253], one layer out: a careful fix, correct where it was
written, walked past by a path nobody had listed. There the storefront's
"never print could-not-answer as nothing-to-sell" branch was bypassed; here the
"never emit the platform mark" branch was.

## Rating effect

The published site, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
