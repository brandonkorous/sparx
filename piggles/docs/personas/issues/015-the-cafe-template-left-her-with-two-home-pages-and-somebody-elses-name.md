# 015 — The café template left her with two home pages, an empty one, and somebody else's business name

**Status:** partly fixed — the duplicate home page is [017](017-the-deleted-home-page-came-back-21-milliseconds-later.md) and is closed; the empty page's tree format and the borrowed business name are still open
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7
**Surface:** mypiggles › My Site › Page · Publish — after a blueprint install
**Filed:** 2026-08-19
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope, for what remains — the two open parts are in the blueprint installer, not in a screen. What they would take is written up below.

## What happened

Marisol picked **Café** as her look during onboarding, which installed
`sparx-restaurant-cafe`. She opens **My Site → Page** to start writing, and finds
six pages:

| Page               | Address        | State                     |
| ------------------ | -------------- | ------------------------- |
| **Home — Landing** | **no address** | **empty — nothing on it** |
| **Home**           | **no address** | the café template's home  |
| Menu               | `menu`         | café template             |
| Book               | `book`         | café template             |
| About              | `about`        | café template             |
| Contact            | `contact`      | café template             |

Three things are wrong at once, and the product's own pre-publish check names the
first one before she can:

> **Visitors will see this go wrong**
> **2 pages are all set to be your home page.** Home — Landing, Home all answer to
> `/`. Only one of them can — visitors will get whichever the site happens to
> reach first, and the others cannot be opened at all.
>
> We could not look at **Home — Landing** — it has never been opened and saved, so
> there is nothing there to check yet.

**1. Two home pages.** The starter created "Home — Landing"; the blueprint then
added its own "Home". Neither has a slug, so both claim `/`. Nothing is marked as
the default page at all — `is_default` is false on all six rows.

**2. One of them is empty and cannot be edited.** "Home — Landing" opens in the
builder showing only the header, with the status line _"Nothing saved on this
page yet."_ It has a 4.4 KB `draft_tree` and an **empty `silica_draft_tree`**,
while the blueprint's five pages have the reverse. Two page formats in one site,
and the editor renders the one the starter's page does not have.

**3. Every page is titled after a business that does not exist.** The SEO titles
the installer wrote:

```
Home     Kettle & Crumb — a sunny all-day café
Menu     Menu — Kettle & Crumb
Book     Book — Kettle & Crumb
About    About Kettle & Crumb — the café
Contact  Visit — Kettle & Crumb
```

The site's own tagline was set to **"A sunny all-day café."** and the home page's
`<h1>` reads **Kettle & Crumb**. The installer clearly knows the business is
called Thistle & Rye — it put that in the site name, the header wordmark and the
browser tab — and it did not put it anywhere the customer reads.

## What should have happened

One home page, with content, set as the default, and titled after her business.

Piggles' whole promise for this step is _"You answer two questions. It arrives set
up."_ — and RULE #8 is explicit that a template with the words unchanged is not a
site. Arriving with two colliding home pages, one of them blank, is a worse
starting point than an empty site would have been, because it looks finished.

## How to reproduce

Every time, any trade:

1. Sign up, and in onboarding pick any look that is **not** the Universal Starter.
2. Finish. In the console open **My Site → Page**.
3. Two pages with no address, one of them empty. **Publish → Check my site** says
   so.
4. `select name, slug, is_default from builder_pages where tenant_id = …` — six
   rows, two with a null slug, none default.

## Why it matters

She chose a look and did not get it. The public site currently serves neither
template: with nothing published and no default page, `/` falls back to a generic
placeholder that says **"This is your homepage; edit every word to make it
yours."** — under her real products at her real prices. A stranger reaching her
address today reads a sentence addressed to her, not to them.

And the SEO titles are what search results and browser tabs show. A bakery whose
every page is titled after a café in the template catalogue is a real problem
that only shows up weeks later.

## Where it lives

**Both suspects below were wrong, and the audit log says so.** They are kept here
because being wrong in a specific, checkable way is what made the real cause findable:

- ~~`blueprint-installer.ts` installs the blueprint's pages without reconciling them
  against the pages the industry starter already created.~~ The starter never created
  "Home — Landing". `builder.pages.home_ensured` did, at **00:25:42** — fifty-five
  minutes after the blueprint installed at 23:30:01, on an ordinary read of the page
  list, from nothing the owner did.
- ~~The starter/seed path that creates "Home — Landing".~~ Same correction.

The real cause is `pageService`'s home-page test, which recognised a slug of `NULL`
but not `''` — the spelling every blueprint writes. It therefore read a site that had
a home page as home-LESS and injected a second one. Written up in full, with the
audit-log timestamps, as
[017](017-the-deleted-home-page-came-back-21-milliseconds-later.md); **fixed**, for
every tenant rather than only for this one.

The **format split** — one page in the legacy `draft_tree` and five in
`silica_draft_tree` — is still real and still unexplained. It now has a much simpler
reading: the injected page came from `STARTER_PAGES`, which is a legacy-tree source,
while the blueprint writes silica. It is the same defect wearing a second costume, and
worth confirming once no more legacy pages are being injected.

## Why this is not fixed inside this run

Personas CLAUDE.md — _"a fix bigger than the surface under test."_ This is not a
screen; it is the install pipeline that every one of the ten personas walks
through, and getting it wrong a second way would be worse than leaving it
described. What it needs:

1. ~~**Decide who owns the home page** when a starter and a blueprint both create
   one.~~ **Done** — nothing was competing. One test could not see the other's home
   page; it can now ([017](017-the-deleted-home-page-came-back-21-milliseconds-later.md)).
2. ~~**Always set a default page** at the end of an install.~~ **Not needed, and the
   premise was wrong.** A Piggles site's home page is the singleton with no address,
   not the row with `is_default` — `is_default` picks between record templates. Her
   site has had exactly one home page since the injected one was deleted.
3. **Substitute the business name** into the copy the installer writes — at
   minimum the SEO titles and the site tagline, which are pure metadata and carry
   no design risk. The hero `<h1>` is a judgement call: replacing "Kettle & Crumb"
   with "Thistle & Rye" is right, replacing the paragraph under it is not, and a
   half-substituted page may read worse than an obviously templated one.
4. **Resolve the two tree formats**, or make the starter write the one the editor
   reads.

The pre-publish check already catches (1) and explains it well — that part of the
product is working, and it is what turned this from a mystery into a diagnosis.

## What happens to her site — in progress

Marisol resolves her own site by hand, which is what the checker tells her to do.

**Done:** the empty "Home — Landing" is deleted, which took building a delete first
([016](016-the-check-told-her-to-delete-a-page-and-nothing-could.md)) and then stopping
the server re-creating it
([017](017-the-deleted-home-page-came-back-21-milliseconds-later.md)). With it gone,
the café's **Home** is the only page with no address, so it IS the home page — no
second step needed.

**Still to do:** rewrite the five template pages in her own words and fix the five SEO
titles that read "Kettle & Crumb", plus the "A sunny all-day café." tagline in Site
identity.

The first half was a repair of the PRODUCT — the next persona will not arrive at two
home pages. The rewriting is a repair of **her** site only; the next persona will
still be handed somebody else's business name.

## Rating effect

mypiggles › My Site › Page — Ease 5: the list is clear and the pre-publish check
is genuinely good, but what it is listing should not have been there.
mypiggles › My Site › Publish — Design 8, Ease 9; "Check my site" found the real
problem, said it in her words, and told her the two ways out.
