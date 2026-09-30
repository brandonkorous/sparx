# 805 — Every prisma command died before it read its own arguments

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 280 (while applying 777 and 801)
**Surface:** `wizeworks/packages/db` — the migration toolchain
**Filed:** 2026-09-24
**Fixed:** 2026-09-24
**Confirmed by:** the two migrations this issue blocked, applied
**Blocked on:** —

## What happened

Brandon stopped the dev stack and asked for the two waiting migrations to be
applied. The first command failed, and so did every other one:

```
$ prisma migrate status
Failed to load config file ".../wizeworks/packages/db/prisma.config.ts" as a
TypeScript/JavaScript module. Error: Error: Cannot find module 'dotenv/config'
Require stack:
- G:\code\@wizeworks\sparx.works\wizeworks\packages\db\prisma.config.ts
```

Not `migrate status` in particular. `prisma.config.ts` is loaded before the
arguments are parsed, so the failure is the same for `migrate deploy`,
`generate`, `studio`, `validate`, `db:seed` and even `--version`. The whole CLI
was unreachable from the package that owns the schema.

## What should have happened

`pnpm --filter @wizeworks/db db:migrate:deploy` applies the pending migrations.
That is the documented local path in
[wizeworks/packages/db/CLAUDE.md](../../../../wizeworks/packages/db/CLAUDE.md),
and it is the one the release pipeline's data stage takes.

## How to reproduce

Every time, on a clean checkout:

1. `cd wizeworks/packages/db`
2. `./node_modules/.bin/prisma --version`

## Why it matters

The schema package could not run its own tool. Two migrations sat waiting on it
across several acts, and the reason they would not go in was read as "the
database is off limits" rather than "the CLI is broken" — nobody had got far
enough to see the error, because the error only appears once someone tries.

It hid two further things. Nothing in the repo could have caught it:
`prisma.config.ts` sits at the package root, outside `include` in
`tsconfig.json` (`src/**`, `prisma/*.ts`, `scripts/**`), and eslint ignores it.
An import of a package that is not a dependency survived both gates because
neither gate was looking at the file.

## Where it lives

- `wizeworks/packages/db/prisma.config.ts` line 7, `import 'dotenv/config';`
- `wizeworks/packages/db/package.json` — `dotenv` is in no dependency list
- `wizeworks/packages/db/tsconfig.json` — `include` did not reach the file

`dotenv` is declared by 20-odd sibling packages and resolves fine in each of
them. pnpm links strictly, so a package that does not declare it does not get
it, and the store copy at `node_modules/.pnpm/dotenv@16.6.1` is not on any
resolution path from here.

## The fix

**Not** by adding the dependency. That needs a lockfile change, `pnpm install`
is the user's to run, and the pre-push guard runs
`pnpm install --frozen-lockfile`, so a package.json edit on its own would have
turned one broken command into a broken push.

Node has done this job itself since 20.12. `process.loadEnvFile()` reads `.env`
with the same parser as `--env-file`, and, like dotenv, leaves a variable alone
if it is already set, so a real environment still beats a local file. Verified
rather than assumed:

```
$ FOO=from_shell node -e "process.loadEnvFile(); ..."
FOO(preset) = from_shell      <- the environment won
BAR(new)    = from_file
```

It throws when there is no `.env`, which is the normal case in CI and in the
release pipeline, so the call is wrapped and the miss is ignored.

Then the hole that let it through: `prisma.config.ts` is added to `include` in
`wizeworks/packages/db/tsconfig.json`.

Files:

- `wizeworks/packages/db/prisma.config.ts`
- `wizeworks/packages/db/tsconfig.json`

## Proved red

The point of widening `include` is that it would have caught this. Restoring the
old line and running the package's own typecheck:

```
prisma.config.ts(7,8): error TS2882: Cannot find module or type declarations
for side-effect import of 'dotenv/config'.
```

Exit 2. With the fix in place, exit 0.

## Confirmed by

The two migrations this blocked, applied through the real path on 2026-09-24:

> `prisma migrate deploy` — 332 migrations found, 2 applied,
> `20270515000000_a_letterhead_belongs_to_one_business` and
> `20270516000000_a_note_only_your_team_sees`. `migrate status` then reads
> "Database schema is up to date!", and `prisma validate` reads
> "The schemas at prisma\schema are valid".

Both from `wizeworks/packages/db` with the repo's own `prisma.config.ts`, no
flags and no workarounds.

## Rating effect

None. No pane changed.
