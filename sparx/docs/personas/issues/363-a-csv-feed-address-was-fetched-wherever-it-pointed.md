# 363 — A CSV feed address was fetched wherever it pointed

**Status:** fixed
**Severity:** blocker (security)
**Found by:** P01 · Gillett Diesel Service · setting up issue 170's CSV supplier, reading the code
**Surface:** workbench › Dropshipping › Connect a supplier › CSV feed; `@wizeworks/dropship` `CsvAdapter`
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

A CSV-feed supplier is connected with a web address, and the server fetches it to test the
connection, list the catalog, import and check stock. Nothing checked where the address pointed.
An admin of any business could have the platform fetch an address on its own network, such as
a cluster service or a cloud metadata address, and read back what came as a "catalog".

## What should have happened

Only an http or https address on the public internet is fetched, and the owner is told why when
one is not.

## How to reproduce

1. Connect a supplier › CSV feed, with a feed address on a private network.
2. The server fetches it.

## Why it matters

The platform's own network is open to anyone who can make a business account and connect a
supplier.

## Where it lives

`adapters/csv.ts` called `fetch(csvUrl)` in three places, following redirects.

## The fix

`feed-fetch.ts` in `@wizeworks/dropship`: `fetchFeed` checks the address before fetching
(http or https; every address the host has must be public: no loopback, private, carrier-grade
NAT, link-local or cloud metadata, multicast or unique-local ranges), and checks each redirect
the same way, three at most. The host is looked up with the server's DNS, handed in by the
caller (`feed-host.ts` in api-rest and the dropship worker, through `createAdapter`'s new
`deps`); with no lookup a named host is refused. Outside production, loopback is allowed so a
feed can be served locally. The connection test now says why an address is refused.

Not closed: a host that answers the check with a public address and the fetch with a private
one (DNS rebinding).

Test, red first: `dropship-worker/src/handlers/feed-fetch.test.ts` (7). dropship-worker 22 pass;
dropship, dropship-worker and api-rest `tsc` clean. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19. Connect a supplier › CSV feed at `http://169.254.169.254/latest/meta-data/`:
"Could not save this supplier · 169.254.169.254 is not on the public internet, so the feed cannot
be read from it." A feed served on this machine (`http://localhost:8799/feed.csv`) connected as
Bluffdale Bolt Co., and its two products synced.

## Rating effect

—
