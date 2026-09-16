# 516 — a reworded seed installs a second copy of itself, and the customer is emailed twice

**Status:** fixed and proven
**Severity:** critical
**Found by:** reading the em-dash sweep back against the code that installs what it reworded
**Surface:** system automations (every tenant), shipping presets, the blueprint install ledger
**Filed:** 2026-09-15

## The shape

An idempotent installer has to decide "have I already put this here?". Three of
them decide it by **matching a sentence a person reads**:

| Installer                       | Its identity              | Runs                                                                  |
| ------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| `upsertSystemAutomation`        | `(origin='system', name)` | on provisioning, on module activation, **and daily for every tenant** |
| `presets/shipping.ts` marker    | `shippingZone.name`       | when someone applies the preset                                       |
| `blueprint-baseline.ts` (email) | `naturalKey = e.name`     | on every blueprint update                                             |

A display name is copy. The moment copy is edited, the lookup misses, and a
**miss is indistinguishable from "never installed"** — so the installer installs
it again. Nothing is overwritten and nothing errors; there are simply two rows
where there was one.

## What it would have done

The em-dash sweep reworded **32 system automation names**. Thirty of them send an
email: order confirmation, shipping confirmation, delivered, cancelled, refunded,
payment failed, every subscription notice, and the whole dunning ladder.

`seeds/reconcile.ts` is driven **daily by the automation worker** across every
tenant with the module active. So on the first reconcile after release, every
tenant would hold two active copies of each of those thirty rules, and every
customer would get every one of those emails twice. The old copy is not paused,
disabled or marked — it is a normal active rule that nobody asked for.

The two smaller ones follow the same rule to smaller effect: an existing account
would be offered a shipping preset it already has (and applying it lays a second
worldwide zone, with its own priority, over the first), and a blueprint update
would report the renamed email as _one removed, one new_ and create a second copy
of it in the account.

## Why no check caught it

Everything was green. Typecheck, lint, prettier, `check:brand`,
`check:blueprint-versions`, and every test task. A renamed string is a valid
string; only the **runtime consequence** is wrong, and no static check reads a
name as an identity.

The test suite could not catch it either, for a reason worth recording: these are
DB-backed integration suites, and the pre-push guard runs with `CI=true`, which
excludes them. The sweep's earlier "109/109 tasks pass" was a **CI-mode** run.
Two stale assertions were sitting in those suites unseen, and one of them was a
time-of-day flake (below).

## The fix

**Not a rename migration.** Renaming the rows would have fixed this release and
left the next one to walk into the same hole, since the mechanism would still be
"the sentence is the key".

`SystemAutomationSpec` gains `previousNames`. The lookup tries the current name
first, then any former name, and **adopts and renames** the row it finds:

```ts
const existing =
  (await tx.automation.findFirst({ where: { origin: 'system', name: spec.name } })) ??
  (spec.previousNames?.length
    ? await tx.automation.findFirst({
        where: { origin: 'system', name: { in: [...spec.previousNames] } },
      })
    : null);
```

All 32 renamed seeds declare what they used to be called, permanently. Adoption
is scoped to `origin='system'`, so a rule the business wrote itself is never
touched even if it happens to carry the old name.

The shipping marker accepts both spellings the same way. The blueprint ledger
has no such hook, so its one renamed key moves in a migration
(`20270506000000_blueprint_email_keeps_its_ledger_key`); only the KEY moves, which
lets the rename reach the tenant as an ordinary offered update rather than this
migration reaching into their content. A second migration
(`20270507000000_shipping_preset_names_lose_their_em_dash`) refreshes the three
preset-written names, because a preset has no update path at all and whatever it
wrote stays written.

## How it was proven

The completeness check is a measurement, not a reading. Every `origin='system'`
name in the database, checked against source:

```
current 56, former 32, db 56, unmatched 0
```

Three of the unmatched were rules added earlier in this run and already seeded
into 43 tenants under a dashed name; they carry an alias now too.

Three tests, each proven red by removing the thing it guards:

- adoption: `expect(rows).toHaveLength(1)` — **2 with the fix removed**, which is
  the defect stated as a number
- idempotence: three re-runs after the rename still leave one row
- ownership: a tenant-authored rule of the same old name is left alone

## Two stale things the integration suites were hiding

**A test asserting copy that had legitimately changed.** `seeds-no-email.test.ts`
expected `'Follow up — Acme retrofit'`; the seed now writes `'Follow up: …'`.

**A fixture that had quietly become time-dependent.** `scanners.test.ts` built a
due date as `Date.now() + N days + 12h`, the `+12h` being a nudge written for the
old _elapsed hours_ arithmetic. `daysUntilDue` now counts **UTC calendar
boundaries**, so that nudge lands on N before noon UTC and on N+1 after it: the
suite passed all morning and failed all evening. The fixture now pins noon UTC on
the target date. The assertion was not touched — the fixture was wrong.

## The same ending, by a second door

Checking that the fix had not itself duplicated anything turned up a pair that
predates it:

```
22b8dcce… | Handle form submissions | 2026-07-14 22:16:29.537+00
22b8dcce… | Handle form submissions | 2026-07-14 22:16:29.538+00
```

One millisecond apart. That is not a rename and not a person: `upsertSystemAutomation`
is **check-then-insert with nothing underneath it**, so two overlapping seed runs
both look, both find nothing, and both create. Same ending as the rename bug, and
fixing the rename alone would have left this door open.

`20270508000000_one_system_automation_per_name` merges the duplicates into the
oldest row (re-pointing runs, versions, funnels and clone links first, so nothing
is deleted while something still names it) and adds a **partial** unique index
over `(tenant_id, name) WHERE origin = 'system'`. Partial, so a business may
still name its own automations whatever it likes. The service catches the `P2002`
that the loser of a race now gets, re-reads the winner, and applies the spec on
top, because a seed nobody is watching must not throw.

## The footgun that would have made all three migrations no-ops

All four tables involved are **FORCE RLS**, and `sparx_owner` is a non-superuser
in production. A plain `UPDATE` from a migration sees **zero rows** there while
passing locally as superuser — so every one of these migrations would have
reported success and changed nothing, and the dedupe would then have failed on
`CREATE INDEX` against duplicates it could not see.

All three now loop tenants with `set_config('app.tenant_id', …)` per tenant and
`RAISE NOTICE` the count they actually touched, following the pattern
`wizeworks/packages/db/CLAUDE.md` sets out and `20270407000000` demonstrates. The
announcement migration written earlier needs none of this: `platform_announcements`
is a global table with RLS off.

## The migrations, run and rolled back

All three were executed against the dev database inside one transaction and then
rolled back, so the SQL is proven rather than asserted, and the counts are the
ones measured beforehand:

```
NOTICE:  issue 516: 79 blueprint email artifact(s) keep their ledger key
NOTICE:  issue 516: 1 shipping zone(s) and 6 profile(s) refreshed
NOTICE:  issue 516: 1 duplicate seeded rule(s) merged into the original
CREATE INDEX
ROLLBACK
```

`CREATE INDEX` succeeding is the part worth noting: it only can once the dedupe
above it has run. Re-checked afterwards, the database still holds 79 dashed
ledger keys, 7 dashed shipping rows, 1 duplicate group and no index. Nothing was
applied; that is the pipeline's data stage to do.

## Left deliberately

Seeded email templates and chat quick replies keep their old wording on accounts
that already have them. They are seeded once, when the list is first opened, and
they are the business's own text to edit and to send to their customers. Silently
rewriting them is the thing the update machinery exists to avoid.
