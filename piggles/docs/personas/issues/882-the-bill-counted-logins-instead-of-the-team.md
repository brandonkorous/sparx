# 882 — The bill counted logins instead of the team

**Status:** fixed
**Severity:** **major** — the one meter on the card headed _"What changes your
bill is scale: how many people"_ counted the wrong table. A teammate who signed
up before accepting an invitation never moved it, ever
**Found by:** P03 · act 313, reading her account page after hiring somebody
**Surface:** getpiggles › Your account › What you are using
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** measurement across every tenant on the database, before and
after; and her own card, which read 1 and now reads 2

## What she saw

Devi has two people on her team. Her account page said:

```
People on your team        1
Websites                   7
Locations                  2
```

## Measured

```
members on the platform                                       40
  · whose user row is stamped with a DIFFERENT tenant           4      invisible to the meter
tenants                                                      113
  · holding no member row at all                              76      37 of them not test fixtures
```

## The chain

Both readers asked the same wrong question, in the same words:

```ts
safe(() => withTenant(ctx, (tx) => tx.user.count())),
```

`users` is the platform's login table and carries a `tenant_id` naming the
account a login was **created under**. "People on your team" is a different
question, and the two part company the moment somebody joins a team they did
not create — which is the only way anybody but the owner ever gets on one.

Nadia signed up, then accepted Devi's invitation. Her rows:

```
users.tenant_id      Nadia's workspace          ← what the meter counted
members              Juniper Row, editor        ← where she actually works
```

So she is an active editor of Juniper Row and the seat meter cannot see her.

The irony is in the live reader's own header, explaining why seats is counted
live rather than read from last night's snapshot:

> _"a person who has just invited a teammate and is looking at '3 of 3 users'
> would reasonably conclude the invitation failed."_

The count was made instant for precisely the case it could not see.
[[feedback_a_screen_over_a_function_nobody_calls]]

And one branch below it, `locations` had been fixed on 2026-09-25 for the same
species of mistake, with the rule written out:

> _"The nightly snapshot and the live report have to agree or the card shows one
> number and the bill is worked out from another."_

Its neighbour, two lines up, counted a different table from the one the question
was about. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

One helper, `countSeats`, used by both readers so they cannot drift:

```ts
const [members, invited] = await Promise.all([
  tx.member.count(),
  tx.invitation.count({ where: { status: 'pending', expiresAt: { gt: now } } }),
]);
return members + invited;
```

**Invitations count**, because the Team roster settled that already and a second
screen answering the same question must not settle it differently:

> _"She either is or she isn't. If she was invited yesterday she is on the team
> and hasn't logged in yet, which is a STATE, not a category."_

`pending` and unexpired, exactly as `GET /v1/team/invitations` filters, so the
two lists are the same list. A withdrawn or lapsed invitation drops out on its
own with no sweep to run.

The nightly snapshot passes the **end of the day it is measuring** rather than
`new Date()`, so re-running it for an old day reproduces that day's number
instead of today's.

## The second half: 76 tenants with nobody on the team

Changing the question exposed the answer for everyone else. 76 of 113 tenants
hold **no member row at all** — their owner can sign in, because the session
carries the role, and is not on their own team.

That is not old data. `seed-tenant.ts` provisions a demo tenant as tenant +
property + user + credential, and its own comment says it does this "through the
real signup path". The real signup path writes a member row;
`provision-tenant.ts` and `provision-invited-owner.ts` each follow the user with
exactly the same five-field create. This one skipped it.

For those tenants the owner opens Team and does not find themselves, and there
is no member row to hang a role, a module limit or a site limit on. A demo
tenant is what a prospect is shown.

Both halves fixed: the create is there now, and `loadExistingTenant` repairs on
re-run through `createMany ... skipDuplicates`, because "additive and
idempotent" has to mean the tenant ends up RIGHT rather than merely untouched. A
seeder that can only fix the ones it has not made yet fixes nothing already out
there. [[feedback_data_is_a_deploy_stage]]

## Proved

Not a committed test: `@wizeworks/usage` has vitest but no database-backed
harness and CI runs without a database, so a `.test.ts` reading real rows would
go red there. Proved the way the renewal in 878 was — against the database, and
on the screen.

Every tenant, old rule against new:

```
Juniper Row                      1  →  2      the truth
AA Test aa-test-97cc000c0e       1  →  0
Harvest Pantry                   1  →  0      ← the 76, until the seeder is re-run
Northwind Studio                 1  →  0
…
```

The zeros are honest rather than new: those tenants have nobody with a
membership, which is the finding above, and the seeder's repair turns each of
them into 1 on its next run.

**On her own card:** it read **1** before and reads **2** now, with Nadia listed
on the Team roster beside it.

**Checks:** api-rest 109 files / 663 tests, `@wizeworks/usage` 18. Typecheck 0
on `@wizeworks/usage` and api-rest. ESLint and prettier clean.

## Files

- `wizeworks/packages/usage/src/seats.ts` (new)
- `wizeworks/packages/usage/src/index.ts`
- `wizeworks/packages/usage/src/report.ts`
- `wizeworks/services/api-rest/src/lib/seed-tenant.ts`

## Measured and deliberately NOT filed

The three figures reading **"Not measured yet"** — Customers, Photos and files,
Messages sent this month — are correct. They are stocks and flows read from the
nightly snapshot, the tenant has never been snapshotted, and the card says so
underneath: _"Your first overnight count has not run yet, so some of these are
still blank."_ An absence presented as an absence, which is the rule working
rather than failing. [[feedback_never_present_absence_as_measurement]]

## The thing to remember

**A count is a sentence, and the table you count is the noun in it.** Nothing
about `tx.user.count()` looks wrong: it is scoped by RLS, it returns a plausible
small number, it never throws, and on the tenant where the owner is the only
person it is exactly right. It is wrong only for the case the feature exists
for.

The measurement that finds this shape is not "is the number plausible" — it was.
It is **"ask the same question a second way and see whether the two agree."**
Count the team from the roster and from the meter, and where a tenant's two
answers differ, one of them is reading the wrong noun.
