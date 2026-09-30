# 853 — The owner read "Has not signed in yet" about herself, while signed in

**Status:** fixed
**Severity:** **major** — a flat falsehood about a real person, on the screen an
owner uses to decide who keeps a seat, said about every teammate on the platform
**Found by:** P03 · act 298, opening her own record from the team roster
**Surface:** mypiggles › Team › a teammate, plus the two WizeWorks staff screens
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the same pane, re-read from the live DOM, and the sign-in hook
traced to the client that can actually write it

## Two lines, one above the other

```
Role                Owner
Joined              August 23, 2026
Last signed in      Has not signed in yet
Last did something  3d ago · September 24, 2026
```

Devi Raman. Account owner. Reading her own record, in a session she was holding
at that moment.

The second line is derived from the audit log and was right all along. The first
is a column nobody had ever written.

## Nothing has written it, ever

```sql
SELECT count(*), count(last_login_at) FROM users;
-- 76 users · 0 recorded
```

`users.last_login_at` has been in the schema since the **very first migration**,
`20260527000000_init`, four months before this. Grepped across all three brand
trees: not one `update`, `upsert` or `data:` touches it. Six readers, no writer.
[[feedback_screen_over_a_function_nobody_calls]]

So every teammate on the platform read "Has not signed in yet", and every user in
the staff console read "Never".

The platform had even written its own assumption down, in a later migration's
comment, while adding an index to derive last-active from audit rows:

> There is no stored last-active field anywhere in the platform
> (**users.last_login_at is LOGIN**; sessions has no touch column)

That is a sentence about a column that has never held a value. It was true about
the schema and false about the data.
[[feedback_verify_capability_in_code_not_docs]]

## The hook was already there, and already documented

`databaseHooks.session.create.after` in `@wizeworks/auth` carries the new-device
security email, under a comment saying exactly what was needed:

