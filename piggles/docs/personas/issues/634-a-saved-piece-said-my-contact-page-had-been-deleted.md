# 634 — A saved piece said my Contact page had been deleted

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 215
**Surface:** mypiggles › My Site › Saved pieces, and the piece detail
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 215 (seen on screen, before and after)

## What happened

My Site › Saved pieces, standing in **Juniper Row Archive**. One piece:

```
Send me a message                                        [ Site-wide ]
The contact form. Lives at the bottom of Contact; reuse it on Trade if
we open wholesale.
```

That note is mine, and it is about a different shop. Nothing on the screen said
so. The list is identical on every one of my sites, which I only found out by
switching to one and looking.

Opening it, under **Where it's used**:

> Every page and layout this piece appears on. Click one to open it.
>
> 📄 Contact `Page`

**I have six pages called Contact**, one per site. So I clicked it. It said:

> **This page isn't here any more. It may have been deleted.**
> [ Pick another page ]

It had not been deleted. It is on Juniper Row, exactly where I left it.

## Why it happened

Three facts that never met.

**1. The library is tenant-wide.** The data layer's own header says so:

> This endpoint is TENANT-scoped, not property-scoped: a saved piece belongs to
> the whole business and can be placed on any of its sites … the pieces
> themselves are shared across sites.

Correct, and deliberate. But My Site is a per-site app end to end — pages,
header and footer, look and feel, publish all belong to the site in the
switcher — and Saved pieces is the one exception, with nothing on screen saying
so.

**2. Pages are per-site, and the where-used scan returned names.**
`scanUsages` runs `builderPage.findMany` with no property filter (right, because
the piece is shared) and selected `{ id, name }` (wrong, because the answer is
then ambiguous). Measured 2026-09-17:

|                                     |       |
| :---------------------------------- | ----: |
| her sites with pages                |     6 |
| **her pages named "Contact"**       | **6** |
| saved pieces platform-wide          |     8 |
| pieces currently placed on 2+ sites |     0 |

The last row is why nobody saw it: no piece is on two sites **yet**. The names
already collide, so the first one that is gives two identical rows under the
words "Click one to open it".

**3. Clicking opened it in the wrong workspace.** `ctx.open('builder.page', {
pageId })` carries no site, and a page id resolves within the active site only —
so the editor found nothing and said the one thing that is never true of a page
sitting untouched on another site ([[feedback_never_present_absence_as_measurement]]).

### And a badge that said the opposite of what it meant

`surfaceScopeTag` rendered **"Site-wide"** for a piece that may go in the site
chrome. "Site-wide" is a REACH, and on this product a reach is a real question:
the neighbouring Email designs screen spells that idea "All your sites". So the
one badge on the screen suggested the sharing that is real, while meaning
something else entirely, and the sharing that IS real went unsaid.

## The fix

**The rows say which site.** `ComponentUsageDto` gained `ComponentPlacementDto`
with `siteId` + `siteName`; `scanUsages` selects `propertyId` and resolves the
names in **one** read over the sites actually hit.

Said only when it tells the reader something, in three cases
(`saved-piece-usage-words.ts`):

| rows                      | active site      | names the site |
| :------------------------ | :--------------- | :------------- |
| all on the site she is in | known            | no             |
| spanning two sites        | anything         | **yes**        |
| one site, not this one    | known            | **yes**        |
| one site                  | not resolved yet | no             |

The last row matters: a claim that appears and then leaves as the shell resolves
is worse than a beat of silence. And when it is said it is said on every row —
a list where only some carry a site reads as though the rest have none.

**Clicking a row on another site switches to it.** Same conversation the site
switcher and the cross-business link already hold: confirm if anything is
unsaved (a switch reloads), then `switchSite` with the page's own address built
through `buildPath(surface, params, { site: slug })`.

|       |                                                       before |                                after |
| :---- | -----------------------------------------------------------: | -----------------------------------: |
| row   |                                                    `Contact` |          `Contact` / **Juniper Row** |
| click | _"This page isn't here any more. It may have been deleted."_ | **the Contact page, on Juniper Row** |

**The list says the library is shared** — but only to an owner who has more than
one site:

> These belong to your whole business, not to one site. A piece can go on any of
> your sites, and changing it here changes it everywhere it is used.

**The badge says where, not how far.** `Site-wide` → **`Header & footer`**, the
name of the screen those are edited on in this console, and the tab sparx's own
editor already uses for that mode.

sparx got the site on its rows and the shared-library line too. Its usage rows
are not clickable, so it never had the third half of the bug.

## Guard

**`saved-piece-usage-words.test.ts`, 10 tests per console.** The one that is a
rule rather than an example:

```ts
it('does not guess that one site is elsewhere', …)   // activeSiteId === null
```

Proven red by making a two-site list answer `false` and by shifting the
single-site threshold: **3 of 10** fail.

**`component-usage-sites.test.ts`, 5 tests** in the builder package. The mapping
is exported for it rather than reached through a transaction, because the
mapping is the part that can be wrong.

```ts
it('gives them different sites, which is the entire job', …)
it('still says which one, by id', …)   // a site row that has gone
```

Proven red by falling back to `''` instead of the id: **1 of 5** fails.

## Noted, not a defect

sparx's usage badge read `color="neutral"`, which piggles had already replaced
with a colorless badge and a comment saying why (RULE #4: "Page" and "Layout" are
two kinds of thing and grey says neither). Brought into line while in the file —
removing a `neutral` needs no approval, only adding one does.
