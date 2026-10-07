# 932 — A picture on her home page counted as unused

**Status:** fixed (act 325)
**Severity:** critical
**Found by:** P03 · Juniper Row · act 325, re-scoring Photos and files
**Surface:** mypiggles › Photos and files, one file, the delete guard and the media clean-up (both consoles, api-rest, `@wizeworks/media`)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, the grid naming where each picture is used, and trio-founder.jpeg refusing Delete for being on a site page
**Blocked on:** —

## What happened

Devi's library holds 87 files, most of them sample pictures from designs she
added: perfume bottles, high jewellery, book covers. Clearing it means finding
the ones nothing uses. The grid could not say: under every filename it printed
the size, which on 74 of the 87 read "Stored somewhere else". Where a picture
is used was on every row the list already fetched, and drawn only on a file's
own page.

Drawing it showed the worse problem. The usage count (issue 381) counted
products, articles, customers, authors, staff documents and expenses. It left
site pages out on purpose, on a measurement of **1 of 87** in a page design.
That measured by id. A design that links a picture keeps its **address**, and
by address **20 of the 87** are on her pages. So:

- the grid would have called a picture on her home page "Not used anywhere";
- the delete guard let her delete it;
- and for a stored picture, the media clean-up hard-deletes a deleted file 30
  days later if nothing uses it. Its own header says that check "is the one
  thing standing between a live photo and permanent deletion".

The same count missed every other column that holds an asset id: the logo, the
dark logo and the browser icon; category and collection pictures; review
photos; social posts; return photos, shipping labels, tax and batch
certificates, signed agreements, issued invoice PDFs, marketplace banners and
part-finder icons. Platform-wide, 9 live files are held only by those today.

## The fix

- **`countAssetUsage`** (`@wizeworks/media`) counts, in one more query: site
  pages and site headers and footers (their designs searched for the id or the
  address, within the picture's own business), and all of the columns above.
  The delete guard, the clean-up and the library all read it, so all three are
  fixed at once. `describeUsage` names the new kinds ("1 site page", "1 logo or
  site icon", "1 category or collection", ...).
- **api-rest** sends the new counts; **both consoles** read them, and name them
  the same way.
- **The grid** says, under each filename, what differs: "In 2 product photos",
  "In 1 site page and 1 category or collection", or **No use found**. The size
  shows only when it says something (a measured size, or a stored file nobody
  weighed).
- **"No use found"**, not "Not used anywhere": an email design, a saved
  section or a theme can still hold an address, and those are not searched.
  None of Juniper Row's pictures is in one. The file's own page says so.
- **Where it is used**: a file's own page lists each product, article, site
  page and header and footer that shows it, by name, with its site for a page
  ("Home (site page on Juniper Row Journal)"). Each opens beside the file. A
  page on another site switches to that site first, asking before it drops
  unsaved work, the same way a saved piece's Where it's used does: opened from
  the wrong site, a page id resolves to nothing and the editor says "This page
  isn't here any more" about a page that is one site over. That happened on
  the first try and is why the switch is there.
- **A Use filter** on the grid: Any use, In use, No use found. Usage is counted,
  not stored, so with the filter on, the server counts the whole matching set
  and pages it afterwards. State and Use sit on the bar as dropdowns, so the
  three questions fit beside the search instead of folding into a menu.
- **Sort by**: Recently changed (as before), Oldest first, Name A to Z, Largest
  first. The library could only be read newest first, so 87 files were a
  scroll.

## Proof

- `asset-usage.test.ts` (`@wizeworks/media`): a picture on a site page; the
  logo, a collection and a social post; the words for each. 19 cases.
  `upload.test.ts`'s database stand-in answers the new read.
- `media-admin.test.ts` (both consoles): the tile line for a used and an unused
  picture, and the size line. Red when a linked picture's size line comes back.
- Measured against her data before writing it: by id 1 picture on her pages,
  by address 20; in her emails, saved sections and themes, 0.
- On screen, as Devi: the first page of the grid went from 16 "No use found" to
  5, with 12 "In … site page" and 2 "… category or collection" among the rest.
  trio-founder.jpeg reads "Used in 1 site page", and Delete is off with "It is
  used by 1 site page. Remove it from there first", and **Where it is used:
  Home (site page on Juniper Row Journal)**. Pressing it moved the console to
  Juniper Row Journal and opened that Home page in the editor.
- **No use found** showed 12 files; **In use** showed 75; 87 in all.
- **Name A to Z** began anthology-cover.jpeg, ash-overshirt-bone.jpg,
  ash-overshirt-bone.jpg; **Largest first** began with her own linen
  shirtdress and knit photographs.
- The sparx console's half is typechecked and tested, not driven.

## Not changed

- Emails, saved sections and themes are not searched (none holds one of her
  pictures today). `UNCOUNTED` says so, and so does the file's own page.
