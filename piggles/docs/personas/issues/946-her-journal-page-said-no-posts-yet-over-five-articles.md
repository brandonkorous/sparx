# 946 — Her Journal page said "No posts yet" over five articles

**Status:** fixed (act 6)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 6, building the journal's front page and Journal
**Surface:** mypiggles › My Site › a page › Change › Settings (the page editor), her public site's lists, the editor's binding catalog (`@wizeworks/studio`, builder, builder-schemas, api-rest, the site)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P09 · The Marrow Review · act 6, `/journal` listing her five articles with their photographs and standfirsts
**Blocked on:** —

## What happened

Her design (Longform Literary) shipped its Home and Journal pages with lists of
**blog posts**. Rosalind writes **Articles**, her own kind (issue 945), and has no blog
posts at all.

- Both lists read "No posts yet" over a journal with five published articles.
- Nothing in the editor could change what a list showed. Selecting the list showed a
  layer called "Group" and its layout settings, and nothing else.
- A journal's sections (Field, Table, Ledger) are a choice on each article, and a page
  could list every article or none: there was no way to make a section page.
- In the same panel, "Words", "Goes to", "Kind of text" and the other boxes had a label
  above them that was not tied to them, so a screen reader announced an unnamed field.

## The fix

- **What this list shows.** Selecting a list of writing in the editor now offers, under
  Settings, every list this business uses: "Articles", "Articles in Field", "Articles in
  Table", "Articles in Ledger". Choosing one moves the list, its "nothing here yet" line
  and any pager naming it, as one edit she can undo (`retargetListOps`). The app supplies
  the choices (`host.listSources`); Piggles reads them off the binding catalog.
- **Only the kinds she uses.** The catalog marks a kind as used when the business made it
  or has written in it (`DataSource.used`), so the list does not offer "Careers in
  Internship" to a journal. The list's current choice always stays.
- **Section lists.** Each option of a single-choice field is its own list,
  `cmsWhere.article.section.field`, named "Articles in Field". The public entries read
  takes `where_field` / `where_value`; the site fetches, limits and pages it like any
  other list.
- **Cards built for posts read any kind.** A design's post card binds `title`, `excerpt`
  and `featuredImage`. Every piece of a kind now also answers to those, from its own
  headline, lede and picture (`withPostWords`), unless the kind has a field of that name
  itself. So the design's cards show each article's headline, standfirst and photograph.
- **Every box in the panel is tied to its label** (`FieldControl`), keeping the reset that
  stops a stale box writing an old value back.
- **A list of writing can be added at all.** Her new Field page offered "Article body"
  and nothing that lists anything: the live list block (`blogPostGrid`) existed and was
  never in the Insert panel. It is now, as **List of your writing** under "Your writing".
- **How many.** Beside "What this list shows": all of them a page at a time, or just the
  newest one, two, three, four, six, eight or twelve. Her file asks for a front page that
  gives the newest piece room rather than a grid; that is a list of one, one column wide.
- **The Publish screen says when the look is waiting.** Her chosen design's look
  ("broadsheet") was saved and never published, so her live site wore the starter's.
  The screen counted pages only. It now reads "18 pages have changes, and the look of
  your site has changes that visitors are not seeing yet" (`themeUnpublished` in the
  publish state), and starts with a capital whichever part comes first.
- **A failed read is not an empty answer.** The editor's list of her kinds was caught
  into "no kinds" when its request failed, and cached as that for five minutes. While the
  API restarted, her lists offered nothing to choose. It now retries, and stays a failure
  until it succeeds.

## Proof

- `retarget-list.test.ts` (studio), 4: the list, its empty line and its pager move; the
  cards inside and another list's empty line do not. Leaving the empty line behind
  reddens 1.
- `list-sources.test.ts` (Piggles), 3: only used kinds, the current one kept, nothing for
  a product list. Dropping the used filter reddens 2.
- `cms-where.test.ts` (builder-schemas), 3: one list per option, named in her words,
  fetched with its own limit. Not offering them reddens 1.
- `kind-pieces.test.ts` (site), 2 new: an article's standfirst and photograph reach a
  post card; a kind's own `excerpt` is never overwritten.
- `publish-words.test.ts` (Piggles): the look waiting, alone and with pages. Leaving it
  out of the sentence reddens 1.
- On screen, as Rosalind: Publish screen read the sentence above; **Publish everything**;
  her articles now set in Playfair Display headings and Spectral body at 18px, as her
  file asks.
- Typecheck clean: studio, builder-schemas, builder, api-rest, the site, the Piggles
  console. 201 studio tests, 373 builder-schemas tests, 400 site tests pass.
- On screen, as Rosalind: **Field**, **Table** and **Ledger** made from the page list, each
  with List of your writing pointed at its section and a heading and standfirst of her
  own; `/field` lists her two Field pieces, `/table` one, `/ledger` two. Home shows just
  the newest piece, full width (`limit: 1` stored and published).
- On screen, as Rosalind: her Journal page, the list selected, Settings: **What this list
  shows: Blog posts**. Chose **Articles**, changed the heading from "The Meridian" to
  "Journal" and the lede to her own sentence, saved, published. `/journal` lists all five
  articles, newest first, each with its photograph, date, headline and standfirst, each
  linking to `/articles/<name>`.

## Still open

- The design's placeholder text for a post's summary reads "The short summary of this
  post, written in the CMS." It is seen only in the editor, but "CMS" is a word she does
  not use. It sits in over a hundred shipped designs; changing it is a regeneration of
  every bundle and offers each site using one a design update, so it goes with the next
  catalog regeneration rather than as a sweep in a persona run.
- The sparx console's page editor is a different editor (silica's own builder) and was
  not given the choice; it was not checked whether it already offers one.
