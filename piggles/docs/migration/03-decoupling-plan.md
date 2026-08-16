# Track A plan — six phases to a deletable sparx

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

Findings: [02-dependency-audit.md](02-dependency-audit.md). Checkboxes:
[TRACKER.md](TRACKER.md). This document is the reasoning — why the phases are in
this order and what "done" means for each.

## Ordering, and why it is not negotiable

**A0 first, always.** Thirty-something steps run over weeks against a tree five
other things are also changing. A ratchet that counts `@sparx/*` references in
`piggles/` and fails on an increase is the only thing that keeps the number
falling. Without it the count grows during the migration and nobody notices until
the deletability test fails at the end, by which point the cause is buried.

**Brand before rename.** A1 and A2 fix things that are _wrong_ — sparx's mascot
on a Piggles screen, invitation emails to the wrong host. A3's rename is
cosmetic by comparison and touches 6,564 sites. Do the small correct thing before
the large mechanical thing, so a rollback of the mechanical thing does not take
the fixes with it.

**Rename before move.** A3 changes names, A4 changes paths. Together they would
produce a diff nobody can review — every import line changes for two unrelated
reasons at once. Separately, each is verifiable: after A3 the tree is identical
and the names are right; after A4 the names are identical and the tree is right.

**The test last, and then permanently.** A5 makes the invariant a CI job. Until
then it is an assertion.

---

## A0 — Guardrails

Replace [check-piggles-isolation.mjs](../../../scripts/check-piggles-isolation.mjs)
with `scripts/check-boundaries.mjs`, per the spec already written in
[wizeworks/CLAUDE.md](../../../wizeworks/CLAUDE.md) § `check:boundaries`.

Rules, all on the same script:

1. `wizeworks/**` may not import `sparx/**` or `piggles/**` _(inert until A4)_
2. no import crosses between `sparx/**` and `piggles/**` _(today: `apps/**` ↔ `piggles/**` — keep the existing patterns)_
3. no literal hex under `wizeworks/**` outside the two sanctioned exceptions
4. no brand-name literal in a user-facing string under `wizeworks/**`
5. **Ratcheted `@sparx/*` usage inside the piggles tree.** A baseline file
   records the count (305 today, per package). The check fails if any package's
   count rises.

Rule 5 is the new one and the reason the phase exists. It is a ratchet rather
than a ban because a ban would fail on day one and get disabled.

Wire into `package.json` scripts, [.githooks/pre-push](../../../.githooks/pre-push)
and CI alongside `check:events` / `check:routes` / `check:docker`.

**Exit:** `pnpm check:boundaries` green; artificially adding one `@sparx/query`
import to a Piggles file makes it red.

---

## A1 — Evict sparx brand from `piggles/`

Six edits. Three fix live, visible bugs.

| Step | File                                        | Change                                                                                                                                                                                  |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1.1 | `components/pane-waiting.tsx`               | `SparkMascot` → `@piggles/mascot`. Pick the intent from the catalog (`loading` exists as art). **Highest priority in the whole plan — sparx's mascot is on screen right now.**          |
| A1.2 | `components/spark-field.tsx`                | `SPARK_PATH` / `SPARK_VIEWBOX` → the Piggles mark from `@piggles/brand`, or delete the component if the decoration earns nothing                                                        |
| A1.3 | `surfaces/onboarding/onboarding-layout.tsx` | `<Wordmark aria-label="sparx" />` → `@piggles/brand` `Logo`. Blocks **B3.4**                                                                                                            |
| A1.4 | `lib/tour/*` (8 files)                      | **Decide: delete or port.** Currently unreachable and carrying sparx marks. Deleting also drops the `driver.js` dependency. Porting means Piggles marks + a mount site. Blocks **B3.1** |
| A1.5 | `app/globals.css:33-34`                     | `@sparx/brand/{silica-gaps,toast}.css` → move both files to a brand-blind package (`@wizeworks/silica-gaps`, or fold into `brand-core` in A2.3) and re-point. sparx re-points too       |
| A1.6 | `apps/workbench/package.json`               | Drop the `@sparx/ui` dependency — declared, imported zero times                                                                                                                         |

**Exit:** `grep -rE "@sparx/(brand|ui)" piggles/` returns nothing. Console builds.
Every mascot, mark and wordmark visible in the Piggles console comes from
`@piggles/*`.

---

## A2 — De-sparx the shared packages

### A2.1 — brand-aware `appOrigin()` _(blocks B2.3)_

