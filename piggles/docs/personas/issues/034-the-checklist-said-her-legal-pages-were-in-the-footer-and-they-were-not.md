# 034 — The checklist said her legal pages were linked in the footer, and they were not

**Status:** fixed for new sites + fixed for her; the CHECKLIST still reads the
wrong thing — see **What is still open**
**Severity:** major (a compliance surface reporting done when nothing renders)
**Found by:** P01 · Thistle & Rye · act 8 — reading the published site
**Surface:** mypiggles › Content › Legal pages, and the tenant's live footer
**Filed:** 2026-08-20
**Fixed:** 2026-08-20 (partly)
**Confirmed by:** P01 · act 8, on the screen

## What happened

Content › Legal pages, in green:

> **Your required pages are all set**
> Every page you are expected to have is published, up to date, and linked in
> your footer.

Her live footer had no legal links at all. Not a broken one — none.

## Why it happened

`getLegalChecklistTx` decides `placed` from a `SiteDocPlacement` row, which
`createLegalPageTx` writes when it scaffolds the page. That row is a tenant
setting. It says nothing about whether the footer can render anything.

Rendering needs a `site.legal-links` HOST CORE in the frame — the layout passes
`legalLinks` to `SiteHostRenderer`, and only that core lists them. Her footer had
none, and could not have had one:

```ts
// site-chrome.ts — siteFooter()
col3: null,
link9: hostCore(HOST_KEYS.siteLegalLinks),
```

`fillSlots` fills only slots the chosen block HAS. The `newsletter` footer variant
has no `link9`, so the legal column was dropped on the floor — and the code said
so, in a comment that treated it as a curiosity:

> the legal-links `link9` and the columns-only `link10..15` keys simply find no
> slot in that block and are ignored

Her café blueprint uses the newsletter footer. So did every tenant who picked a
look with that footer: no privacy link, no terms link, no cookie link, and a
checklist telling them it was all in hand.

## The fix

**New sites.** `siteFooter` now APPENDS the core after the fill
(`ensureLegalLinks`) instead of relying on a slot that may not exist, and is a
no-op when the fill already placed it, so the `columns` footer is byte-identical.
Legal links are not decorative chrome a variant may opt out of.

**Her site.** The core IS in the Insert palette ("Legal links", under Your site),
so this was reachable by hand: inserted into her footer, given the footer's own
container padding, published. Her live footer now lists Privacy Policy, Terms of
Service, Cookie Policy, Return Policy and Refund Policy.

**Not done:** teaching `upgradeFrameChrome` to add the column to an existing
footer that has none. Tried, and reverted. That healer's contract — asserted by
its own tests — is that it returns the frame UNTOUCHED unless it finds a stale
shape it knows how to repair, and one of those tests exists precisely to protect
a footer where the author wired their own legal link. Healing ABSENCE breaks that
invariant, and quietly appending a column to somebody's footer is the platform
overreaching in exactly the way that test guards against.

## What is still open

**The checklist is still reading the wrong thing.** `placed` remains a placement
row, so it will keep saying "linked in your footer" for any tenant whose frame
has no `site.legal-links` core. Her site is right now, but the LIE is not fixed —
it just has nothing to lie about here any more.

The honest version reads the frame: `placed` should be "there is a placement AND
the published frame can render it", and the row should otherwise say so and point
at the Insert palette. That means `cms` reading `builderLayout`, which is a
layering decision rather than a patch, and it is Brandon's call.

This is the [never present absence as measurement] rule almost verbatim: a green
tick derived from a row instead of from evidence that anything renders.

## Confirmed by

Live site, hard-reloaded, 2026-08-20 — footer reads **Legal · Privacy Policy ·
Terms of Service · Cookie Policy · Return Policy · Refund Policy**, inside the
footer's own container. `silica-catalog` 1144 tests green after the `siteFooter`
change.

## Rating effect

None recorded yet.
