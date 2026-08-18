# CLAUDE.md — Piggles persona testing

Binding for anything under `piggles/docs/personas/`. Where it is silent,
[piggles/CLAUDE.md](../../CLAUDE.md) and then the root file apply.

This folder is not documentation about testing. It **is** the test: ten real
businesses, each with a person behind it, each set up from nothing and operated
until it works or breaks. A persona file is both the **script** and the **log** —
you read it to know what to do, and you write to it as you do it.

## RULE #1 — you are the business owner, not an agent

**Drive the screen.** Click it, type into it, read what comes back, and decide
what a person would do next. Every real defect this project has produced was
found by opening a page or querying the database, and every one of them passed
typecheck, lint and build first.

**Never `fetch()` an endpoint to prove a feature works.** A green API response
says nothing about whether anyone can reach it. The MCP tools and `psql` are for
**verifying what the UI wrote** — never for doing the work the UI was supposed to
do. If a screen cannot create the thing, that is the finding; creating it through
the API and carrying on erases it.

The tell that you have drifted: you are reading JSON instead of a screen.

## RULE #2 — real data, never placeholder data

The names, prices, SKUs and addresses in each persona file **are the test data**.
Type them as written. No `Test Product 1`, no lorem, no `a@b.com`, no `123`.

Placeholder data hides exactly the defects real data finds: an apostrophe in
`Nia's`, an accent in `Tomás`, a 68-character product name, a price with cents, a
phone number with a `+`, a description that wraps to five lines at 360px, a
customer list long enough to page. A persona whose catalogue is three items
called Test has not tested a catalogue.

Where a file says "at least N", N is a floor, not a target.

## RULE #3 — file every defect, immediately, in its own file

One issue, one file in [issues/](issues/). Never a combined file, never a batch
at the end of a run, never a fix without a file. The file is written **before**
the fix, because a fix with no record is a defect that gets reintroduced.

**Do not stop the run at the first defect.** File it, work around it if a person
could, and keep going — the value of a run is breadth. If it hard-blocks a later
act, say so in the issue (`Blocks: P03 act 4`) and move to the next act that does
not depend on it. Report at the end what was blocked and why.

**Design failures are defects.** An eyebrow above a heading, an all-grey screen,
faded readable text, body type under 16px, a `<Badge>` used as a label, a
hardcoded hex — all of it is in scope while you are on the screen anyway. File it
as `Severity: design`.

**Copy that is FALSE is not a copy defect, it is a major one.** Piggles inherited
sparx's prose, and sparx charges per module. Any sentence promising a smaller
bill for using less, naming a product Piggles does not have (sparx.market, sparx
Pay), or pointing at a screen this console excludes, is wrong rather than
off-voice. See piggles/CLAUDE.md — "A sparx PRODUCT is not a Piggles capability."

## RULE #4 — never present absence as measurement

If you did not check something, write **"not checked"**. Not "fine", not
"presumably works", not silence. A run that reports nine of eleven acts and does
not say which two are missing reads as a clean run, and that is worse than an
obviously partial one.

The same applies inside a run: a count that would not load is unknown, not zero.

## RULE #5 — the spine is verified once, then trusted

Every persona walks the same first stretch: meetpiggles → signup → onboarding →
`/internal/tenant/furnish` → handoff → the console's first run. **P01 is the deep
baseline** and verifies it properly, act by act, in the database.

P02–P10 walk it at speed and report spine behaviour only where it **differs** —
a different trade's starter, a different pack, a different rail. Their value is
their own surface, not a tenth re-verification of signup. If the spine breaks for
one persona and not another, that difference IS the finding.

## How a run works

1. Read the persona file top to bottom before touching anything.
2. Set `Status: in progress` and stamp the date in **Run log**.
3. Work the acts in order. Each act names its jobs and what "done" means.
4. Fill in the **Account** block as soon as signup gives you the values — tenant
   id, subdomain, published site URL. A run nobody can revisit is a run nobody
   can confirm.
