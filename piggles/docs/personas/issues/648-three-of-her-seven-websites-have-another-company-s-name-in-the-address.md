# 648 — Three of her seven websites have another company's name in the address

**Status:** fixed, and the repair has been run
**Severity:** major
**Found by:** P03 · Juniper Row · act 223 (reading the Sending addresses screen, which asks for a domain she owns)
**Surface:** the `domains` table — the public web address of every site
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** the three rows read back out of the database, and a second run reporting nothing to do

## What happened

Sending addresses asks for "a domain or sub-domain you own", so I went to look at
what Juniper Row already has. It has eight addresses across seven sites:

| site                 | address                                         |
| :------------------- | :---------------------------------------------- |
| primary              | `juniper-row.piggles.site`                      |
| journal              | `journal.juniper-row.piggles.site`              |
| juniper-row-lookbook | `juniper-row-lookbook.juniper-row.piggles.site` |
| sample-sale          | `sample-sale.juniper-row.piggles.site`          |
| **archive**          | **`archive.juniper-row.sparx.zone`**            |
| **press**            | **`press.juniper-row.sparx.zone`**              |
| **trade**            | **`trade.juniper-row.sparx.zone`**              |

Three of her seven websites answer on an address with **another company's name
in it**. Not a label in the console, not a fallback sentence nobody renders: the
address a customer types, a card gets printed with, a browser shows in its bar.
And she cannot find that word anywhere in her console, so she has no way to know
what it is or who it belongs to.

Measured 2026-09-18 across the whole platform:

|                                                 |        |
| :---------------------------------------------- | -----: |
| Piggles businesses' addresses on `piggles.site` | **11** |
| Piggles businesses' addresses on `sparx.zone`   |  **3** |
| sparx businesses' addresses on `sparx.zone`     | **44** |
| sparx businesses' addresses on `piggles.site`   |  **0** |

All three are one shop's.

## Why

Each brand mints its businesses a free address in its own zone. Provisioning a
new TENANT does that correctly. Adding a **second site** to an existing tenant
went through a different path, and that path took the deployment's DEFAULT zone
rather than the tenant's.

The timestamps say the rest:

```
2026-08-29 02:59  archive   → sparx.zone
2026-08-29 03:56  trade     → sparx.zone
2026-08-29 04:24  press     → sparx.zone
2026-08-29 04:33  journal   → piggles.site
2026-09-01 08:09  sample-sale → piggles.site
```

