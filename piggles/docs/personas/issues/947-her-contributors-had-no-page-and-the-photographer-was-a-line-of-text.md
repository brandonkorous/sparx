# 947 — Her contributors had no page, and the photographer was a line of text

**Status:** fixed (act 5)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 5, checking a contributor's page on the live site
**Surface:** her public site, mypiggles › Content › Kinds of content (fields), mypiggles › Content › a piece, mypiggles › My Site › Pages, the Publish line
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P09 · The Marrow Review · act 5, `/contributors` listing the four, `/authors/jean-luc-marchetti-owusu` listing his five photographs
**Blocked on:** —

## What happened

Rosalind's journal has four contributors, made in Content › Authors with a
biography each: herself, Tobias Frankland, Amara Boateng and the photographer
Jean-Luc Marchetti-Owusu.

- Her site had **no page for any of them**. Nothing on the site served an author:
  no address, no index, no list block in the editor. A reader who liked a piece
  could not find the writer's other work.
- The byline under each article, "Rosalind Pike", was plain text going nowhere.
- Her **Photograph by** field is short text. It holds "Jean-Luc
  Marchetti-Owusu", typed again on every piece. Under each photograph the site
  printed the bare name, with nothing to say he took the picture, and nothing tied
  it to the Jean-Luc in her Authors list. His page, if he had one, could not list a
  single picture, because the only link between a piece and a person is the one
  author.
- A kind of content could not point at one of her authors at all. The field types
  offered "Link to other content", which points at a piece, not a person.

## What should have happened

Her brief: "Contributors: an index, plus a page each for the four, with bio,
portrait and their pieces", and "the photographer is credited on the pieces they
shot without being an author." A journal's byline links to the writer's page.

## How to reproduce

1. As Rosalind, open `/articles/the-last-mill-on-the-nene` on her site.
2. The byline is not a link. The line under the photograph reads only
   "Jean-Luc Marchetti-Owusu".
3. Open `/authors/rosalind-pike`: 404. Every time.

## Where it lives

- `@wizeworks/silica-catalog` `RECORD_ADDRESSES`: five routed record pages, no
  author.
- `apps/site`: no `authors` route; `projectByline` gives a name and no address.
- `@wizeworks/field-schema`: no field kind for one of the business's authors.

## The fix

- **Every author with something published has a page**, `/authors/<their name>`:
  portrait, name, biography, then **Writing** (what they wrote) and **Credits**
  (what they are credited on, each card saying the role, "Photograph by"). A list
  with nothing in it is left out. It is the sixth record page ("Each author"), seeded
  like "Each blog post", restylable like any page; until she publishes her own, the
  site draws the platform's. An author with nothing published on the site is a 404,
  not an empty page. `authors` is now a reserved first word for kind addresses, and
  `author` a reserved kind key, so nothing can take the address.
- **A list of authors for an index page.** Insert › Your writing › **List of your
  authors**: everyone with something published here, writers first, then everyone
  credited for other work, each card linking to their page (`cmsAuthors`).
- **Bylines link.** Every byline the site prints (`authorUrl`) goes to the writer's
  page, on her articles and on blog posts.
