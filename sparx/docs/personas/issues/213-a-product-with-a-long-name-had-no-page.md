# 213 — A product with a long name had a page nobody could open

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping), on the other side
**Surface:** the Gillett site › a product's page; the API behind every page that names a record in its address
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Brynn searched Gillett's site for "68 gallon fuel tank". The search found it: "S&B 68
Gallon High-Capacity Fuel Tank, 17-26 Ford Powerstroke 6.7L Crew Cab Long Bed,
$1,449.00". She clicked it and got "We couldn't find that page. It may have moved, or
the address may have a typo in it."

The 70-gallon tank did the same. The Cummins O-ring opened normally.

44 of Gillett's products have a page address longer than 100 letters (the longest is
122). None of those 44 pages opens, so none of those products can be bought on the
site. They are the long-named parts: fuel tanks, lift pumps, turbo kits, each name
carrying the years, the engine and the cab the part fits.

## What should have happened

Every product on sale has a page a customer can open and buy from, however long its name.

## How to reproduce

1. Open `localhost:3004/search?q=68+gallon+fuel+tank&tenant=gillettdiesel`.
2. Click the S&B 68 Gallon tank.
3. "We couldn't find that page", every time. The API answers
   `Route GET /v1/public/commerce/products/s-b-68-gallon-…-crew-cab-long-bed not found.`

## Why it matters

A product the business sells, that search finds, that nobody can buy. The longest names
are the most exact ones, which is what a parts business writes: in Gillett's catalog
that is 44 products. Nothing in the console says anything is wrong.

## Where it lives

`wizeworks/services/api-rest/src/app.ts`, `Fastify({ … })`: no router options, so the
router's default `maxParamLength` of 100 applies. A path part longer than 100 letters
matches no route, and the 404 says the ROUTE does not exist. A product's address is
`VarChar(127)` (`commerce_products.handle`), as are a category's and a market listing's.

## The fix

- `services/api-rest/src/router-options.ts`: `ROUTER_OPTIONS`, `maxParamLength` 127 × 12
  (the longest address the database holds, each letter at its longest once encoded for
  a URL). `app.ts` builds the API with it.

Shared: every brand's sites read products through this API. The other Fastify servers
(`api-graphql`, `api-mcp`) take no record addresses in their paths, so they keep the
default.

Tests, red first: `src/router-options.test.ts` (4): the router's default refuses the
tank's address (the defect, kept as a test so the reason stays written down); the API's
options reach the route; a 127-letter address of four-byte characters reaches it (and with the limit one letter lower,
run by hand, it failed); and `app.ts` uses the options. Lint clean.

## Confirmed by

P01 on screen, 2026-10-11: the S&B 68 gallon tank's page opens on Gillett's site with its
photo, $1,449.00 (Renée's fleet price $1,275.12) and Add to cart; she bought it (O-000023).
All 44 of Gillett's products with addresses over 100 letters answer the API (44 × 200,
none 404).

## Rating effect

—
