# 851 — Four of my seven websites were live, and none of them was mine

**Status:** fixed
**Severity:** **major** — public web pages, under a real business's name, telling
its customers to edit their homepage
**Found by:** P03 · act 296, opening the one screen that shows all of her sites
**Surface:** The tenant site renderer's starter, and every console screen that
says whether a site is live
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the four sites on screen in the console, and the starter read
back from the live site at three of its addresses

## What she was told, and what was true

Devi Raman runs Juniper Row and has **seven sites**. The publish screen, opened on
her Trade site:

> Your website has never been published. **Nobody can see it yet.**

In the next tab, `trade.juniper-row.piggles.site`, at that moment:

> # Your work, beautifully online.
>
> Publish your pages, tell your story, and sell when you are ready. All from one
> place. **This is your homepage; edit every word to make it yours.**
>
> ## Shop our products
>
> The Everyday Tee $42.00 · The Ash Overshirt $128.00 · Marlow Knit $96.00 …

A full website. Her nav, her name in the browser tab, her real clothes at her real
prices, and an **Add to cart** that works. The headline is an instruction to her,
printed for her customers.

**She had never opened three of those four sites.** Trade has no pages at all.

## The fallback is right. Nothing said it was happening.

`wizeworks/apps/site` serves the code starter at any address whose site has
published no tree of its own, and says why (`lib/silica.ts`): _"a fresh tenant's
site is live from day one instead of blank"_. That is the correct call. A business
that signs up at nine and tells a customer at ten should not hand out a blank page.

The platform had even written the rule down properly, in `site-service`:

> Whether a VISITOR can reach this page right now — **wider than "published"**,
> because the platform draws a standard design at record addresses and at every
> starter address. **A page can be saved, unpublished, and read by the whole
> world.**

One service knew. The sentence a business owner actually reads said the opposite,
and a test underneath it pinned the wrong sentence in place with a comment
asserting it was _"already true whether the lights are on or off"_.
[[feedback_a_promise_in_copy_is_a_contract]]

## How many

```
35 sites have a live web address and have published nothing
   of those, 25 belong to real businesses (10 are WizeWorks' own e2e rows)
    4 are Devi's
    1 is The Marrow Review's PRIMARY site
```

The Marrow Review is the magazine from
[849](849-a-magazine-published-the-platforms-marketing-under-its-own-name.md), and
the two issues are the two halves of what a stranger read there. 849 is the
example **content** a design install copied in — the articles and the products.
This is the **pages those rows were drawn on**, which the magazine never published
and could not have known about.

And the count runs the other way too. The sites list said **"Not published yet"**
for a site with no web address, which is a different fact wearing the same words:
two sites on this database are fully published, twenty and nine pages each, and
were being told they were not.

## Every word on the starter was addressed to the owner

Not one sentence, five, and the last two are on every page of every starter site:

| where              | it said                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Home, headline     | "Your work, beautifully online. … This is your homepage; edit every word to make it yours." |
| Home, closing      | "Ready when you are. Add a product, publish a page, or invite your team."                   |
| About, cards       | "What you can do here · Publish · Sell · Grow"                                              |
| About, body        | "Replace this text … You can add sections, images, and links from **the builder**."         |
| Contact            | "**Tell visitors** the best way to reach you: an email, a phone number, or a form."         |
| Footer, every page | "Everything you publish and sell, in one place."                                            |
| Book, empty        | "Once services are open for online booking, they'll appear here."                           |

Three of them name a tool the reader cannot open. One is the platform's own pitch
under the business's name. One tells a customer standing on the Contact page to
tell visitors how to reach her. The About cards are **Piggles' feature list**, on a
clothes maker's About page: a customer reads it as Juniper Row offering to build
them a website.

The footer's sibling line had already been through this once — the newsletter blurb
was a design studio's copy, seeded onto a bakery and a wine merchant, and its fix
comment is four lines above the line that was still wrong.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

**Every word on the starter is now addressed to the VISITOR**, because the visitor
is the only person who can reach that page. It stays neutral — no trade assumed,
nothing claimed about a business the platform knows nothing about — and the name
above it is already hers, because the navbar brand is the live `site.brand` host
core.

