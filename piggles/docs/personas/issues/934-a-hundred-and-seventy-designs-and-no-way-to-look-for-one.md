# 934 — A hundred and seventy designs and no way to look for one

**Status:** fixed (act 325)
**Severity:** minor
**Found by:** P03 · Juniper Row · act 325, re-scoring Ready-made sites
**Surface:** mypiggles › My Site › Ready-made sites (both consoles), and `GET /v1/blueprints`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, "fashion" finding 5 designs and "Selling things" narrowing them to 4
**Blocked on:** —

## What happened

Devi runs a clothing label and wanted a design for a new site. Ready-made sites
listed 170 designs, 25 to a page, seven pages, newest-weighted. It had no search
and no way to narrow by what a design is for, although every card already says
it ("For selling things", "For publishing").

The screen's own comment explained why: "NO free-text search box here,
deliberately. The catalog endpoint has no query parameter, so a search could
only filter the page already loaded … The catalog is a small curated set". The
reasoning was right. The premise had stopped being true.

The sparx console had a second fault on the same cards: it title-cased the
stored value, so twelve designs read **"B2b"**. Piggles had already replaced
those with plain words.

## The fix

- **`GET /v1/blueprints`** takes `q` (name, line or description) and `vertical`,
  applied before paging, so the count under a search is the whole answer.
- **Both consoles**: a search box ("Find a design…") and a **What it is for**
  dropdown (All kinds, Selling things, Taking bookings, Publishing, Selling
  wholesale) beside the existing All designs / Added to this site.
- A search that finds nothing says **No design matches that**, with **Clear the
  search**, instead of "No designs available".
- The sparx console's cards use the same four plain words as Piggles.

## Proof

- On screen, as Devi: "fashion" read **5 designs** (Glossy Fashion, Fashion
  Boutique (Minimal), Eyewear (Modern), Couture Serif, Catalog Dense); adding
  **Selling things** read **4**. "zzqq" read **No design matches that**, and
  **Clear the search** went back to **170 designs**.
- The first press after "zzqq" said "Could not load the designs": the API was
  restarting (connection refused). **Try again** answered correctly.
- Both consoles and api-rest typecheck; the builder tests pass (57 and 43).
- The sparx console's half is typechecked, not driven.
