# 632 — My footer's social column was a grey box saying "live region"

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 214
**Surface:** mypiggles › My Site › Header & footer (and every page with a cart or a grid)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 214 (seen on screen, before and after)

## What happened

My Site › Header & footer. My footer has four columns: my name and address,
Explore, Account, Legal. Between the address and the legal links sat this:

```
● Social links · live region
  ▬▬▬▬▬▬▬▬▬
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  ▬▬▬▬▬▬▬▬▬▬▬▬▬
```

A dashed box with three grey bars in it. I do not know what a "live region" is.

The box was **146px tall**, in a column whose legal links are 116px, over a live
footer that draws a row of two small round icons about 32px high. So the thing I
was styling my footer around was a shape my site will never have.

And my Instagram and my Pinterest were already sitting in the editor's own data.

## Why it happened

`makeRenderHostNode` splits the platform's pinned blocks two ways, and the split
is right:

- a CHROME core (brand, theme toggle, account link, legal links, pager) is small
  and lives in a navbar or a footer column, so it draws the **actual control**
- a TRANSACTION core (cart, checkout, search, product grid) genuinely fills a
  page-sized block, so a labelled skeleton is the honest preview

The file's own header comment explains this at length, then names the chrome
cores as a **hand-written list**:

> · CHROME cores (brand, theme toggle, account link, legal links, pager, embeds)

Six named. The catalog files **six** under `category: 'Your site'`, and social
links is the one that is not on the list. It fell to the transaction path by
default ([[feedback_a_fix_leaves_its_neighbour_behind]]).

sparx's copy of the same comment named **three**, so it was missing the account
link as well.

| category   | cores | drawn at real size, piggles | sparx |
| :--------- | ----: | --------------------------: | ----: |
| Your site  |     6 |                       **5** | **4** |
| Your media |     2 |                           2 |     2 |

And the data was in hand. `buildPreviewRoot` overlays `site.social` onto the
canvas root from the same chrome read that supplies the name and the logo — its
own comment says it overwrites the key **even when empty** — and nothing drew a
pixel of it ([[feedback_fetched_but_never_rendered]]).

```
properties.settings->'socials' for juniper-row/primary
  [{"platform":"instagram","url":"https://instagram.com/juniperrow"},
   {"platform":"pinterest", "url":"https://pinterest.com/juniperrow"}]
```

### The words on it

"live region" is a screen-reader term, borrowed here to mean "the platform fills
this in for you". It was on **every** skeleton, so it also read "Shopping cart ·
live region" on the Cart page and "Product listing · live region" on the Shop
page. The question an owner is actually asking, standing in front of a dashed box
full of grey bars, is whether her customers are going to see THIS.

## The fix

**The social row draws her accounts.** `SocialLinksMark` reads `site.social` from
the canvas root — exactly the way `BrandMark` reads `site.identity` — and draws
each one in the live footer's own classes (`btn btn-ghost btn-sm btn-circle`, a
`currentColor` glyph, no brand color, so it answers the site theme).

|              |          before |                       after |
| :----------- | --------------: | --------------------------: |
| height       |       **146px** |                    **32px** |
| what it says | `· live region` | her Instagram and Pinterest |

Empty accounts draw a **sentence, not a row**: the live footer renders nothing
until she adds one, so inventing three marks would show her a row she never chose.
Same shape `FrameMark` already uses for an unfilled map: say which, and name where
to fix it. "Add your accounts under Site identity to show them here."

**The account link is drawn in sparx too**, which was missing it.

**The skeleton label is in plain words.** `Shopping cart · the real one shows on
your site`. Not a promise about behavior, a fact about where the real one is
([[feedback_a_promise_in_copy_is_a_contract]]).

### The one it led to

The identity editor offers **ten** networks, under a comment reading "the
platforms a site footer renders a first-class icon for". The renderer has glyphs
for **eight**. WhatsApp and Bluesky fell through to the raw key, so an owner who
picked "WhatsApp" from a menu would get the word `whatsapp`, lowercase, in a row
of round icons.

Nobody uses those two yet (measured: 38 links across 7 platforms, none of them).
The artwork cannot be added without fetching it, and this file's own rule forbids
drawing a brand mark by hand — an earlier version shipped a Pinterest mark that
read as a keyhole. So the fallback now prints the **name the menu showed her**,
which is the half that was actually broken.

## Guard

**`pnpm check:host-cores`** — a new structural check, wired into `.githooks/pre-push`.

> Every host core the catalog files under a chrome category is drawn at its real
> size, in every console.

It is not a list anybody maintains: the categories come from the catalog, which is
also what the Add palette groups by. Output names its denominator:

```
check:host-cores — 8 chrome core(s) of 21 drawn at real size in 2 console(s).
```

Proven red by removing one branch from each console: **2 findings**, naming the
brand, the file and the category.

Its own reader went blind first and is worth recording. The initial regex matched
`key:` / `label:` / `category:` on adjacent lines, and four catalog entries carry
a paragraph of comment between them — so it read **17 of 21** cores, silently
dropped the map and the embed, and printed green. It now strips comments and
**asserts its own count against an independent count of `key:` lines**
([[feedback_structural_checks_go_blind]]).

**`platform-name.test.ts`, 13 tests per console.** The name resolution moved into
a leaf module with no React so the console's node test seat can pin it, and
`platform-mark.tsx` types its artwork against that module's key list — a platform
named with no glyph is now a **compile** error (proven: 2 errors).

One of those tests caught a break in this very fix. The normalization strips
punctuation, so `facebook_page` became `facebookpage` and matched nothing — and
every connected account on the Social screens is stored under a key like that.
The avatars would have gone blank on a screen this change was not about. A
canonical key is now checked before anything is normalized.

## Noted, not a defect

`/builder/page?id=…` renders the page LIST rather than the editor; the param is
`pageId`. A wrong parameter falling back to the list is reasonable behavior, not a
broken link.
