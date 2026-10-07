# 939 — She published, and four of her five changes stayed hidden

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 325, fixing her own site (P01 site row, Ease 3)
**Surface:** mypiggles › Ready-made sites › Café; the page, header and look editors; Publish (Piggles console, `@wizeworks/builder`)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 · Thistle & Rye · act 325, every edit live on her site and checked as a stranger
**Blocked on:** —

## What happened

Thistle & Rye's site was Ease 3: she sells nine things at `/shop` and nothing on
her site linked there. Marisol set about fixing it herself, and four screens got
in her way.

**1. Her design said her public site was a private draft.** Home offered "The
design your site was built from has been refreshed" (Café 1.3.0 → 1.4.1). The
design's page said **"Added as drafts on Thistle & Rye. Everything this design
adds is on your site as drafts. Only you can see it."** Her site has been public
since August. The install keeps the status `installed` until the design's own
Publish button is pressed, and publishing the SITE from any editor never moves
it.

**2. The safe button sat under a warning that it wipes her site.** Below that,
under **Add it to a site**, the pane said "Thistle & Rye has 11 pages now, and
adding this design replaces all 11 of its pages … That cannot be undone", then
offered **Publish it live on Thistle & Rye**. The design was already on that
site, so nothing would be replaced, and the button only publishes. The confirm
then said it publishes "everything the design added". It publishes the whole
site, her own saved changes included.

**3. One Publish, five edits, one went live.** She fixed `/bake`, Home, Find us,
the Order page and the header and footer, saved each, and pressed **Publish**
once. The editor said **"Published. Your site shows it in a few seconds, a few
minutes at most."** Eight minutes later her site was unchanged except the one
page. Each editor publishes only its own document; the sentence said "your
site".

**4. The Publish screen could not say which pages.** "13 pages have changes
that visitors are not seeing yet", and one button, **Publish everything**. She
had edited five. The thirteen were all standard pages she never touched (Shop,
Cart, Login, Book…), and nothing on the screen said so.

## The fix

1. **`installState`** takes whether the site shows any page. With the site
   public it reads **Added on Thistle & Rye**: "Your site is public, so visitors
   see the pages you have published, this design's among them. Anything it
   added that you have not published yet, an update included, is a draft only
   you can see." The design page and the Ready-made sites cards both use it,
   from the published page count the sites list already sends.
2. **The section, once the design is on the chosen site**, is titled **On
   Thistle & Rye** and says "This design is already on Thistle & Rye, so
   nothing here replaces anything". The go-live confirm says it publishes the
   site, her saved changes included.
3. **The page, header and look editors** say what they published: "This page is
   published…", "The header and footer are published…", "The look is
   published…". When other pages wait, the same line adds "13 other pages are
   saved and not live yet" and a **Publish the rest** link to Publish.
4. **Publish** lists the waiting pages by name and address, each opening its
   page. `GET /v1/builder/site/publish-state` sends `unpublishedPageList` from
   the same filter as the count, so the two cannot disagree.

## Proof

- `blueprints-words.test.ts`: a design on a public site is not "Only you can
  see it". Removing the public branch reddens 1 of 9.
- `published-words.test.ts`: the waiting count. Letting zero through reddens 1
  of 2.
- On screen, as Marisol: the design page read "Added on Thistle & Rye … Your
  site is public" and "On Thistle & Rye … nothing here replaces anything"; the
  confirm named her saved changes. The `/bake` editor read "Saved and live. 13
  other pages are saved and not live yet. Publish the rest", and Publish listed
  Shop /shop, Cart /cart … Contact /contact.
- Typecheck: both consoles, `@wizeworks/builder`, `@wizeworks/builder-schemas`.

## What Marisol changed on her site

All through the console, as the owner:

- Took the Café 1.4.1 update and published it.
- **Order** in the header (both menus), the header button and the footer's
  **Order for collection** now go to `/shop`; so does Home's main button. Her
  site now links its shop 5 times.
- The Order page lists her products under **Order bread, pastries and cakes**,
  and its sentence says to choose in the shop.
- `/bake`: all 19 prices carry "$"; Country sourdough and Butter croissant now
  match the shop ($8.50, $4.00; the menu said $6.50 and $3.20).
- "deposit of 30" reads "deposit of $30" on `/bake` and the Order page.
- The footer no longer promises "new work, journal notes, and studio news".
- Find us says "Open Tuesday to Sunday … Closed Mondays", matching Home.
- The booking place "Kettle & Crumb" is "Thistle & Rye", 114 Mercer Lane.

## Still open

- The Order page still shows the design's three table services below her
  products. The block is pinned to that page, and deleting the services would
  leave "Nothing can be booked online just now" in their place.
- Her business has no time zone set, so bookings run on UTC. Nothing in her
  record says where she is, so it was not guessed.
- Her site's pages and articles cannot be found from the search box (see 940).