Nine minutes, and the code changed. The fix is thorough and it is right — the
comment on `POST /v1/properties` names this exact outcome ("one business with two
sites in two brands' zones, the second one named after a product it has never
heard of"), `tenantZone` reads the zone off the row rather than deciding it, and
the rename path was fixed too.

**What was never fixed is the rows it had already written.** A code fix that
leaves its own output behind is half a fix, and the half it left is the half
customers look at. [[feedback_data_is_a_deploy_stage]]
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The other reason this matters

`wizeworks/apps/site/lib/site-context.ts` refuses to serve a tenant on a zone
belonging to another brand:

```ts
if (brandZone && brandZone !== claimedZone) return null;
```

The live Azure config sets both zone values, so on that deployment those three
addresses resolve to nothing. **This was not measured** — locally the site app
has neither value set, `brandZone` is undefined, the check is skipped by design
("the mismatch is what is actionable; the absence is not"), and all four hosts
answered `200`. So the reading is what the code says, not what was observed, and
it is recorded that way on purpose.
[[feedback_verify_capability_in_code_not_docs]]

## The repair

`ops:repair-cross-brand-subdomains`, wired into `.github/workflows/ops.yml`
alongside the other one-off repairs, dry-running by default like all of them.

It **mints the right address and makes it canonical**. It does **not** delete the
old one. That address is live and may be written on something; a repair that
turns a working link into a dead one has traded a cosmetic problem for a real
one. A non-canonical host redirects to the canonical, so afterwards the old
address still answers and everything anybody SEES is her own brand.

Three refusals, each deliberate:

- **Only `type: 'subdomain'` rows.** A custom domain is hers, and is never touched.
- **A brand with no configured zone is reported and skipped**, never guessed at.
  Guessing is what wrote these rows.
- **A target address somebody else already holds is reported and skipped.**
  Re-pointing a host another site answers on is worse than the address being fixed.

The intended zone is asked of the **brand**, not of the rows. Every other reader
in this codebase does the opposite on purpose, because the row is the record of
what provisioning decided. This is the one caller that cannot: it exists because
some of those rows are wrong, so reading them back would be asking the mistake to
confirm itself.

Dry run, 2026-09-18:

```
WOULD MOVE  juniper-row · archive: archive.juniper-row.sparx.zone → archive.juniper-row.piggles.site
WOULD MOVE  juniper-row · press:   press.juniper-row.sparx.zone   → press.juniper-row.piggles.site
WOULD MOVE  juniper-row · trade:   trade.juniper-row.sparx.zone   → trade.juniper-row.piggles.site

Dry run: 39 businesses with a platform address, 38 already on their own brand, 3 to move, 0 blocked.
```

Applied the same day, after Brandon stopped the dev stack:

```
moved  juniper-row · archive: archive.juniper-row.sparx.zone → archive.juniper-row.piggles.site
moved  juniper-row · press:   press.juniper-row.sparx.zone   → press.juniper-row.piggles.site
moved  juniper-row · trade:   trade.juniper-row.sparx.zone   → trade.juniper-row.piggles.site

Applied: 39 businesses with a platform address, 38 already on their own brand, 3 moved, 0 blocked.
```

Read back out of the database afterwards: each of the three sites now holds TWO
rows — its `piggles.site` address, canonical, and its old `sparx.zone` one, still
active and demoted, so a link that already exists keeps working and redirects.
Her one custom domain was not touched.

## The second run reported the same three, and that was a fault

Running it again said **"3 to move"** with the work already done.

Not a broken write — the write is an upsert and the rows were correct. The
REPORT was broken: it asked the question per ROW, and the old address is still a
row, on purpose. So it could not tell "already done" from "still broken", which
makes it a number that never moves. That is the exact thing this repair exists to
stop somebody reading past. [[feedback_never_present_absence_as_measurement]]

The question is now asked per SITE: does this site already have an address in its
own brand's zone? If it does, the old one beside it is a redirect and there is
nothing to do. Three tests cover it, including the HALF-done state a stopped run
leaves behind, and removing the one line reddens all three.

```
Dry run: 39 businesses with a platform address, 39 already on their own brand, 0 to move, 0 blocked.
```

## The thing that let it happen locally

`wizeworks/services/api-rest/.env.example` documented **neither** zone value, and
the default for a missing one is `sparx.zone` for everybody. So a laptop set up
from that file mints every Piggles business a sparx address — which is exactly
how these rows were born. Both are now in it, with the reason.

## A trap found on the way

`domains` **has no row level security**, deliberately and with approval
(2026-06-04): the host→site resolver and Caddy's certificate ask both look a host
up before any tenant is known, so the row has to be readable without a tenant.

The first version of the repair read it inside `withTenant` and relied on that
for scoping, the way almost every other table in this codebase works. It returned
**every tenant on the platform**, and Prisma is what caught it — the joined
`properties` row IS force-RLS, so the join came back null and it said so:

```
Inconsistent query result: Field property is required to return data, got `null` instead.
```

`tenantId` in the WHERE is not a redundant belt on this table; it is the only
thing scoping the read. The script now filters explicitly and reads properties
separately, in context, and the header says why.

## Guard

`brand-zone-repair.test.ts`, **10 tests**, on the pure rule rather than the
script's reading and writing. It carries Juniper Row's eight real rows as its
fixture and asserts the three moves by name.

Proved red three times:

1. Reading only RECOGNISED zones (dropping the fallback to the host's own last
   two labels) — the local stack recognises neither zone, which is how this
   started — fails the zone-reading test.
2. Dropping the refusal for an unconfigured brand: `mintZoneHost` falls back to
   the default zone and it starts moving addresses onto the wrong brand, which is
   the original bug. Fails 2.
3. Treating the primary site like any other: the bare address gains a label.
   Fails 2.

It also asserts the mirror case — a **sparx** business sitting on `piggles.site`
— because a repair that only knew one direction would leave half the fault on
the floor, and asserts that a second run has nothing to do.

## What is left

Nothing in the console lets her change this herself, and nothing tells her the
address is wrong. That is right: the address is minted by the platform and is not
hers to edit.

**Not verified on screen.** The dev stack was stopped for the repair, so the
tenant site was not asked for any of the three addresses afterwards. The database
is what was read back. Serving them is the next thing to look at when it is up.