[packages/links/src/server.ts:21](../../../packages/links/src/server.ts#L21)
hardcodes `https://app.sparx.works` and `appOrigin()` takes no brand.

Make the origin a **per-brand lookup**, resolved from `Tenant.platformBrand`
where there is no request and from the hostname where there is. Callers that hold
a tenant pass the brand; callers that do not get an explicit default and a
comment saying why.

Not a conditional — a table. `if (brand === 'piggles')` inside a shared package is
a boundary violation; a `Record<BrandKey, string>` built from environment is not.

Then audit every `appOrigin()` / `appLink()` caller for a brand it can supply.
Known: [api-rest team.ts:85](../../../services/api-rest/src/routes/v1/team.ts#L85)
(invitations), `lib/chat/notify.ts`, `lib/partners/payouts.ts`,
`lib/users/password-reset.ts`, `packages/auth/src/server.ts:422`.

**Exit:** an invitation minted for a tenant with `platformBrand = 'piggles'`
carries a `mypiggles.com` accept URL. Add a unit test that asserts it.

### A2.2 — `attribution` launch links

[launch-links.ts:11](../../../packages/attribution/src/launch-links.ts#L11)
`SITE = 'https://sparx.works'` → same treatment.

### A2.3 — split `@sparx/brand`

Extract the **contract** into `@wizeworks/brand-core`; leave the **values** in
`@sparx/brand`, which moves to `sparx/packages/` in A4.

| Goes to `brand-core`                                                                   | Stays sparx's                        |
| -------------------------------------------------------------------------------------- | ------------------------------------ |
| Which semantic colors are registered, and that each is a `--color-x` / `-content` pair | Every color value                    |
| The module list, and that each owns a `--color-module-<name>` pair                     | The module hue wheel                 |
| `data-theme` / `data-module` vocabulary + the `--color-module` indirection             | Radius, type and density values      |
| Shape/type token _names_ (`--radius-box`, `--font-sans`, …)                            | Marks, wordmark, mascot geometry     |
| `statusTone()`'s vocabulary                                                            | `theme.css`                          |
| `silica-gaps.css`, `toast.css` (from A1.5)                                             | `mascot.css` motion, if sparx-shaped |

`@piggles/brand` then implements the same contract. This is the split
[wizeworks/CLAUDE.md](../../../wizeworks/CLAUDE.md) already specifies — read it
before starting; do not re-derive the line.

### A2.4 — sweep the remaining 29

Grep each Class-1 package for brand literals in _code_ (not comments). A0 rules
3 and 4 turn this from a sweep into a permanent gate once the packages land under
`wizeworks/` in A4.

**Exit:** no shared package contains a sparx hostname, hex, or product name
outside a comment.

---

## A3 — The rename

`@sparx/<x>` → `@wizeworks/<x>` for all 31 Class-1 packages. `@sparx/brand` keeps
its name (it is sparx's); `@sparx/ui` keeps its name.

**Scripted.** `scripts/codemod-scope-rename.mjs`, run and re-run, never hand
edits. It rewrites: package `name` fields, `dependencies` / `devDependencies`
keys, every import and `require`, CSS `@import` and `@source`, `tsconfig`
references, Dockerfile `COPY` and `--filter` args, workflow paths, and
`pnpm-lock.yaml` via a fresh `pnpm install`.

**In dependency-layer waves, leaves first.** A package's `name` and every
importer change in the same commit or the workspace does not resolve.

1. Leaves — `field-schema`, `*-schemas`, `events`, `modules`, `time`
2. Mid — `db`, `auth`, `query`, `api-core`, `api-client`, `app-kit`, `links`, `attribution`, `migration`
3. Consumers — `email*`, `legal*`, `blueprints`, `integrations`, `cms-editor`, `silica-catalog`, `site-themes`, `social`, `builder-schemas`, `story-schemas`, `sitebuilder-schemas`, `marketplace-schemas`

The 368 references in `marketplace-catalog/` and the `.tmp/` scratch files are in
scope for the codemod; the `.tmp/` ones can be deleted instead.

**Exit:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test` green.
`grep -r "@sparx/" --include='*.ts*' . | grep -v node_modules` returns only
`@sparx/brand` and `@sparx/ui`.

---

## A4 — The tree move

| From                  | To                          |
| --------------------- | --------------------------- |
| `packages/`           | `wizeworks/packages/`       |
| `services/`           | `wizeworks/services/`       |
| `apps/`               | `sparx/apps/`               |
| `packages/{brand,ui}` | `sparx/packages/{brand,ui}` |

`apps/admin` and `apps/site` go to `wizeworks/apps/` — admin is the WizeWorks
staff console, site paints the tenant's brand and is indifferent to which brand
sold it. Both are argued in wizeworks/CLAUDE.md; do not re-litigate.

Then update, in one commit each: `pnpm-workspace.yaml`, `Dockerfile.base`, the
34 hand-enumerated `COPY` lines in
[piggles/apps/workbench/Dockerfile](../../apps/workbench/Dockerfile) (**replace
with a glob — the enumeration is why this hurts**), `release.yml` path filters and
image matrix, `turbo.json`, `eslint.config.js` ignores, `.prettierignore`,
`.githooks/pre-push`, and every `scripts/check-*.mjs`.

Use `git mv` so history follows. Activate A0 rule 1.

**Exit:** `pnpm install && pnpm build` green from a clean checkout; a container
image builds for one sparx app, one piggles app, and one service.

---

## A5 — Prove it, permanently

```bash
git worktree add ../deletability HEAD
cd ../deletability
rm -rf sparx/
pnpm install
pnpm --filter '@piggles/*' typecheck && pnpm --filter '@piggles/*' build
docker build -f piggles/apps/workbench/Dockerfile -t piggles-console:test .
```

Ship it as `scripts/check-deletability.mjs` and a CI job. Run it on `main`, not on
every PR — it is a full install.

Then delete this line from the old isolation check's rationale and from
piggles/CLAUDE.md: _"What is ALLOWED, deliberately: `@sparx/_` package imports."\*
It is no longer true, and a stale allowance in a binding file is how the next
coupling arrives.

**Exit:** the job is green on `main`, and it is red if someone re-adds an
`@sparx/*` dependency to `piggles/`.
