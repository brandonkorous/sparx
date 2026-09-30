# 879 — She could not keep an assistant to one of her shops

**Status:** fixed
**Severity:** **major** — a complete, guarded, audited, cache-invalidating,
already-tested access control with no way to switch it on. An owner running
several businesses under one account had to give every teammate all of them
**Found by:** P03 · act 313, sweeping Team by data weight
**Surface:** mypiggles › Team › a teammate; and the roster column beside them,
in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 12 tests, every rule proved red on a plausible wrong version;
and the first site grant ever written on this platform, made from her own screen

## Measured

```
members on the platform                                       38
  · owners                                                    35
  · with a site limit set                                      0
rows in member_property_access                                 0      ever

Juniper Row's sites                                            7
Juniper Row's team before this act                             1      (her)
```

Zero is the whole finding. The column, the junction table, the read ceiling and
three integration tests all exist. Nobody had ever been able to use them.

## What she has

Devi runs seven sites under one account: Juniper Row, plus the Sample Sale, the
Lookbook, the Archive, the Trade counter, the Press page and the Journal. They
are not sections of one shop. They are separate businesses with separate
customers and separate takings, which is the case `docs/131` exists for.

So when she takes on somebody for Saturdays on the Sample Sale, the sentence she
needs to write down is "this person works the Sample Sale". Her options were
every site or no account.

## The chain

The platform models access on **three** axes, and says so plainly:

```ts
// The org role answers "how much may this person change?" (org-roles.ts).
// Module access answers "which parts of the product may they open?"
// (module-access.ts). This answers "WHOSE data?".
```

All three are built:

- `members.property_access_mode` and the `member_property_access` junction,
  shipped in `20261211000000_p0_site_scoping`
- `roleIgnoresPropertyAccess`, `memberCanReachProperty` in
  `@wizeworks/auth/property-access`
- the read ceiling in `api-core/src/auth.ts`, with a per-`(tenant, user)` cache
  that `PATCH /v1/team/members/:id` **invalidates on write**, so a revoked grant
  bites immediately
- `PATCH /v1/team/members/:id` accepts `propertyAccessMode` and `properties`,
  refuses ids the tenant does not own, replaces the grant set inside one
  transaction, writes audit rows, and refuses a limit on an owner or admin with
  a sentence that says what to do instead
- `GET /v1/team/members` **returns both fields**
- `member-site-access.test.ts` proves the refusal through real routes, closing
  three separate doors

And then:

```ts
/** The editable half of a member, which is exactly what PATCH accepts. */
interface AccessForm {
  role: string;
  moduleAccessMode: 'all' | 'selected';
  modules: string[];
}
```

That is the teammate pane, in **both** consoles. `TeamMember` in each console's
API client stopped at `modules` too, so the two fields the server sent fell off
the wire before any screen could draw them.
[[feedback_fetched_but_never_rendered]]

## The comment that promised it

The Partners surface does not build its own access editor. It hands off to this
one, and says why:

> _"Changing what a partner can reach is the existing teammate pane (there is
> exactly one such editor, and **it already does modules and sites**), opened
> beside this list."_

and again at the call site:

> _"The one teammate editor, opened beside this list — it **already handles
> role, modules and sites**, so partner access does not build a second scope
> editor."_

The decision not to build a second editor was correct. It was made against a
first editor that did two of the three things. And `PartnerMember` in that same
folder **declares `propertyAccessMode` and `properties`** — the fields were
typed one directory away from the pane that dropped them.
[[feedback_a_promise_in_copy_is_a_contract]]

## What the roster said

The list has a column headed **What they can reach**. For a member held to one
shop out of seven it read:

```
Nadia Osei      Editor      Everything their role allows
```

Not wrong about the apps. Silent about the only limit actually in force, which
is the worst thing a summary can be.

## What it does now

1. **The teammate pane carries a third section**, built exactly like the module
   one: a two-way choice, then the tick list, then the warning that an empty
   list is a real and saveable state. It stays off screen for an account with
   one site, where every answer means the same thing — **unless a limit is
   already set**, which must remain visible so it can be taken off again.
2. **The roster column answers both questions**, naming sites the way it already
   named apps, and carrying the full phrase in `title` because the cell clips.
