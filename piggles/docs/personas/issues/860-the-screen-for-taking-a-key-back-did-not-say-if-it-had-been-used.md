# 860 — The screen for taking a key back did not say whether it had been used

**Status:** fixed
**Severity:** **moderate** — the pane where an owner decides whether an outside
agency keeps access to her whole business showed nothing about whether they use
it, while two live grants with every module and every site have sat unused since
July
**Found by:** P03 · act 303, reading the pane's code while dev was down, because
the field just fixed on her Team pane is on this one too
**Surface:** sparx › Settings › Partner access. **NOT a Piggles screen** —
`platform.settings.partner` is in the Piggles `hiddenSurfaces` set, so Devi
cannot reach it from the nav, from search or from a deep link. The Piggles copy of
the file is kept only for console parity.
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the database, and the `/v1/team` payload the pane already
receives

## What a partner row said

```
  RS   Rosalind Stemmler   Active
       agency@example.com
       Admin · All modules, all sites          [ Manage access ]  [ Withdraw ]
```

Who they are, what they can reach, and a button to take it away. **Nothing about
whether they have ever used it.** That is the one fact the decision turns on.

## What the platform knows and was already sending

`/v1/team` returns three things per member, and this pane reads that endpoint:

| field          | on the wire | declared here | drawn  |
| -------------- | ----------- | ------------- | ------ |
| `createdAt`    | yes         | yes           | **no** |
| `lastLoginAt`  | yes         | yes           | **no** |
| `lastActiveAt` | yes         | **no**        | no     |

`lastActiveAt` was not even declared on the type, so it was dropped off the wire
on arrival. The other two were carried into the component and never rendered.
[[feedback_fetched_but_never_rendered]]

## The two grants that exist

```sql
SELECT t.name, u.email, m.role, m.module_access_mode, m.property_access_mode,
       m.created_at::date, u.last_login_at
FROM members m … WHERE m.member_type = 'consultant';
```

```
 Junegrass Botanicals   admin   all modules   all sites   2026-07-21   (never)
 Copperleaf Studio      admin   all modules   all sites   2026-07-21   (never)
```

Two outsiders, admin role, every module and every site of two different
businesses, handed over two months ago, **never signed in once.** Whether that is
fine or wants withdrawing is the owner's call. It was not a call she could make,
because the screen for making it did not carry the fact.

**Devi could not have seen this, and the first draft of this document said she
could.** The pane is hidden in Piggles on purpose: platform billing and sparx's
reseller programme live on getpiggles.com, not in the operating console, and
granting a sparx partner agency access is the tenant side of that programme. The
adapter's own comment says so, and `getSurface` returns undefined for a hidden
key, so there is no deep link in either.

So this is a **sparx** defect, found while reading Piggles code that mirrors it.
The two grants above belong to sparx tenants. Recording it as something she saw
would have been the easier sentence and the wrong one.

## 853 looked at this and left it, correctly

Issue 853's own write-up says:

> `partner-access-data.ts` in both consoles declares `lastLoginAt` and draws it
> nowhere, so there was nothing to correct there.

(Which is also where the mirrored Piggles file comes from: 853 edited both, as
console parity requires, without either of us noticing that only one of the two
panes can be opened.)

That was right **then**. Nothing on the platform wrote `users.last_login_at` — 0
of 76 users carried a value — so rendering it would have said "has not signed in
yet" about every partner on the platform, which is the exact falsehood 853 was
filed about. 853 made the write real. **That retired the reason, and the reason
expiring is not something anything notices.**

## What it says now

```
  RS   Rosalind Stemmler   Active
       agency@example.com
       Admin · All modules, all sites
       Given access Jul 21, 2026 · has never signed in        ← warning tone
```

The second half is decided by `signedInLine`, the same rule the Team pane uses,
so the two panes cannot reach different conclusions about the same person from
the same two columns. Its three answers matter here in order:

```
a date              they use it
"not known"         activity behind them, so they plainly signed in before
                      the platform recorded it — never say never about them
"has never …"       the dormant key, and the only one that wears a tone
```

**No threshold.** There is no "dormant for 90 days" rule, because that would be a
rule nobody agreed to. An owner who can read "has never signed in" next to "all
modules, all sites" does not need the platform to have an opinion.

## Proved

**6 tests**, and **proved red** twice: deleting the never branch reddens 1 of 6,
deleting the "not known" branch reddens a different 1 of 6. The second is the one
that matters, because it is 853's mistake reappearing in a new pane.
[[feedback_a_test_that_cannot_go_red]]

**Checks:** typecheck 0 on both workbenches. Tests: piggles workbench
partner+team 2 files / 11. Guards `em-dashes`, `plain-words`,
`american-spelling`, `console-parity`, `boundaries`, `theme-opacity` green.
ESLint and prettier clean.

The warning tone is `<Text className="text-warning text-sm">`, which is the house
pattern for this at 5+ existing call sites (`business-details-fields.tsx`,
`webhook-fields.tsx`, and others) — matched rather than invented.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/partner/partner-seen-line.ts` (new, the words)
- `piggles/apps/workbench/surfaces/partner/partner-seen-line.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/partner/partner-access-data.ts` (`lastActiveAt` declared)
- `{piggles,sparx}/apps/workbench/surfaces/partner/partner-access.tsx`

## The thing to remember

**A decision that was right can go wrong without anybody touching it.** Not
rendering `lastLoginAt` here was the correct call while no writer existed, and
853's own document says so in a sentence that reads like a clearance. The write
landed in the same issue, four paragraphs up, and turned that sentence stale.

So a note saying "there was nothing to correct there" is worth re-reading every
time the thing it depended on changes — and the place to look for those is the
same issue that changed it. [[feedback_verify_capability_in_code_not_docs]]

And the plain version: **a screen that asks you to make a decision has to carry
the facts the decision needs.** This one had a Withdraw button and no evidence.
