# CLAUDE.md — sparx persona testing

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-01

Binding for anything under `sparx/docs/personas/`. Where it is silent, the root
[CLAUDE.md](../../../CLAUDE.md) applies.

This folder is not documentation about testing. It **is** the test: a real
business, with a real person behind it, set up from nothing on the sparx
workbench and operated until it works or breaks. A persona file is both the
**script** and the **log**: you read it to know what to do, and you write to it as
you do it.

The Piggles console has its own, much older, persona exercise at
[piggles/docs/personas/](../../../piggles/docs/personas/). The two share a
database, the API and every package under `wizeworks/`, and **another agent is
usually running the Piggles one at the same time.** The rules below are written
for that.

## RULE #1 — judge it as the business, not as an engineer

**Drive the screen.** Click it, type into it, read what comes back, and decide
what a person would do next. Every real defect this project has produced was found
by opening a page or querying the database, and every one of them passed
typecheck, lint and build first.

**Never `fetch()` an endpoint to prove a feature works.** A green API response says
nothing about whether anyone can reach it. The MCP tools and `psql` are for
**verifying what the UI wrote**, never for doing the work the UI was supposed to
do. If a screen cannot create the thing, that is the finding; creating it through
the API and carrying on erases it.

The one exception is the surface whose customer IS a program: the MCP server. A
business connects its own AI client to it, so driving it from an MCP client is
driving its screen.

**The verdict is the customer's, not the code's.** Not "is this implemented
correctly" but **could Doty finish this job, and would he come back tomorrow?**

| Technically | But as the business                                   | Verdict |
| ----------- | ----------------------------------------------------- | ------- |
| works       | he could not find it, or did not know it was there    | broken  |
| works       | it took nine clicks and two screens he did not follow | broken  |
| works       | the word on the button is not a word he uses          | broken  |
| works       | it told him nothing happened, and something did       | broken  |
| edge case   | it is Monday and he does this every Monday            | major   |

Write findings in his terms. **"Doty could not tell whether the fleet's invoice
sent"** is the finding; the mechanism goes further down the same file.

Three things a customer never does, so you must not either:

- **Read the source to find out whether something works.** Look at the screen.
  Read code only once you are fixing what the screen already proved.
- **Know what the software is called underneath.** If you needed the module key or
  the table name to navigate, that is a finding.
- **Try again a different way because the first way failed.** The first way
  failing IS the result. Record it, then try the second way as a separate note.

The tell that you have drifted: you are reading JSON instead of a screen, or you
are pleased that something works when you could not have found it.

## RULE #2 — real data, never placeholder data

The names, prices, part numbers and addresses in each persona file **are the test
data**. Type them as written. No `Test Product 1`, no lorem, no `a@b.com`, no `123`.

For Gillett Diesel, the company side is real and comes from the public site,
captured into [assets/gillett/](assets/gillett/) (logo, products, photos, words).
The **people** are made up: customers, fleets, other staff. Their email addresses
use the reserved `.test` domain so no message can ever reach a real person.

Placeholder data hides exactly the defects real data finds: an apostrophe, an
accent, a 68-character part name, a price with cents, a `+1` phone, a description
that wraps to five lines at 360px, a customer list long enough to page.

## RULE #3 — file it, fix it, then prove the fix from the same screen

**Stop and fix.** Five beats, in this order, every time:

1. **File** the issue in [issues/](issues/), before the fix, so a defect that turns
   out to be two defects does not lose one.
