# Track A findings — the `@sparx/*` dependency surface

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

The question this audit answers: **if `sparx/` were deleted next week, what
breaks in Piggles?**

Answer, today: everything. Not because Piggles depends on sparx's _application_ —
[scripts/check-piggles-isolation.mjs](../../../scripts/check-piggles-isolation.mjs)
already forbids that and it passes — but because the platform Piggles runs on is
named, located, and in four places _written_, as sparx's.

## The numbers

| Measure                                                   | Count |
| --------------------------------------------------------- | ----: |
| `@sparx/*` packages declared in `piggles/**/package.json` |    21 |
| Transitive closure of those 21                            |    34 |
| `@sparx/*` reference sites in `piggles/`                  |   305 |
| `@sparx/*` reference sites repo-wide                      | 2,887 |
| `@sparx/*` occurrences repo-wide                          | 6,564 |
| Total packages under `packages/`                          |   ~90 |

The 34 are the migration surface. The 6,564 are the codemod's job.

## Declared dependencies, by consumer

```
piggles/apps/workbench     api-client app-kit attribution auth automation-schemas
                           brand builder-schemas cms-editor commerce-schemas
                           crm-schemas db email-sequences links migration query
                           silica-catalog site-themes social story-schemas ui
piggles/apps/account       auth db events
piggles/packages/auth-handoff   auth db
piggles/apps/web           (none)
piggles/packages/{brand,config,mascot}   (none)
```

Pulled in only transitively (13): `api-core blueprints cms-schemas email
email-sends field-schema integrations legal legal-seed legal-templates
marketplace-schemas modules sitebuilder-schemas`.

Heaviest by reference count in `piggles/`: `query` (183), `api-client` (98),
`auth` (35), `brand` (27), `commerce-schemas` (24), `crm-schemas` (19),
`automation-schemas` (18), `db` (15).

## Classification

### Class 1 — brand-blind, misnamed only (31 packages)

Already platform code. Nothing inside them expresses sparx; the scope was chosen
when sparx was the only product. Sampled `@wizeworks/query` — every "sparx" hit is a
comment or a docstring naming the import path.

```
api-client api-core app-kit automation-schemas blueprints builder-schemas
cms-editor cms-schemas commerce-schemas crm-schemas db email email-sends
email-sequences events field-schema integrations legal legal-seed
legal-templates marketplace-schemas migration modules query silica-catalog
site-themes sitebuilder-schemas social story-schemas
```

(29 listed; `links` and `attribution` are Class 3.)

**Action: rename and relocate.** No rebuild. `@wizeworks/db` in particular must never
be forked — one schema, 277 models, 164 migrations, one database, one tenant
pool. Two copies of it is the failure mode the shared database exists to prevent.

### Class 2 — genuinely sparx, must leave the shared tree (2 packages)

**`@sparx/brand`** — sparx's marks, wordmark geometry, mascot, and token
_values_. Piggles imported it in five files.

> **Corrected 2026-08-16, while fixing it.** This section originally said three
> of the five "put sparx on screen", with `pane-waiting` live on every pane load.
> That was wrong, and reachability was the thing not checked: `pane-waiting` goes
> through a product seam, Piggles registers `StateArt`, and `StateArt` draws
> every state including `waiting` — so the sparx branch could never run.
> `spark-field` and the onboarding header were reachable only from the unmounted
> gate; the two tour files from nothing at all. **All five were real dependency
> edges and all five had to go** — the deletability test does not care whether a
> branch executes. Only the severity was overstated, and only for the first row.