```
Welcome.
Thanks for stopping by. Have a look around the shop, and get in touch if
there is anything you would like to ask.
```

Telling her the page is editable is the **console's** job, and the console now does
it, in the two places she would look:

**The publish screen**, which had the sentence exactly backwards:

> Your website has never been published, so **visitors are seeing a starter page
> rather than your own.**

A suspended site keeps a sentence saying nobody is seeing anything, because there
it is true.

**The sites list**, which is the only screen showing every site at once, and which
printed a clickable address for each and stopped:

```
Juniper Row Lookbook   juniper-row-lookbook.juniper-row.piggles.site ↗
                       Shows a starter page, not yours yet
```

Said under the **address**, not as a badge beside the role, because the address is
what makes the promise: a link labelled with a working host reads as "this is my
website". One statement, in the column that needed correcting.

It is fed by a new `publishedPageCount` on `GET /v1/properties` — a second grouped
count beside `pageCount`, on the same terms and for the same reason. "Has a visitor
ever been shown this" is a different question from "is this site empty", and a site
can be nine pages of work and no answer to the second. Undefined means **not
counted**, never none. [[feedback_never_present_absence_as_measurement]]

## Proved

**Proved red:** putting `'Your website has never been published. Nobody can see it
yet.'` back reddens exactly 2 of the 11 tests in that file, and leaves the 9 that
hold the rest of the rule. [[feedback_a_test_that_cannot_go_red]]

The test that pinned the old sentence is gone. The one that replaced it asserts the
live case does **not** say "Nobody", the dark case does, and the never-published
shape is now one of the inputs to the property test — it was the only branch that
returned the same string either way, so the property never reached it and the
branch was free to be wrong.

**On screen:**

| where              | before                                          | after                                                     |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| Publish, on Trade  | "Nobody can see it yet"                         | "visitors are seeing a starter page rather than your own" |
| Sites list, 7 rows | 7 addresses, no state                           | the same 4 the database names, each marked                |
| `trade.…` home     | "Your work, beautifully online"                 | "Welcome."                                                |
| `trade.…/about`    | "Replace this text … from the builder"          | two paragraphs in her business's voice                    |
| `trade.…/contact`  | "Tell visitors the best way to reach you"       | "We would be glad to hear from you…"                      |
| footer, every page | "Everything you publish and sell, in one place" | "Glad you found us. Get in touch any time."               |

**Checks:** typecheck clean on `silica-catalog`, `builder`, `api-rest`,
`apps/site`, and both workbenches. Tests: piggles workbench 140 files / 1317,
api-rest 33 / 269, site 10 / 159, builder 13 / 147, silica-catalog 37 / 1377 (its
one failure, `custom-colors.test.ts`, is red at HEAD and is not this). Guards:
`em-dashes`, `american-spelling`, `piggles-plain-words`, `console-parity`,
`copy-key-sentences`, `counted-in-words`, `action-labels`, `boundaries`. ESLint and
prettier clean on every touched file.

## Files

- `wizeworks/packages/silica-catalog/src/site.ts` (hero, closing band, About cards, About body, Contact)
- `wizeworks/packages/silica-catalog/src/site-chrome.ts` (the footer blurb on every page)
- `wizeworks/apps/site/components/booking/booking-services.tsx` (the public empty state)
- `wizeworks/packages/builder/src/services/site-service.ts` (a comment quoting a headline that no longer exists)
- `wizeworks/services/api-rest/src/routes/v1/properties.ts` (`publishedPageCount`)
- `piggles/apps/workbench/surfaces/studio/publish-words.ts` + `.test.ts`
- `{piggles,sparx}/apps/workbench/surfaces/sites/sites-list.tsx` + `data.ts`

## The thing to remember

**"Not published" was being read as "not visible", and the platform had already
written down that they are different.** The word sat in one service's comment,
stated exactly, while the screen a business owner reads said the opposite and a
test held it there. Nobody had put the two sentences beside each other — which is
the same shape as 850, where a four-word comment outranked five screens because it
was the only copy the writers consulted.

And the copy underneath: **a starter page has two audiences and can only address
one.** Every sentence on it was written by somebody picturing the owner opening the
builder, which is the moment they were thinking about, and not one was written by
somebody picturing a customer arriving at the address.
