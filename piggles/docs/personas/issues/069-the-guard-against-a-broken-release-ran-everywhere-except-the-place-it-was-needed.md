# 069 — The guard against a broken release ran everywhere except the place it was needed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks (chasing an observation about a missing script name)
**Surface:** the repo — `.githooks/pre-push`
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** the guard made to go red on purpose — see below

## What happened

The observation that started this was small: CLAUDE.md documents
`scripts/check-migration-order.mjs`, and every one of its fifteen sibling checks
has a `pnpm check:*` alias, but this one had none. `pnpm check:migration-order`
was not a command.

Chasing it found the real thing. **The pre-push hook did not run it.** The hook's
own first line says it "runs the exact checks CI runs so red builds never reach
main", and it runs fifteen structural checks — brand isolation, event topics,
surface routes, Dockerfile paths, billing plans, console parity. Migration
ordering was not among them, though CI has a job for it.

What that guard prevents, in CLAUDE.md's own words: `prisma migrate dev` stamps
the real clock, this repository's migration prefixes run about six months ahead
of it, so a fresh migration sorts **before** all 241 already applied. Prisma
orders by name, so `migrate deploy` **refuses the whole release — mid-release,
after the roles Job has already run.** And it cannot be renamed away afterwards,
because the directory name is the primary key in `_prisma_migrations` on every
deployed database.

So the one check whose failure mode is "the release stops halfway" was the one
check a developer could push past.

## What should have happened

The hook runs it, like the other fifteen. That is the hook's whole contract, and
CLAUDE.md states the property that makes the contract worth having: the guard "is
never stricter than CI, which is what keeps it from being bypassed." A check CI
runs and the hook does not is the gap in that.

## How to reproduce

```
grep -c 'check-migration-order' .githooks/pre-push   # was 0
pnpm check:migration-order                           # was: command not found
```

## Why it matters

It is not a tenant-facing defect and it does not touch Marisol's bakery. It is
the thing that stops a deploy dying between the schema and the containers, which
is the worst moment for one to die — the release has already taken locks and the
old containers are still serving.

It is also the shape recorded in [[feedback_structural_checks_go_blind]]: a guard
that exists, is documented as enforced, and runs in fewer places than the prose
claims.

## Where it lives

- [.githooks/pre-push](../../../../.githooks/pre-push) — the fifteen structural checks
- [package.json](../../../../package.json) — sixteen `check:*` aliases, one short
- [scripts/check-migration-order.mjs](../../../../scripts/check-migration-order.mjs) — the guard itself, which was fine all along

## The fix

- `check:migration-order` added to the root scripts, matching every sibling.
- The check added to the pre-push structural block, with a failure message that
  says what went wrong AND names the cause — `prisma migrate dev` stamping the
  real clock — because the remedy is to rename the directory, not to re-run the
  command that produced it.
- The step banner now names it, so the hook's output says what actually ran.

No argument is passed: the script already defaults its base ref to `origin/main`,
which is what CI passes it on a push.

## Confirmed by

**The guard was made to fail on purpose.** In a throwaway detached worktree at
HEAD — no branch moved, nothing in the real tree touched — a migration was
planted named `20260821000000_guard_redness_probe`, which is what `prisma migrate
dev` would stamp today:

```
Migration ordering check FAILED (base: origin/main)

  OUT OF ORDER  20260821000000_guard_redness_probe
                sorts at or before 20270329000000_tenant_billing_plan, which is already applied.
                …
                Rename the directory to something greater than 20270329000000_tenant_billing_plan.

EXIT=1
```

Worktree removed, `git worktree list` clean, HEAD unchanged at `dd1c3e61a`.

Two things that came out of proving it:

- **The check reads committed refs**, via `git ls-tree` on `HEAD` and the base —
  not the working tree. That is deliberate and right for a pre-push hook (a push
  carries commits), but it means an uncommitted migration is invisible to it, and
  a first attempt to make it go red from the working tree printed a false
  **"OK: no migrations added."**
- **The four migrations currently untracked in the tree** —
  `20270330000000_platform_announcements`, `…331_property_show_platform_credit`,
  `…401_uncounted_products_are_sellable`, `…402_counted_at_zero_products_are_sold_out` —
  all sort after `20270329000000_tenant_billing_plan`, so they pass the moment
  they are committed.