> `create` fires on a **genuine sign-in**, NOT on the 5-min cookie refresh
> (that's `session.update`), so this doesn't email on every request.

The write goes there, in its **own** try/catch and **before** the email, so a
failed statistic can neither cost somebody their sign-in nor take a security
notification down with it.

**The RLS footgun does not apply, and that was checked rather than assumed.**
`users` is `rowsecurity = true, forcerowsecurity = false`, and `authPrisma`
connects as `sparx_owner`, which its own header explains is deliberate:

> this client connects as `sparx_owner` (table owner, **NOT subject to
> ENABLED-but-not-FORCED RLS**)

So the update lands in production, not only against a local superuser.

## The other half: an empty column is not a fact

A write alone would have left 76 existing users still reading "Has not signed in
yet", and a swallowed failure would put the sentence straight back. So the reader
changed too.

**The sentence is kept, not deleted.** It is how an owner sees that an invitation
was never taken up, which is a real thing to need. It is now said only when it is
true, and the evidence for that was already on screen and already in the
component's hand:

```
lastLoginAt set              →  when
no lastLoginAt, but activity →  "Not known"      ← somebody with work behind them
                                                    has plainly signed in
no lastLoginAt, no activity  →  "Has not signed in yet"
```

[[feedback_never_present_absence_as_measurement]]

The staff console has no activity signal beside it, so both of its screens say
"Not known" for an empty column rather than "Never". Inventing a signal to keep a
stronger word would be the same mistake again.

## The four screens that render it

| where                           | was                     | now                       |
| ------------------------------- | ----------------------- | ------------------------- |
| piggles › Team › teammate       | "Has not signed in yet" | "Not known" · or the date |
| sparx › Team › teammate         | "Has not signed in yet" | "Not known" · or the date |
| staff console › Users (roster)  | "Never"                 | "Not known"               |
| staff console › a user (detail) | "never"                 | "not known"               |

`partner-access-data.ts` in both consoles declares `lastLoginAt` and draws it
nowhere, so there was nothing to correct there.

## Proved

**5 tests**, and **proved red**: deleting the "has activity" branch reddens
exactly 2 of the 5 and leaves the 3 that hold the rest.
[[feedback_a_test_that_cannot_go_red]]

The rule lives in a `.ts` beside the pane rather than inside the `.tsx` — this
app's tsconfig keeps JSX unparsed, so a test cannot import the component — which
is the same arrangement `publish-words.ts` already uses.

**On screen**, read back from the live DOM of her own record:

```
before   Last signed in  Has not signed in yet
after    Last signed in  Not known
```

**The write is proved on a real sign-in.** Devi was signed out and signed back in
through the account app, three times, and the column carried the second each time:

```
before   (empty)
after    2026-09-28 18:14:03.408+00     ← to the second of the password submit
```

### And that measurement found a second thing

The write landed at the PASSWORD step, with the two-factor challenge still on
screen and no surviving session row. Read off the wire:

```
POST http://localhost:3021/api/auth/sign-in/email   200
users.last_login_at                                 written
sessions                                            no new row
the screen                                          still asking for the code
```

So `session.create` fires when a password is accepted, not when a person is let
in. Left alone, this would print a date under "Last signed in" for somebody who
had the password and never got past the second factor — which is a worse sentence
than the empty one this set out to fix.

It is gated now, the way the two-factor notice four blocks up gates itself and for
the reason its comment calls exact: the hook's `context.path` names the endpoint.
The list is the two PASSWORD endpoints and nothing else, and every path it does
not match still records — so a provider nobody listed is never silently dropped,
and an incomplete list costs only the precision of one timestamp.
[[feedback_structural_checks_go_blind]]

**The gate is proved by test, not by the server**, and that is deliberate. The
auth instance is cached on `globalThis.__sparxAuth` to survive dev HMR — its own
comment says so — so the hook keeps running the version that was loaded at boot.
Re-submitting the password after the edit still wrote, which is the cache and not
the gate: the endpoint on the wire is `/sign-in/email`, which is exactly what the
gate tests. A decision that can only be checked by restarting a server is a
decision nobody checks, so it moved into a pure module with seven tests.

### And then proved on a sign-in that completed

The account was the only one of 76 with two-step on, turned on during act 9 while
testing that screen, and no code for it survives. With Brandon's go-ahead it was
turned off on the development database, and the whole thing was driven again —
password, no challenge, straight in:

```
sessions                 1 live row
users.last_login_at      2026-09-28 22:43:21.3+00
```

and on her own record in the team pane, read back from the live screen:

```
Role                Owner
Joined              August 23, 2026
Last signed in      1m ago · September 28, 2026     ← was "Has not signed in yet"
Last did something  3d ago · September 24, 2026
```

Which is the case the write was built for: a password step that IS the whole
sign-in, on an account with no second factor, recording once and reading back
correctly on the screen that started this.

### After the dev restart: the gate is loaded and does not over-block

Brandon restarted dev, so `globalThis.__sparxAuth` is holding the new code. Driven
again from a 2020 sentinel, on an account with no second factor:

```
two-step           off
before             2020-01-01 00:00:00+00     (sentinel, set on purpose)
after              2026-09-29 00:26:36.656+00
sessions           1
```

Which is the branch that matters for **75 of the 76 accounts on the platform**: a
password step that IS the whole sign-in still records, to the second. A gate that
withheld the timestamp from everybody would have been a worse bug than the one it
fixes, and it does not.

**What is still NOT proved, said plainly.** That a 2FA account's timestamp waits
for the code. The decision is a pure module with seven tests and the endpoint it
keys on was read off the wire, so the rule is proved; the hook running the rule
on a real 2FA sign-in is not. Exercising it needs an account with a working
authenticator, and there is none: this was the only one of 76 with two-step on,
and it was turned off to get back in.

An attempt to fake it by writing a `two_factors` row by hand hung the endpoint —
the placeholder is not a real encrypted secret — which is a fact about the
fixture and not about the product, so it is recorded here and not filed.
[[feedback_a_test_that_cannot_go_red]]

**Checks:** typecheck 0 on `@wizeworks/auth`, both workbenches and the staff
console. Tests: piggles workbench 141 files / 1322, auth 3 / 19. Guards:
`em-dashes`, `american-spelling`, `piggles-plain-words`, `console-parity`,
`boundaries`, `copy-key-sentences`. ESLint and prettier clean.

## Files

- `wizeworks/packages/auth/src/server.ts` (the sign-in hook writes it, gated)
- `wizeworks/packages/auth/src/sign-in-step.ts` (new, which endpoint is only a password)
- `wizeworks/packages/auth/src/sign-in-step.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/team/signed-in-line.ts` (new, the rule)
- `piggles/apps/workbench/surfaces/team/signed-in-line.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/team/member.tsx`
- `wizeworks/apps/admin/app/(console)/sparx/users/_components/users-table.tsx`
- `wizeworks/apps/admin/app/(console)/sparx/users/[id]/page.tsx`

## The thing to remember

**The screen next door had the answer, and the two never met.** "Last did
something" is derived from the audit log, is correct, and sits one row below "Last
signed in" in the same list. Anyone reading the pane could see the contradiction;
nothing in the code ever compared them, because each line was written to render
one field and no line was written to make the panel true.

And the smaller one: **a schema column is not a capability.** The comment in
`20261210000000_member_module_access` says "users.last_login_at is LOGIN" and is
reasoning about a field with zero rows. A column is evidence that somebody once
intended something, not that anything writes it.