2. **Fix** it properly, at the single point of change (root RULE #1). Check the
   sibling screens for the same defect and say in the issue whether you did.
3. **Re-run the exact step**, as the persona, on the screen, with the same data.
   Not a typecheck, not a unit test, not a `fetch`.
4. **Record the confirmation** in the issue: `Status: fixed`, `Fixed:` stamped,
   and one line on how it was proved. A fix with no confirmation line is not fixed.
5. **Re-score the pane** in [rating.md](rating.md) if the fix moved it, keeping
   both numbers (`5 → 8`).

When a fix genuinely cannot be made now, say so in the issue and keep going. It
applies to exactly these:

| Situation                                     | Do                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Needs a schema migration                      | author the migration file, do not run it; `Status: open`, `Blocked on: pipeline` |
| Needs a product decision that is Brandon's    | `Status: open`, `Blocked on: decision`, state the options                        |
| The fix is larger than the surface under test | `Status: open`, `Blocked on: scope`, say what it would take                      |
| Fixing it needs the dev server restarted      | note it, ask Brandon, carry on elsewhere                                         |

Anything not in that table gets fixed now. A defect or bad UX is never "Brandon's
call"; his are new capability, price, strategy and ongoing spend.

**Design failures are defects** (eyebrows, an all-grey screen, faded readable
text, body type under 16px, a `<Badge>` used as a label, a hardcoded hex).
`Severity: design`. **Copy that is FALSE is major**, not `copy`.

### Working beside the Piggles run

- **Shared code is shared.** A fix in `wizeworks/` or a shared package changes
  Piggles too. Before editing a shared file, check `git status` and `git diff` on
  it: if it already carries edits you did not make, they are the other agent's.
  Edit around them; never revert, reformat or restage them.
- **Prefer the fix that lands in both consoles.** Sparx and Piggles drifted
  because fixes were made in one console only
  ([handoff](../../../piggles/docs/personas/handoff-sparx-parity.md)). When a sparx
  defect lives in a shape Piggles also has, say in the issue whether Piggles has
  the same defect, and fix it there too when the fix is the same shape.
- **Never commit, never push, never `git stash`, never `git checkout -- <file>`.**
  Copy a file to the scratchpad before a sweep and restore from that copy.
- **Never run or restart dev, `pnpm install`, `prisma migrate`, `db push` or
  `prisma generate`.** Ask Brandon.
- **Typecheck one package at a time.** Never `turbo run typecheck` (it runs out of
  memory) and never filter `.next/` out of `tsc` output (a half-written
  `routes.d.ts` is a parse error, so tsc checked nothing).

## RULE #4 — never present absence as measurement

If you did not check something, write **"not checked"**. Not "fine", not
"presumably works", not silence. A count that would not load is unknown, not zero.

## RULE #5 — the spine is verified once, then trusted

Every persona walks the same first stretch: sparx.works → Create your account →
the workbench's first-run setup → module activation → the first real job. P01 is
the deep baseline and verifies it act by act, in the database.

## RULE #6 — every pane gets a design score and an ease score

Working is the floor, not the result. Rate every pane you open in
[rating.md](rating.md) on **Design** (on-system, well-composed, real color doing
real work, holds at 360px, waiting / empty / error states present) and **Ease**
(could this person do the job without help).

**A pane is not scored until you have seen it in light, in dark, and at 360px.**
Check narrow widths in an iframe or device emulation, never by resizing Brandon's
browser window. The score is not the point; the gap to 10 is, because it is the
worklist.

## RULE #7 — neighbours, and fixes travel

This database holds over a hundred tenants, the Piggles businesses among them.

**Every persona tries to see somebody else's business, once, deliberately:**
search for something only another tenant holds, deep-link another tenant's record
id into the address bar, and switch sites to confirm the whole identity swaps. The
expected result is nothing. **A leak is a `blocker` and stops the run.**

**A fix made here must not break somebody else.** After repairing anything in the
shared spine or a shared surface, reopen one existing business it could touch (a
Piggles persona's tenant, or an earlier sparx persona) and do one real job there.
Record it on the issue as a second confirmation line.

## RULE #8 — the business is the deliverable

**Each persona ends holding the real, complete, working business**, not a tour of
the features. For Gillett Diesel that means everything in the persona file's
deliverable inventory: the catalog, the wholesale accounts with their fleet
pricing and terms, the website a stranger can buy from or book on, the trade
portal a fleet manager can reorder through, the invoices, the stock, the people,
the email, and an AI client connected to it over MCP. If a part on that list is
missing, stock, or still wearing template copy, the run is not finished.

**Tenant sites have full design freedom.** No-shadow, no-gradient and the
soft/muted restraint govern sparx's own surfaces, not Gillett's website. Judge the
site by whether it looks like Gillett Diesel's site.

## Standing checks — every run

Not acts. Each persona file names its own concrete instance of each, and they are
worked as you go, where the person would naturally do them.

- **Wrong moves.** At least three: delete what other records point at, import the
  same file twice, double-click pay, Back after submit, edit a sent document.
- **Reload, deep link, restore.** F5 on an open pane; the address bar opened in a
  new window; a deep link opened while signed out.
- **Time and dates.** The boundary, not the middle. Net 30 from the 31st, 40 days
  overdue, an 18:30 booking. Record the machine's timezone.
- **Money at the edges.** Compute by hand first: tax on a discounted line, a
  partial refund, tier price on a contract price, a zero-value document.
- **The other side.** The run ends as the customer: the shopper sees their order,
  the fleet manager reorders, the invoice can be opened and paid.
- **Without a mouse.** One full job by keyboard alone, focus ring visible.
- **Somebody else's data.** RULE #7.

## What every run records

| Record                   | Why                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Time to live site**    | From landing on sparx.works to a published site a stranger can reach. The onboarding promise |
| **Speed at real volume** | How the lists feel at real size. An owner's verdict, not a benchmark                         |
| **Modules on**           | Which modules the screen says are on, against what the tenant settings row holds             |
| **Bill**                 | What sparx says this tenant will pay for the modules he turned on, checked by hand           |

## Accounts

One persona, one real account, one real tenant, made through the screens.

| Field    | Convention                                                   |
| -------- | ------------------------------------------------------------ |
| Email    | `p01.doty@gillettdiesel.test` (persona id, then first name)  |
| Password | `Sparx-Persona-2026!` for every sparx persona (local docker) |
| Business | exactly the name in the persona file                         |

Made-up people (customers, fleet buyers, staff) use `firstname.lastname@<their
company>.test`.

### Outside services: test mode only

Decided by Brandon on 2026-10-01. Stripe runs on test keys and test cards only.
Email goes to the dev console transport. No real domain is bought, no real DNS is
verified, no real social account is connected, and no AI provider key is entered:
the AI module is tested through MCP, which needs no key. Each part that needs a
real outside account is recorded as **not checked, outside service** with the
reason, never as working.

### Dev email works: read it

The console provider prints every rendered email to the **event-worker's**
stdout, not the app's:

```
[email/console] <template> → <to> :: <subject>
<the full plain-text body follows>
```

Set `SPARX_EMAIL_LOG_HTML=1` for HTML. If you did not go and read it, write "not
checked". Never report an email as sent because a screen said so.

### Where things run

| Surface              | Port                        | What you use it for                   |
| -------------------- | --------------------------- | ------------------------------------- |
| sparx.works (web)    | 3003                        | discover, click through to sign up    |
| workbench            | 3011                        | sign up, set up, operate the business |
| tenant site renderer | 3004, with `?tenant=<slug>` | be the customer                       |
| market               | 3010                        | themes and apps marketplace           |
| staff admin          | 3002                        | not used by a tenant persona          |

**Start on 3003 every time.** Landing on `/sign-up` skips attribution and the
reason the marketing site exists. Brandon owns the dev lifecycle: never start or
restart these.

### Verifying in the database

Read-only, and only to confirm what the UI claimed:

```
docker exec -i sparx-postgres psql -U sparx_owner -d sparx
```

There is no `postgres` role. Never write through it.

## Issue files

Name: `NNN-short-kebab-slug.md`, a flat sequence starting at `001-`, in this
folder's own [issues/](issues/). The Piggles ledger is separate and numbered on
its own; in a commit message, say **"sparx persona issue 001"** so the two never
read as one sequence. Use [issues/\_TEMPLATE.md](issues/_TEMPLATE.md).

| Severity | Means                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------- |
| blocker  | cannot proceed · data loss · wrong money · a security exposure                                 |
| major    | a real job cannot be finished the way a business would do it, or a sentence on screen is FALSE |
| minor    | friction, confusion, a wrong count, an ugly edge                                               |
| design   | breaks a binding rule in DESIGN.md or the root CLAUDE.md                                       |
| copy     | off-voice, jargon: true, but the wrong words                                                   |

There is deliberately **no index of issues**. `ls issues/` is the index.

## Definition of done

- Every persona file at `Status: done`, every act with a recorded outcome
- Every issue carrying a status, and every `fixed` one carrying a confirmation
  line naming the screen it was re-proved on
- [rating.md](rating.md) scored for every pane the runs opened, each with a gap to
  10, and the unreached ones still visibly `—`
- The business itself, complete against the persona's deliverable inventory
