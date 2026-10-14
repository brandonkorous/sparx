# 945 — Her articles had an address and no page

**Status:** fixed (act 6)
**Severity:** blocker
**Found by:** P09 · The Marrow Review · act 6, opening her first published piece on her own site
**Surface:** her public site (`apps/site` catch-all), mypiggles › Content › a kind's settings, mypiggles › My Site › Pages (both consoles), the sitemap, the RSS feed and site search (`api-rest`)
**Filed:** 2026-10-07
**Fixed:** 2026-10-08
**Confirmed by:** P09 · The Marrow Review · act 6, `/articles/the-last-mill-on-the-nene` read as a reader
**Blocked on:** —

## What happened

Rosalind's journal publishes pieces of her own kind, **Article**: a standfirst, a
hero image with a caption and a credit, a section, and the body. Its settings have a
box called **Web address pattern**: "Where these appear on your site." She had four
articles published.

- `/articles/the-last-mill-on-the-nene` was a **404**. The website served pages and
  blog posts and nothing else: a page design could show a product or a blog post,
  never a kind somebody made.
- The same was true of every built-in kind with a pattern: Event, Job posting, Help
  article, Case study, News article, Team member, Announcement.
- The sitemap, the RSS feed and site search all printed links from the pattern
  anyway, so every link they gave a reader or a search engine to a piece of one of
  those kinds was dead.
- The entry editor knew, and said "Your site has no page for this kind yet" under
  every address it printed.
- Her pattern itself had been stored as `C:/Program Files/Git/articles/{slug}`: the
  shell on the test machine rewrote what was typed. Nothing refused it, because
  nothing checked a pattern at all.

## The fix

**A kind's pieces are served at the address its pattern gives them.**

- The website's catch-all asks for the piece at any path no page owns
  (`GET /v1/public/content/entries/by-path`). A pattern is servable when it is
  `/<lowercase words>/{slug}` and its first word is not one the website already routes
  (`kindAddressFromPattern`). `/{slug}` stays the pages' own.
- **Each kind gets a page in her page list**, "Each article", at `/articles/:slug`,
  made from the kind's own fields (`contentKindPage`): headline, standfirst, the
  picture with the text fields written after it as its caption lines, the date,
  byline and her section as facts, the body, labelled details for the rest, and
  "More articles" with the kind's four newest other pieces. Every node is bound to a
  field the kind has, so no placeholder words reach a reader, and she can restyle it
  like any other page. Until she publishes her own design, the website draws this one.
- **The page's settings say where pieces live**: "Each article gets its own address:
  /articles/ followed by its web address name."
- **Preview** on "Each article" opens one of her published pieces.
- **Cards that list a kind link to its pieces**, show its pictures as pictures and its
  choices by their label ("Ledger", not `ledger`), on both page tiers.
- **The sitemap, feed and site search** link a piece only where the website serves it
  (`entryPublicPath`). A pattern it cannot serve gets no link instead of a dead one.
  The feed reads a kind's headline and summary from its own fields.
- **The pattern is checked when saved**, by the console as she types and by the
  server (`urlPatternProblem`) for every writer, with the reason in plain words. Two
  kinds may not share an address. A test in api-rest holds the save rule and the
  website's rule to the same answer for 54 patterns.
- **The entry editor** says "This will live at /articles/…" for a kind the site
  serves, and keeps its warning for one it cannot.

## Found in the same act

- **Dates on the business's clock.** A piece she published at 06:00 on October 1 in
  England read "September 30": the website formatted every date on the server's
  clock (Pacific here). The site now reads the business's time zone (Business
  details, carried on the public site payload) and prints every post, article and
  card date on it, UTC when none is set. A date with no time is that calendar day on
  every clock.
- **One date style per page.** The piece read "October 7, 2026" over cards reading
  "8 October 2026". Both follow the site's own language setting now.
- **The page list said Shop, Cart, Products and Book were live** on a site that had
  switched Selling and Bookings off (issue 944). It now says **Off on this site**,
  from the same table the website enforces, which moved to `@wizeworks/silica-catalog`
  so the list and the routes read one answer (`site-module-paths.ts`). Sign-in pages
  stay live, because the site still serves them.
- **The design's blog-post page was called "Article"**, one row above "Each article".
  The platform renames it "Each blog post", but only the sparx console ran that step;
  the Piggles page list runs it now too.
- **Search was a 404 on a site that sells nothing**, so a reader could not search her
  writing. `/search` belongs to the whole site now; on a site without a shop it shows
  pages and articles alone, under "Search this site…". On a shop the strip above the
  products is headed "Elsewhere on this site", since articles land there too.
- **The API still said Bookings could not be switched off for one site** (written
  before issue 944). Fixed in `siteChromeOptions`.

## Proof

- `content-kind-page.test.ts` (silica-catalog), 9: her Article kind laid out and
  rendered with a real piece; no placeholder words; the picture and its lines drop
  when absent; the end list links and limits to four. Misplacing the standfirst
  reddens 1.
- `record-templates.test.ts`, 6 new: kind addresses from patterns, by shape, as
  record pages, and as the last candidate for a path. Counting kind pages out of
  `isRecordAddress` reddens 1.
- `kind-pages.test.ts` (builder), 5: a kind gets a page, moves with its pattern, and
  never takes an address another page holds. Removing that guard reddens 1.
- `page-off-on-site.test.ts` (builder), 7, and `page-address.test.ts` (Piggles), 2.
  Ignoring the switches reddens 1.
- `url-pattern.test.ts` (cms), 8; `kind-address-agreement.test.ts` (api-rest), 54.
  Dropping one reserved word from the save rule reddens 2. `routes.test.ts`
  (site-lint): every top-level website route is reserved; dropping `booking` reddens 1.
- `content-paths.test.ts` (api-rest), 5; `kind-pieces.test.ts` (site), 11. Formatting
  on the server's clock reddens 3. `site-modules.test.ts`: search belongs to no switch;
  restoring the old rule reddens 1.
- `check:cms-routes` now also holds the site's by-path read and both consoles' use of
  the shared rule.
- On screen, as Rosalind: her kind's settings warned about the stored pattern; she
  typed `/articles/{slug}`; the note read "Each article gets its own page at
  /articles/…"; saved. `/articles/the-last-mill-on-the-nene` answers 200, titled "The
  last mill on the Nene · The Marrow Review", with her standfirst, photograph,
  caption, credit, "Rosalind Pike · Field", the whole body and four more articles. Her
  page list reads "Each blog post" and "Each article", and Shop, Cart, Collections,
  Products, Categories and Book "Off on this site". `/search?q=wheat` on her site
  finds "What a wet June does to a wheat contract · Article".
- Typecheck clean: silica-catalog, cms, builder, builder-schemas, api-rest, the site,
  both consoles. The sparx console half is typechecked, not driven.

## Still open

- `/book` still answers when typed (issue 944's open item, a scheduling file).
- A kind's second rich-text field is not drawn by the default page: the article-body
  core shows one document.
