# Piggles migration — index

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

Two pieces of work, tracked together because they collide in three places.

**Track A — decoupling.** Piggles must survive the deletion of sparx. Today it
does not: `piggles/` declares 21 `@sparx/*` dependencies (34 with the transitive
closure), renders sparx's mascot and wordmark on screen, and every link the
platform mails a Piggles customer points at `app.sparx.works`.

**Track B — console completeness.** `piggles/apps/workbench` was forked from
`apps/workbench` on 2026-08-14. Nineteen files came across as copies that nothing
mounts, four OAuth callback routes did not come across at all, and the surfaces
that link to them 404 today.

## The documents

| Doc                                              | What it is                                                     |
| ------------------------------------------------ | -------------------------------------------------------------- |
| [01-console-gaps.md](01-console-gaps.md)         | Track B findings — what the fork left behind, with file refs   |
| [02-dependency-audit.md](02-dependency-audit.md) | Track A findings — every `@sparx/*` edge, classified           |
| [03-decoupling-plan.md](03-decoupling-plan.md)   | Track A plan — six phases, ordered, with exit tests            |
| [TRACKER.md](TRACKER.md)                         | **The checklist.** Every step, an id, an exit test, a checkbox |

Work the TRACKER. The other three exist so a step's one-line description is
enough — when it isn't, the finding behind it is linked.

## The argument, in one page

### Renaming is necessary. Rebuilding is not.

The instinct is to rebuild the `@sparx/*` packages as `@wizeworks/*` copies owned
by Piggles. Do not. Of the 34 packages in the closure, **31 are already
brand-blind platform code** — a Prisma client, a query wrapper, a schema set, an
API client. They were misnamed, never miswritten. The scope said `@sparx` because
sparx was the only product when they were written.

Rebuilding them would mean two Prisma schemas against one database, two auth
configurations against one tenant pool, and two copies of every module schema
drifting apart. That is not decoupling; it is the coupling the shared database
already forbids.

So the shape is:

- **31 packages → rename and relocate.** `@sparx/x` → `@wizeworks/x`, moved to
  `wizeworks/packages/`. One copy, both brands import it, neither owns it.
- **3 packages → split or fix.** `@sparx/brand` and `@sparx/ui` genuinely carry
  sparx; `@sparx/links` and `@sparx/attribution` hardcode sparx hostnames inside
  otherwise-neutral code.
- **The sparx apps → move to `sparx/`.** Until they do, "delete sparx" is not an
  operation anybody can run, so the invariant cannot be tested.

### This plan is already declared

[wizeworks/CLAUDE.md](../../../wizeworks/CLAUDE.md) states the target
architecture — three trees (`wizeworks/`, `sparx/`, `piggles/`), the dependency
invariant, the `@sparx/*` → `@wizeworks/*` rename "in flight", and a
`check:boundaries` gate. Only the CLAUDE.md exists; the tree does not.

This is the execution plan for that document, not a competing one. Where the two
disagree, wizeworks/CLAUDE.md wins and this plan is wrong.

### The one test that matters

```bash
git worktree add ../deletability HEAD
cd ../deletability && rm -rf sparx/ && pnpm install && pnpm --filter '@piggles/*' build
```

Green means done. Everything in Track A exists to make that command runnable and
then to make it pass. It becomes a CI job in **A5**.

## Where the tracks collide

Three steps in Track B cannot ship until a Track A step lands. Do not sequence
around them by hand — the TRACKER records the edge.

| Track B step                  | Blocked by | Why                                                                                                                                                                          |
| ----------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B2.3 `/accept-invite`         | **A2.1**   | The accept URL is built server-side from `appOrigin()`, which is brand-blind and defaults to `app.sparx.works`. Building the page first ships a page nobody is ever sent to. |
| B3.1 first-run / module tours | **A1.4**   | The tour files render `<Spark>` and `<SparkMascot>`. Mounting them lights sparx's mascot up in the Piggles console. Decide delete-or-port once, in A1.4.                     |
| B3.4 onboarding gate          | **A1.3**   | `onboarding-layout.tsx` renders `<Wordmark aria-label="sparx" />`. Same reason.                                                                                              |

Everything else in Track B is independent and can start today.

## Working rules for this migration

1. **Guardrails before moves.** A0 lands first, always. A ratchet that counts
   `@sparx/*` references in `piggles/` and refuses an increase is what keeps the
   number falling while thirty other things are in flight. Without it the count
   grows during the migration and nobody notices until the end.
2. **The rename is scripted, never hand-edited.** 2,887 files, 6,564
   occurrences. A codemod that is run, reviewed and re-run is auditable; three
   weeks of manual edits are not.
3. **One phase per PR, one package group per commit.** A rename touches the
   package's `name` field and every importer in the same commit or the workspace
   does not resolve.
4. **Never gate on brand with a conditional.** `if (brand === 'piggles')` is a
   boundary violation under `wizeworks/`. Brand-varying behaviour arrives as a
   token, a registry entry, a lexicon lookup, or a policy the caller supplies.
5. **`Tenant.platformBrand` is the runtime source of truth.** It already exists
   (`String @default("sparx")`, [02-tenant.prisma:91](../../../packages/db/prisma/schema/02-tenant.prisma)).
   Anything resolving brand outside a request reads that row. Anything inside one
   resolves from the hostname.

## Status

Nothing is started. Every box in [TRACKER.md](TRACKER.md) is open.