- **A field can credit one of her authors.** Field type **One of your authors**
  ("Credits a person from your Authors list: a photographer, an illustrator. Their
  page lists it."), with "Allow choosing more than one person". In the piece it is a
  picker of her authors. On the site it prints as its label and the person's name,
  linked: "Photograph by Jean-Luc Marchetti-Owusu". Both consoles.
- **Changing an existing field over keeps her work.** A piece whose "Photograph by"
  still holds typed text picks the author whose name it is, and says so with the
  form's unsaved mark; text that matches nobody says "This says “…”, which is not one
  of your authors." Until the piece is saved again the site prints the typed name,
  unlinked, rather than dropping the credit.
- **An untouched "Each article" follows its kind.** The page now carries a
  fingerprint of what the platform made. While it still matches, a change to her kind
  (a credit, a new field) remakes the draft; once she edits the page it is hers.
  Without this, her new credit field would never have reached her article page.
- **The sitemap lists author pages; the site check knows their addresses.**

## Found in the same act

- **The delete warning was false for a record page.** Deleting "Each article" said
  "deleting it leaves them with no page at all … will get a not-found page straight
  away." Measured: every article kept answering 200, and the page list made a fresh
  "Each article" on its next load. It now says "Every one of those records goes back
  to the standard design straight away, and a fresh copy of that design appears in
  your page list." A product-type design says those products go back to the design
  every other product uses (`page-delete-words.ts`).
- **A deleted live page kept being served.** Deleting a page never told the site's
  cache, so the deleted "Each article" stayed on every article. Deleting a published
  page now sends `builder.page.deleted`, which the cache worker purges on (topic
  listed in `terraform/envs/prod/main.tf`; nothing applied). The event worker picks up
  the new topic on its next start.
- **"3 other pages are saved and not live yet"** counted "Each author", which the
  site was already showing (the page list said "Live · standard design"). A record
  page never published and still exactly the platform's design no longer counts
  (`showsItsDefault`).
- **"The header and footer is published."** Now "are published. Your site shows
  them …".
- **The console stopped answering.** Every console address returned 404 for several
  minutes; the dev server had lost its page list. Touching `app/page.tsx` (no edit)
  made it rescan. Dev only; noted here because it looked like a broken sign-in.
- **The site check nagged about pages she switched off.** 39 findings, a dozen on
  Shop, Products, Categories, Collections, Book and "Each product" (no search title, a
  link to a missing returns policy, "nothing links to Shop … works perfectly if you
  already know its address"), none of which a visitor can reach. The check now reads
  the page list's own "Off on this site" answer (`pagesOffOnSiteTx`) and leaves those
  pages out of both the walk and the address roster.
- **The footer's Search link vanished though `/search` worked.** The hidden-paths read
  kept its own copy of the "which module owns this block" rule; when search became
  the whole site's (945) the copy did not follow. It now asks the shared
  `moduleForKey` (`hiddenPathsOf`, tested).
- **"Customers have accounts here" asked the account, not the site.** A journal with
  its shop switched off has nothing for a reader to sign in to; `siteCapabilities`
  now asks this site's switches.
- **The design's `/blog` page could not be deleted.** It came back within the second,
  and the warning ("that address stops working … never been live") was false twice:
  the platform served `/blog` from its starter whatever the list held. A deleted
  starter page is now remembered (`settings.removedPages`): the list does not remake
  it and the site does not serve it, until she makes a page there again. Addresses
  the site answers with routes of its own (`/cart`, `/search`, `/account/…`,
  `SITE_OWN_ROUTES`, proven against the `app` folders) say "Your site keeps /cart".
  The warning reads `live`, not `published`.
- **A deleted page stayed on the site for good.** The cache purge marked entries
  stale (`'max'`), and Next stores only a 200, so the background re-read of a page
  that now 404s was thrown away and the old page served on. The purge now expires
  (`{ expire: 0 }`); `/blog` answered 404 on the next publish.
- **The last row's Delete sat under the corner tools.** The size glass covered the
  last page's Delete in her page list and the list could not scroll further. Every
  full-height pane list now ends with room under the tools
  (`CANVAS_LIST_END_CLEARANCE`, on the canvas once).
- **"Move up" and "Move down" were blank squares** in both consoles: the baked icon set
  has no up or down arrow. The editor draws them from the side arrows, turned; Piggles
  draws its own.
- **Every page logged a 401** for every visitor without a session ("who is signed
  in?"). The site now asks `/account/session`, which answers `customer: null`.
- **The 404 offered only the front page.** It now offers a search of the whole site
  too, which reaches every piece.
- **The legal pages screen said her Cookie Policy promised a banner** after she
  rewrote it to promise none. The note now reads the published text
  (`promisesCookieChoices`), both consoles.
- **"The header and footer is published."** Now "are published … shows them".
- **Page settings boxes had no names for a screen reader** (name, address, search
  title and description, header and footer): tied to their labels with `FieldControl`.

## Proof

- `author-credits.test.ts` (api-rest), 6: credit fields found at the top level only,
  served kinds with the tenant's own shadowing a built-in, the credit query, roles.
  Removing the shadow guard reddens 2.
- `author-page.test.ts` (silica-catalog), 5: her page and the photographer's, no
  placeholder words, empty lists left out. Removing the list's gate reddens 3.
- `content-kind-page.test.ts`, 2 new: the byline links; the credit prints "Photograph
  by" and links. Taking `author` out of the caption lines reddens 1.
- `authors.test.ts` (site), 8: the two names for the list agree, credits print as
  names with links, typed names survive, the author page record. Dropping the typed
  name reddens 1; dropping `authorUrl` reddens 1.
- `kind-pages.test.ts` (builder), 4 new; `default-page.test.ts`, 5;
  `page-delete-event.test.ts`, 2; `page-delete-words.test.ts` (Piggles), 3;
  `silica-data-needs.test.ts`, 2 new; `site-check.test.ts`, the author roster. Each
  proven red by breaking what it guards.
- Typecheck clean: field-schema, cms, builder-schemas, silica-catalog, builder,
  events, the cache worker, site-lint, api-rest, the site, both consoles.
- On screen, as Rosalind: Content › Kinds of content › Article › Photograph by ›
  Type of field: **One of your authors**; help text changed to "Who took the
  photograph. Their name links to their page."; saved. Each of her five pieces opened
  with Jean-Luc already picked and "Unsaved changes"; saved; all still live.
- On screen, as Rosalind: deleted "Each article" (the old one predated the
  fingerprint), published the fresh one. `/articles/the-last-mill-on-the-nene` reads
  "Photograph by Jean-Luc Marchetti-Owusu" under the picture and "Rosalind Pike" in
  the byline, both links.
- On screen, as a reader: `/authors/rosalind-pike` (biography, Writing, two pieces);
  `/authors/jean-luc-marchetti-owusu` (biography, Credits, five photographs, each
  "Photograph by").
- On screen, as Rosalind: a new page **Contributors** (Page top with her heading and
  standfirst, then List of your authors), published; Contributors added after Journal
  in the header, the phone menu and the footer, published. `/contributors` lists
  Rosalind, Tobias, Amara and Jean-Luc, each linking to their page.

- On screen, as Rosalind, the rest of the site: Contributors added to header, phone
  menu and footer; the footer's starter lines rewritten ("The Friday letter: three
  pieces from the week …"), its Account column made "Write to us" (email, Pitches and
  corrections, the Old Granary address), the Account sign-in links removed from the
  header; Contact rewritten as "Pitches and corrections"; a search title and
  description on all eight of her pages; Privacy, Terms and Cookie policy rewritten for
  a UK journal, marked reviewed, published, and linked in the footer (each answers
  200); `/blog` deleted and gone. **Check my site: "Nothing to fix across 16 pages."**
- More tests, each proven red: `pages-off-on-site.test.ts`, `removed-starters.test.ts`,
  `routes.test.ts` (`SITE_OWN_ROUTES`), `page-delete-words.test.ts` (6),
  `site-hidden-paths.test.ts`, `site-capabilities.test.ts`, `route.test.ts` (the
  purge), `shop-reach.test.ts` (the quiet read), `icon.test.ts`, `gate-note.test.ts`,
  `cookie-promise.test.ts`, `cookie-policy-note.test.ts` (both consoles).

## Still open

- **Portraits.** The four have none: the only portrait photographs in the repo are
  stock photographs whose licence forbids naming the person shown (act 3). The pages
  and the list leave the picture out cleanly.
- **Role.** An author has no role field; hers lead their biographies ("Editor.",
  "Photographer."). A role field is a column on `authors`, a migration.
- **The editor canvas does not fill lists.** Every list on the canvas shows its card
  once and its "nothing here" line under it, so Contributors reads "Nobody has
  anything published yet" while she has four. Filed separately (948).
- **The event worker needs a restart** to subscribe to `builder.page.deleted`; until
  then a deleted live page leaves the cache on the next publish rather than at once.
  A deploy restarts it.
- The 404 page logs one dev-only warning ("Encountered a script tag while rendering
  React component") from Next's not-found render of the root layout's head scripts.
  Not seen on any other page; a production build was not checked.
- The design's three sample authors (Eleanor Vance, Julian Mercer, Sofia Adeyemi)
  are still in her Authors list and in the author picker. They have nothing
  published on her site, so no page and no place in the list.