5. File issues as you hit them; link them under **Issues found**.
6. Complete **Verification** honestly at the end, including what you skipped.
7. Set `Status: done` only when every act has a recorded outcome — including
   "blocked by #012". Silence is not an outcome.

### Accounts

One persona, one real account, one real tenant. Never reuse another persona's —
the whole point is a business starting from nothing.

| Field    | Convention                                                 |
| -------- | ---------------------------------------------------------- |
| Email    | `p01.marisol@piggles.test` — persona id, then first name   |
| Password | `Piggles-Test-2026!` for every persona (local docker only) |
| Business | exactly the name in the persona file, apostrophes included |

Dev email is a silent no-op (`SPARX_DEV_WORKER_ROUTES` is unset — FOLLOW_UPS #8),
so anything gated on receiving mail is **not checked** unless you read the token
out of `verifications` yourself and record that you did.

### Where things run

| Surface              | Port                                  | What you use it for                |
| -------------------- | ------------------------------------- | ---------------------------------- |
| meetpiggles (web)    | 3020                                  | discover, click through to sign up |
| getpiggles (account) | 3021                                  | sign up, sign in, onboard, pay us  |
| mypiggles (console)  | 3022                                  | operate the business               |
| the published site   | the tenant's `piggles.site` subdomain | be the customer                    |

**Start on 3020 every time.** Landing straight on `/signup` skips attribution,
the first-touch payload, and the entire reason the marketing site exists.

### Verifying in the database

Read-only, and only to confirm what the UI claimed:

```
docker exec sparx-postgres psql -U sparx_owner -d sparx
```

There is no `postgres` role. Never write through it, and never run
`prisma migrate`, `db push` or `generate` — authoring a migration is fine,
running one is not.

## Issue files

Name: `NNN-short-kebab-slug.md`, a flat global sequence starting at `001-`.
Global rather than per-persona, because most defects live in the shared spine and
numbering them by who happened to find one implies an ownership that is not real.

Use [issues/\_TEMPLATE.md](issues/_TEMPLATE.md). The header block is fixed:

```
**Status:** open · fixed · wontfix · duplicate of #NNN
**Severity:** blocker · major · minor · design · copy
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › Sell › Add a product
**Filed:** 2026-08-18
**Fixed:** —
```

| Severity | Means                                                                                        |
| -------- | -------------------------------------------------------------------------------------------- |
| blocker  | cannot proceed · data loss · wrong money · a security exposure                               |
| major    | a real job cannot be finished the way an owner would do it, or a sentence on screen is FALSE |
| minor    | friction, confusion, a wrong count, an ugly edge                                             |
| design   | breaks a binding rule in DESIGN.md or either CLAUDE.md                                       |
| copy     | off-voice, jargon, sparx vocabulary — true, but the wrong words                              |

**When an issue is fixed, it stays.** Set `Status: fixed`, stamp `Fixed:`, and
record what the fix was and where. This is a defect ledger, not a queue —
[FOLLOW_UPS.md](../FOLLOW_UPS.md) is the register that gets emptied.

There is deliberately **no index of issues**. `ls issues/` is the index, and a
hand-maintained table would be wrong within two runs.

## What is out of scope on a run

- **Redesigning a screen you are only passing through.** File it.
- **Refactoring.** A one-line fix that keeps the run moving is fine and goes in
  the issue. Anything larger is its own task.
- **Restarting the dev server.** Ask Brandon. Parallel work dies with it.
- **Committing or pushing.** Leave the tree dirty and report what changed.
- **Resizing the browser window.** Check 360/390px in an iframe, never by
  resizing somebody's actual window.

## Definition of done — the whole exercise

All ten persona files at `Status: done`, every act with a recorded outcome, every
defect in `issues/` carrying a status, and a live published site for each
business that a stranger could buy from, book on, or read.

Ten scripts and no runs is nothing. Nine runs and one stock persona is an
unfinished deliverable that reads as finished.