| File                                                                                                               | What it was                                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [components/pane-waiting.tsx:44](../../apps/workbench/components/pane-waiting.tsx#L44)                             | `<SparkMascot …/>` — an unreachable fallback behind the `StateArt` seam    |
| [components/spark-field.tsx:24](../../apps/workbench/components/spark-field.tsx#L24)                               | `SPARK_PATH` — sparx's spark glyph as a decorative field                   |
| [surfaces/onboarding/onboarding-layout.tsx:30](../../apps/workbench/surfaces/onboarding/onboarding-layout.tsx#L30) | `<Wordmark size={38} aria-label="sparx" />` — the sparx wordmark, labelled |
| [lib/tour/first-run-tour.tsx:105](../../apps/workbench/lib/tour/first-run-tour.tsx#L105)                           | `<SparkMascot … title="sparky" />` — unmounted, still wrong                |
| [lib/tour/module-tour-offers.tsx:219](../../apps/workbench/lib/tour/module-tour-offers.tsx#L219)                   | `<SparkMascot>` — unmounted                                                |

Piggles already owns `@piggles/brand` (marks, theme, layers) and
`@piggles/mascot` (45 mascot images, a catalog, an intent map). The imports above
are fork residue, not a decision.

Two CSS files inside `@sparx/brand` are **not** sparx and are imported by the
Piggles console at [globals.css:33-34](../../apps/workbench/app/globals.css):

- `silica-gaps.css` — its own header says _"NOT sparx styling"_; additive
  corrections to silicaui components, deletable the day silica ships them.
- `toast.css` — a platform-wide silica correction, written against silica's own
  custom properties.

Both belong in the shared tree. They live in `@sparx/brand` for the historical
reason that workbench imports no `@wizeworks/ui` CSS.

**`@wizeworks/ui`** — sparx-specific compositions over silicaui. Declared as a
dependency of `piggles/apps/workbench` and imported **zero times**. Dead edge;
drop it.

### Class 3 — brand-blind code with a sparx value hardcoded (2 packages)

The most damaging class, because the package looks neutral and the constant is
not.

| Location                                                                                                       | Constant                                     | Consequence                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [wizeworks/packages/links/src/server.ts:21](../../../packages/links/src/server.ts#L21)                         | `DEFAULT_ORIGIN = 'https://app.sparx.works'` | Every absolute link the platform builds for a Piggles tenant — invitation emails, chat notifications, partner payouts — points at sparx. `appOrigin()` reads one global env var with no brand input. |
| [wizeworks/packages/attribution/src/launch-links.ts:11](../../../packages/attribution/src/launch-links.ts#L11) | `SITE = 'https://sparx.works'`               | UTM/launch links are sparx-only.                                                                                                                                                                     |

`wizeworks/packages/api-client` has 37 "sparx" hits; all are comments or example URLs in
docstrings. Harmless, but they are why a grep-based audit overcounts — the
codemod must not treat prose as code.

## Structural blockers

The invariant cannot be _tested_ today because there is no `sparx/` tree to
delete. `apps/` (five sparx Next apps), `packages/` (~90), and `services/` (~18)
all sit at the repo root as peers of `piggles/`.

Four places hardcode those paths and break on a move:

1. **[pnpm-workspace.yaml](../../../pnpm-workspace.yaml)** — globs `apps/*`,
   `packages/*`, `services/*`, `piggles/apps/*`, `piggles/packages/*`.
2. **[Dockerfile.base:72-105](../../../Dockerfile.base)** — copies `packages` and
   `services` wholesale, and `pnpm install --filter "@wizeworks/db..."`.
3. **[piggles/apps/workbench/Dockerfile:54+](../../apps/workbench/Dockerfile)** —
   enumerates **34 `packages/*/package.json` COPY lines by hand**, one per
   transitive dependency. Already a maintenance hazard; a rename invalidates
   every line.
4. **[.github/workflows/release.yml](../../../.github/workflows/release.yml)** —
   change detection diffs runtime paths `apps/ services/ packages/ k8s/`
   (line ~805, ~1224); image matrix names `wizeworks/packages/db/Dockerfile`; the Azure
   bootstrap reads `wizeworks/packages/db/sql/azure-bootstrap.sql`.

Plus `eslint.config.js` ignores, `.prettierignore`, `turbo.json`, and the
structural check scripts.

## What is already right

- **Brand is a runtime value.** `Tenant.platformBrand String @default("sparx")`
  ([02-tenant.prisma:91](../../../packages/db/prisma/schema/02-tenant.prisma))
  exists, is documented as never changing for a tenant, and is explicitly not a
  build-time constant. Every brand-resolution fix in this plan reads it.
- **The app-level boundary holds.** `check:piggles-isolation` passes: no import
  crosses between `apps/**` and `piggles/**` in either direction.
- **Services are a runtime edge, not an import.** The console reaches `api-rest`
  via `NEXT_PUBLIC_API_URL`. Services are platform under the target
  architecture, so this needs no change beyond the tree move.
- **The target is already written down.**
  [wizeworks/CLAUDE.md](../../../wizeworks/CLAUDE.md) declares the three trees,
  the dependency invariant, the rename "in flight", and a `check:boundaries`
  gate. Only the CLAUDE.md exists.

## Why `check:piggles-isolation` did not catch this

Its header is explicit:

> What is ALLOWED, deliberately: `@sparx/*` package imports. Those are libraries
> under `packages/`, not the sparx application — deleting the sparx APPS does not
> delete them, so depending on one does not couple the two products.

That reasoning was correct for the boundary it was defending and is the wrong
boundary now. It defends _"Piggles must not import sparx's app code"_. The
invariant we actually need is _"deleting `sparx/` must not affect Piggles"_ — and
under that one, a package named `@wizeworks/db` sitting outside any `sparx/` tree is
an unanswered question, not a pass. **A0** replaces the check rather than
extending it.
