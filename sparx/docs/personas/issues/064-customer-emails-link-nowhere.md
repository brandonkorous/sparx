# 064 — Every link in a customer email went nowhere, and a counter sale was "shipped" and "delivered"

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3 (reading the receipts for the [061] counter sales)
**Surface:** customer emails: order confirmed, order delivered, and every other transactional email that links to the site
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On the dev broker, 2026-10-01, after a new counter sale O-000005 (an O-ring, collected at the counter):

- "Your order O-000005 is confirmed": "We'll let you know when it's ready to pick up." and "Pick up from 14812 Heritagecrest Way, Bluffdale, UT 84065"; no "Shipping to" line; 0 bare links.
- "Your order O-000005 is in your hands": "You picked up order O-000005 … ✓ Picked up".
- O-000004's emails (just before the refresh below) already had every link as `https://gillettdiesel.sparx.zone/…` and no "[object Object]".
- Gillett's two stored emails were still the old wording until the default-email refresh ran (it runs on module activation and every 6 hours after the API starts); run for Gillett with the platform's own `provisionDefaultEmails`: refreshed 2.
  **Blocked on:** —

## What happened

Brynn O'Hara-Løvdal bought two rebuilt injectors at Gillett's counter and took one
home. Her emails, read off the dev broker:

- **Order confirmed:** "We'll email you tracking the moment it ships." She was
  collecting it. Then "Shipping to [object Object]".
- **Order delivered:** "Your order O-000002 has been delivered." She picked it up
  herself.
- **Every link** in both ("Track your order", "Keep shopping", "Leave a review",
  the policy links in the footer) was a bare path such as `/account/orders`. From an
  inbox that goes nowhere.

The links come from `SPARX_SITE_BASE`, a setting nothing sets: not the cluster
files, not the deploy workflows, not dev. So this is every link in every customer
email on every shop, not only Gillett's. The sitemap already works out each site's
real address (its own domain, or its `sparx.zone` name); email never used it.

## What should have happened

- Links go to the site the email is about, at its real address.
- A pickup order says when it is ready to collect, has no "Shipping to" line, and is
  "picked up", not "delivered".

## Fix

- `api-rest/src/lib/site-origin.ts` (new): a site's real address, the sitemap's own rule (its canonical domain, the tenant's primary domain, then its `sparx.zone` name, using the tenant's own zone). The sitemap, every email, the booking calendar file, the waitlist text, signature mail and the RSS feed use it. `SPARX_SITE_BASE` still overrides when set.
- Each email links to the site it is about (order, booking, cart, quote, invoice…), resolved once per email. A signing link must be a full address or it is refused.
- The receipt binds the address's one-line form; an old tenant-edited email that binds the whole address still prints it right. A pickup order has no address, so the panel goes.
- New `pickup` / `delivery` / `pickupFrom` facts: a pickup receipt says when it can be collected and where; the "delivered" email has a picked-up version, and its subject is now "Your order … is in your hands".
- The refresh learned the outgoing designs' fingerprints, so tenants still on any receipt shipped since late July get the new one (48 of 52 stored order emails in dev; the other 4 already bind the one-line form).
- Tests: 26 new in api-rest, 7 in email; each fix removed reddens its tests (table in the build report).

### The same setting outside api-rest

`SPARX_SITE_BASE` also switched off two things api-rest's helper could not reach:

- **sparx.market "Visit their store"** (`market_listings.product_url`, `market_merchants.site_url`) was always empty.
- **Every sales channel** (Google Shopping, Meta, Pinterest, Faire, Etsy, ...) needs an absolute product link, so the channel-sync worker skipped every product push. No product ever reached a channel.

The resolver moved to `@wizeworks/db/site-origin` (the zone list, `mintZoneHost` and `tenantZone` with it, from `api-rest/src/lib/domain.ts`), so there is still one copy. It takes the client to read through, so a caller inside a tenant transaction reuses it; api-rest's `lib/site-origin.ts` and `lib/domain.ts` re-export it bound to their own clients, and every api-rest call site is unchanged.

- The marketplace links open on the marketed site (its own domain, else its subdomain); a product scoped only to a sibling site links to the site that shows it.
- A channel connection belongs to one business, so each listing links to the connection's own site, built once per site. A tenant-wide connection links to a site that shows the product. A product scoped only to a different business than the connection's is no longer pushed to that shop.
- Three more copies of "what is this site's address" now use it: the social "Share this" draft and the automation "new product / article" post (each answered nothing when a domain row was missing, and the primary's address for a product the primary does not show), and the shopper password-reset link (any live domain of any site, in a different order from the emails). Email link tracking tags the site's address and the origin the links were built on; it tagged nothing on a shop without a custom domain. The MCP domain tool's copy of `tenantZone` had both halves of issue 316 still in it.
- Tests: 4 in commerce, 7 in channel-sync-worker, 3 in automation-actions, 2 in social, 3 in customer-auth, 2 in email-platform. Restoring each pre-fix file reddens its tests; dropping the canonical-domain step from the shared resolver reddens 15 across six packages.

## Not changed, and why

- `public/site-info.ts` keeps its own address rule: it is the shopper sign-in origin, where the session cookie lives. Moving it changes sign-in, so it is a separate decision.
- `wizeworks/apps/site/lib/site-host.ts` still parses `SPARX_ZONE_DOMAINS` itself. It decodes an incoming host at the edge rather than building a link, and the site app does not depend on `@wizeworks/db`.

## Follow-up the same evening: a counter sale already handed over

The first fix still told a buyer who walked out with the part "We'll let you know when it's ready to pick up", with "You picked up order …" a minute later. Split `pickup` into `pickupLater` and `pickedUp` (a pickup order whose `deliveredAt` is set when the receipt is built); the receipt now says "Order … is yours. Thanks for coming in." and gives no pickup address. The refresh learned the first split's fingerprint (`a29816b8…`), which the dev refresh had put on rows. Proved on the broker with O-000006: "Order O-000006 is yours. Thanks for coming in." Tests: email 226, api-rest 313 (the already-collected case reddens 1 when the split is removed).
