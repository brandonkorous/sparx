# 927 — Her free address said "Nothing to set up", and nothing else

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, Domains › juniper-row.piggles.site
**Surface:** mypiggles › Domains, one web address (both consoles), and New site
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, the list going from 11 addresses to 8, the free address saying where it came from, and Connect a domain opening on Juniper Row Lookbook
**Blocked on:** —

## What happened

Devi opened her free address. The pane said it was "Always on", then said
"Nothing to set up", then explained that there was nothing to set up. It did not
say where the address came from, whether she could change it, or how to get a
proper one. It had no button at all. A business owner who opens her free address
is nearly always asking "can I have my own name instead?", and the pane could not
answer that.

Her Domains list had three more problems.

1. **Three addresses had another company's name in them**, and the list called
   each one "Always on": `archive.juniper-row.sparx.zone`,
   `press.juniper-row.sparx.zone`, `trade.juniper-row.sparx.zone`. Issue 648
   gave each of those sites a `piggles.site` address and kept the old rows,
   because it believed they "still answer and redirect". In production they do
   neither. The site app refuses a Piggles business on sparx's domain
   (`wizeworks/apps/site/lib/site-context.ts`: `if (brandZone && brandZone !==
claimedZone) return null;`), and nothing on the platform sends one address to
   another. The rows' only effect was this false line in her list. Opening one
   repeated "It can never be removed, because it is your site's permanent back-up
   address", which is not true of it either.
2. **"Make main address" made a promise nothing keeps.** Its confirm box said the
   old address "sends people here automatically". Nothing redirects. Making an
   address the main one changes the links in customer emails, calendar invites
   and signing links, and the sitemap (`@wizeworks/db/site-origin`). The old one
   keeps opening the site as before. The sparx console's box said "will redirect
   here automatically".
3. **A new site's address named her business twice.** "Juniper Row Lookbook" was
   given `juniper-row-lookbook.juniper-row.piggles.site`. The New site form
   builds the address from the site's name, and the address already ends with
   the business's name. The address can never be changed once the site exists.

## The fix

- **The free address** (both consoles): "Nothing to set up" is gone. In its place:
  - "Where this address comes from": the platform gave the business (or this
    site) this address. For a second site it names the site's own part. It never
    changes and cannot be removed. It does not claim the address was made from
    the business name, because older businesses were given made-up names
    (issue 010).
  - When the site has a different main address, it names it and says that one is
    in the links customers are sent.
  - "Use your own domain", with a **Connect a domain** button in the app's color.
    It opens Connect with this site already picked. It is not shown when the
    site already has a domain of its own.
- **Old addresses on another brand's domain** are not listed, and opening one by
  its link says it is no longer here (`lib/stranded-zone-address.ts`, used by
  `GET /v1/domains` and `GET /v1/domains/:id`). Only when the site already has a
  free address on its own brand's domain, so a site that was never repaired
  still shows the one address it has. Nothing is deleted. One of them can no
  longer be made the main address either.
- **Make main address** now says what it does: the links customers are sent and
  the sitemap use the new address, and the old one keeps opening the site.
- **New site** suggests the address without the business's name in front:
  "Juniper Row Bridal" gives `bridal.juniper-row.piggles.site`. She can still
  type anything. api-rest does the same for a site added without a handle.
  Nothing is left (`juniper-row`) or `primary` keeps the whole handle.
- On a working free address, the status box that repeated the "Always on"
  badge is gone; the section below says what the address is.
- Three "Visit" / "Make main address" / "Issue a new one" buttons named
  `color="neutral"`. They are now colorless (RULE #4).

## Not changed

- Juniper Row Lookbook keeps `juniper-row-lookbook.juniper-row.piggles.site`.
  A site's address is fixed once it exists.
- The free address cannot be renamed. That would be a new capability.

## Proof

- `stranded-zone-address.test.ts`: hides the old row, keeps a site's only free
  address, never hides a connected domain. Red when the "site already has its
  own" check is removed.
- `site-handle.test.ts` (api-rest), `site-address.test.ts` (Piggles),
  `site-handle.test.ts` (sparx). Red when `primary` may be left.
- On screen, as Devi: Domains went from 11 addresses to 8. Her free address
  reads "Piggles gave your business this address when you signed up." Lookbook's
  names its own part. Connect a domain from Lookbook opened with "Juniper Row
  Lookbook" picked. New site, typing "Juniper Row Bridal", previewed
  `bridal.juniper-row.piggles.site` (not created). The sparx console's half is
  typechecked and tested, not driven.
