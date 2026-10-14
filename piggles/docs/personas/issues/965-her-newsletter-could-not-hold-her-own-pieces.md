# 965 — Her newsletter could not hold her own pieces

**Status:** fixed (act 10)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10
**Surface:** mypiggles › Email design; the send (api-rest `email-data.ts`)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 10, "Friday edition: 10 October"
**Blocked on:** —

## What happened

Friday's edition is three pieces with pictures and standfirsts. The email designer's
blocks were Section, Columns, Text, Image, Button, a summary card, a call to action and a
callout. Nothing could put a published piece in an email except retyping its headline,
standfirst, picture and link by hand, three times a week.

The send already had a list of writing (the welcome emails use it), and it was wrong for
any kind but the blog:

- the link was `/<kind>/<slug>`, so `/article/the-last-mill-on-the-nene`, a 404 (her
  pieces live at `/articles/...`);
- the picture was read only from `featuredImage` (hers is `heroImage`);
- the summary was read only from `excerpt` (hers is `standfirst`);
- it listed pieces from every site of the business, not the one sending.

Then, with the email published, the campaign's email list still said **"Friday edition:
10 October (draft, not published)"**: it sits open beside the designer and never reloads.

## The fix

- `builder-schemas`: `contentCards(ref)` (the repeating half of `contentRail`) and
  `writingBlocks(kinds)`: one **Latest Articles**-style block per kind of writing.
- piggles `lib/studio/host.tsx` + `list-sources.ts`: the designer offers a "Latest …"
  block for each kind she writes in. Not section filters, not product lists, and not
  her pages ("Latest Pages" would put the privacy policy in a newsletter).
- api-rest `email-content-card.ts` (new) + `email-data.ts`: each piece is read by its
  kind's own field names (title; excerpt, standfirst, summary, or the first long text;
  featuredImage, heroImage, or the first picture field), linked at the address the site
  serves it (`entryPublicPath`), limited to the sending site, newest three. A picture
  already stored as a full address passes through.
- Both consoles: saving or publishing an email also refreshes the campaign's list.

The designer's canvas still draws the block as one empty card ("Choose a picture"). That
is the shared silicaui email designer, which never fills a list while editing; the
email's own Preview and the campaign preview show the real pieces.

## Proof

- `email-content-card.test.ts`, 4: an article's names, fallback by field type, a blog post
  as before, no picture. With only the blog names, 2 redden.
- `email-content-blocks.test.ts`: "Latest Articles" for `cms.article`, none for a section
  filter; `list-sources.test.ts`: no pages (reddens without the rule). builder-schemas
  382, api-rest 480, consoles 425 and 370 pass.
- Campaign preview, shown to Owen Pryce: "Hello Owen.", the three newest pieces with
  their standfirsts, pictures, links to `/articles/<slug>`, then Unsubscribe and her
  mailing address.