3. **Both consoles**, same change, same day. `check:console-parity` is green.
4. **The role rule is imported, not copied.** `roleHasModuleLimits` was a local
   `role !== 'owner' && role !== 'admin'` sitting beside a server that owns the
   same list. Both axes now ask the package that enforces them, through two new
   subpath exports on `@wizeworks/auth`. A screen that decides for itself who
   may be limited is one release away from offering a control the server then
   refuses. [[feedback_silicaui_single_point_of_change]]
5. **A limit is sent only for a role that can hold one.** Setting a limit and
   then changing the role to Admin in the same breath used to post the leftover
   ticks, and the server answered "change their role first" to somebody who had
   just changed their role. It now drops a collapsed axis from the patch, and
   from the dirty check, so Save does not light over a pane with nothing on it.
   That hole was in the MODULE axis too, and is closed for both.
   [[feedback_a_fix_leaves_its_neighbour_behind]]

## Proved

**12 tests** in `surfaces/team/reach.test.ts`, every rule proved red by breaking
the thing it guards:

```
drop the sites clause                 →  5 fail
read an empty grant list as "all"     →  "says so when a limit is on and nothing is ticked"
shorten sites at 3 like apps          →  "shortens sites sooner than apps"
```

The dangerous inversion is the second one: an empty tick list is a member who
can reach nothing, and printing "everything" over them is the exact opposite of
the truth. [[feedback_a_test_that_cannot_go_red]]

The reach phrase moved into its own module to be testable at all, taking both
name lookups as functions — an app's label is a brand decision, a site's name is
a database row, and neither belongs in a rule about sentences. That also keeps
the console's React module graph out of a node test.

**Checks:** piggles console 166 files / 1552 tests (2 failing in
`surfaces/migration/column-guess.test.ts`, an untracked file belonging to
another agent's in-progress work), sparx workbench 135 files / 1234 tests all
green, `@piggles/auth-handoff` 2 files / 20. Typecheck 0 on both consoles and
the account app. 23 guards green including `check:console-parity`.

**Driven on her own screen.** She invited a Saturday assistant, the assistant
joined, and the pane offered **"Which of your sites they can open"** with all
seven listed, primary first. Ticking nothing showed _"Nothing is ticked, so
Nadia Osei will be able to sign in and see nothing at all."_ Ticking **Juniper
Row Sample Sale** and saving reported _"Nadia Osei's access updated. It applies
the next time they load a page."_ The roster then read:

```
Nadia Osei      Editor      Everything their role allows · Juniper Row Sa…
```

and the database held its first `member_property_access` row.

## What was never the missing half

The enforcement. `member-site-access.test.ts` already proved a restricted member
cannot reach another site by forging the header, by sending no header, or by
asking for `?property=all`. That work was done and is untouched here. What was
missing was a switch.

## Files

- `piggles/apps/workbench/surfaces/team/member.tsx`
- `sparx/apps/workbench/surfaces/team/member.tsx`
- `piggles/apps/workbench/surfaces/team/index.tsx`
- `sparx/apps/workbench/surfaces/team/index.tsx`
- `piggles/apps/workbench/surfaces/team/reach.ts` (new)
- `sparx/apps/workbench/surfaces/team/reach.ts` (new)
- `piggles/apps/workbench/surfaces/team/reach.test.ts` (new)
- `sparx/apps/workbench/surfaces/team/reach.test.ts` (new)
- `piggles/apps/workbench/surfaces/team/roles.ts`
- `sparx/apps/workbench/surfaces/team/roles.ts`
- `piggles/apps/workbench/lib/api/team.ts`
- `sparx/apps/workbench/lib/api/team.ts`
- `wizeworks/packages/auth/package.json`

## The thing to remember

**A column with four writers is a column three writers forget (878). A column
with none is a feature nobody can tell is missing.** There is no error, no empty
state, no greyed control: the account simply behaves as though every teammate
should see everything, which is also how it behaves when that is true.

The measurement that finds this shape is not "does this feature work" — it
worked, and was tested. It is **"how many rows has this table ever held?"** A
junction table at zero across every tenant on the platform is either a feature
nobody wants or a feature nobody can reach, and the two are told apart by
opening the screen that should offer it.
