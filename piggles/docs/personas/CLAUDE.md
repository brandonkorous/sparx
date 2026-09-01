# CLAUDE.md — Piggles persona testing

Binding for anything under `piggles/docs/personas/`. Where it is silent,
[piggles/CLAUDE.md](../../CLAUDE.md) and then the root file apply.

This folder is not documentation about testing. It **is** the test: ten real
businesses, each with a person behind it, each set up from nothing and operated
until it works or breaks. A persona file is both the **script** and the **log** —
you read it to know what to do, and you write to it as you do it.

## RULE #1 — judge it as the business owner, not as an engineer

**Drive the screen.** Click it, type into it, read what comes back, and decide
what a person would do next. Every real defect this project has produced was
found by opening a page or querying the database, and every one of them passed
typecheck, lint and build first.

**Never `fetch()` an endpoint to prove a feature works.** A green API response
says nothing about whether anyone can reach it. The MCP tools and `psql` are for
**verifying what the UI wrote** — never for doing the work the UI was supposed to
do. If a screen cannot create the thing, that is the finding; creating it through
the API and carrying on erases it.

**The verdict is the owner's, not the code's.** A run does not ask "is this
implemented correctly" — it asks **could Marisol finish this job, and would she
come back tomorrow?** Those come apart constantly, and where they do, hers wins:

| Technically  | But as the owner                                         | Verdict |
| ------------ | -------------------------------------------------------- | ------- |
| works        | she could not find it, or did not know it was there      | broken  |
| works        | it took nine taps and two screens she did not understand | broken  |
| works        | the word on the button is not a word she uses            | broken  |
| works        | it told her nothing happened, and something did          | broken  |
| an edge case | it is Tuesday and she does this every Tuesday            | major   |

So write findings in her terms. **"Ida could not tell whether her invoice sent"**
is the finding; "the mutation resolves before the toast fires" is the cause, and
it belongs further down the same file. An issue whose title only a developer can
read has recorded the symptom from the wrong end.

Three things a business owner never does, so you must not do them either:

- **Read the source to find out whether something works.** Look at the screen.
  Read code only once you are fixing what the screen already proved.
- **Know what the software is called underneath.** If you needed the module name
  to navigate, that is a finding.
- **Try again in a different way because the first way failed.** The first way
  failing IS the result. Record it, then try the second way as a separate note.

The tell that you have drifted: you are reading JSON instead of a screen, or you
are pleased that something works when you could not have found it.

## RULE #2 — real data, never placeholder data

The names, prices, SKUs and addresses in each persona file **are the test data**.
Type them as written. No `Test Product 1`, no lorem, no `a@b.com`, no `123`.

Placeholder data hides exactly the defects real data finds: an apostrophe in
`Nia's`, an accent in `Tomás`, a 68-character product name, a price with cents, a
phone number with a `+`, a description that wraps to five lines at 360px, a
customer list long enough to page. A persona whose catalogue is three items
called Test has not tested a catalogue.

Where a file says "at least N", N is a floor, not a target.

## RULE #3 — file it, fix it, then prove the fix from the same screen

**Stop and fix.** A defect is not logged and left; it is repaired the moment it
is found, and then the step that found it is **done again as the persona** to
confirm the repair. Five beats, in this order, every time:

1. **File** the issue in [issues/](issues/) — before the fix, so a defect that
   turns out to be two defects does not lose one of them.
2. **Fix** it properly. Not a call-site patch: the single point of change (root
   RULE #1) applies to a fix found in testing exactly as it does to new work.
3. **Re-run the exact step**, as the persona, on the screen, with the same data.
   Not a typecheck, not a unit test, not a `fetch`.
4. **Record the confirmation** in the issue: `Status: fixed`, `Fixed:` stamped,
   and one line on how it was proved — the screen, the data, what you saw.
5. **Re-score the pane** in [rating.md](rating.md) if the fix moved it, keeping
   both numbers (`5 → 8`).

Then continue the act. A run is a sequence of repairs, not a survey.

**Why this and not "log it and keep going":** a defect list written on Tuesday
gets fixed in a batch on Friday by somebody re-deriving what the sentence meant,
and the fix never gets driven through the screen that found it. The confirmation
is the part that keeps getting skipped, so it is a numbered beat.

**When a fix genuinely cannot be made now**, say so explicitly in the issue and
keep going — this is the exception, not the escape hatch. It applies to exactly
these:

| Situation                                     | Do                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Needs a schema migration                      | author the migration file, do not run it; `Status: open`, `Blocked on: pipeline` |
| Needs a product decision that is Brandon's    | `Status: open`, `Blocked on: decision`, state the options                        |
| The fix is larger than the surface under test | `Status: open`, `Blocked on: scope`, say what it would take                      |
| Fixing it needs the dev server restarted      | note it, ask Brandon, carry on elsewhere                                         |

Anything not in that table gets fixed now.

**Design failures are defects and are fixed the same way.** An eyebrow above a
heading, an all-grey screen, faded readable text, body type under 16px, a
`<Badge>` used as a label, a hardcoded hex — file, fix, look again. `Severity:
design`.

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

## RULE #6 — every pane gets a design score and an ease score

Working is the floor, not the result. **Rate every pane you open**, on the two
axes the platform already scores on ([surface-review](../../../.claude/skills/surface-review/SKILL.md),
sparx's docs/105), in [rating.md](rating.md):

| Axis       | The question                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design** | Is it on-system and well-composed? Silica components and tokens, real color doing real work, hierarchy from scale and weight, holds at 360px, states (waiting / empty / error) all present and right |
| **Ease**   | Could this owner do the job without help? Findable, one home per concern, the right data already on screen, no dead ends, words she uses, obvious next step, and reachable by keyboard and thumb     |

**The two come apart, and both are reported.** A beautiful pane nobody can
operate is not an 8, and a plain pane that gets the job done in two taps is not a 4. When a single number is wanted, quote the lower one.

**A pane is not scored until you have seen it in dark and at 360px.** Not once
per run, per pane — the two largest finds in this whole build were invisible to
every automated check, and one of them was every app color becoming unreadable
as ink in dark mode. A score taken in one theme at one width is a guess about the
other three.

| Score | Means                                                      |
| ----- | ---------------------------------------------------------- |
| 9–10  | Nothing to fix. 10 is rare and needs a reason written down |
| 7–8   | Right, with named nits                                     |
| 5–6   | Works; the owner needed a second look or a second attempt  |
| 3–4   | She got there by persistence, or it looks unfinished       |
| 1–2   | She would stop, ask somebody, or leave                     |

**The score is not the point — the deductions are.** Every row carries a **gap to
10**: the specific thing that would raise it. That column is the worklist, and
anything in it that is a real defect becomes an issue and gets fixed under RULE
#3 rather than sitting in a table as a number.

**Re-score after a fix**, keeping both values (`5 → 8`), so the file shows
movement rather than a final opinion. Panes no persona reached stay `—`; an
unrated pane is unrated, never assumed fine (RULE #4).

## RULE #7 — the ten are neighbours, and fixes travel

Ten businesses in **one database and one tenant pool**. That is not incidental to
the test; it is the only chance this platform gets to be checked with real
neighbours in it, and two things follow.

### Every persona tries to see somebody else's business

Multi-tenancy is enforced at the database level by Row Level Security, and RLS is
the **backstop against application bugs** — it exists precisely for the case where
the application tier forgets to filter. Nothing has ever tested it with real
neighbouring tenants. So once per run, deliberately:

- **Search** the console for something only another business stocks — "Ferrous",
  a rival's SKU, another owner's surname
- **Deep-link a record id** belonging to another tenant into the address bar: a
  product, an invoice, a customer, a price list
- **Switch business** (P10 has two sites; several personas can see the switcher)
  and confirm the whole identity swaps — name, socials, theme, logo, catalogue,
  not just the header

The expected result is nothing: not found, or refused. **A leak here is a
`blocker` and stops the run** — it is the one defect class where continuing to
test is the wrong thing to do.

### A fix made in one run must not break an earlier one

This is new, and it is the cost of fixing inside the run (RULE #3). After
repairing anything in the **shared spine or a shared surface**, reopen the
earliest business it could touch and do one real job there — Marisol's bakery
still takes a collection order, Tomás's invoice still totals.

Record it on the issue as a second confirmation line. A P06 inventory fix that
quietly breaks P01's shop is otherwise found by nobody, because nobody goes back.

## RULE #8 — the website is the deliverable, not a step in the run

**Each persona ends with a real, complete, working website for that business.**
Not a demonstration of the builder, not the template with the words changed, not
"four pages and publish". A site a stranger could land on from a search result
and buy from, book on, or read — without ever knowing it was a test.

Each persona file carries **its own page inventory** under "The website". That
list is the definition of done for the site: if a page on it is missing, stock,
or still wearing template copy, the run is not finished. Enumerate before you
start; re-check before you say done.

### What "fully featured" means, on every one of the ten

|                             | The bar                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pages**                   | Every page in the persona's inventory, with real copy in that owner's voice. No lorem, no leftover template sentences, no "coming soon"                                                                                                                                      |
| **Chrome**                  | A real header and nav, a working mobile drawer, and a footer carrying hours, address, socials and legal links — not the seed's defaults                                                                                                                                      |
| **Images**                  | Real photographs on every page that wants one, with alt text. Sized so the page is not 30 MB                                                                                                                                                                                 |
| **The thing it exists for** | Working end to end from the public side: the cart and checkout, the booking widget, the enquiry form, the trade login, the newsletter — whichever this business lives on                                                                                                     |
| **Legal**                   | Run `get_legal_checklist`. Privacy is **always** required; returns, shipping and refund become required once the shop is on. Drafting is scaffolded, but publishing is the tenant's act — do it as the owner, in Content → Legal pages, and confirm the footer links resolve |
| **Findable**                | Per-page title and description in plain words, a social card that actually renders, the sitemap, the favicon                                                                                                                                                                 |
| **Not found**               | A real 404 that offers a way onward                                                                                                                                                                                                                                          |
| **Consistent facts**        | Name, address, phone and hours identical in the footer, on the contact page, and in whatever structured data the site emits. A business whose own site disagrees about its phone number is a real defect                                                                     |
| **Responsive**              | Every page at 360px through desktop, in both themes if the site offers one                                                                                                                                                                                                   |
| **Reachable**               | Keyboard-navigable, visible focus, alt text, heading order that makes sense                                                                                                                                                                                                  |

### The ten sites must not be one site ten times

Different structures, different looks, different feature mixes. Ten sites that
are the same template with swapped nouns have tested one path ten times and told
you nothing about the builder. A bakery's site and a wholesaler's trade portal
should not be recognisable as siblings.

**Change the look properly on each one** — a bakery is warm and a climbing gym is
not, and if all ten come out Piggles pink then the look builder was never
exercised.

### Tenant sites have full design freedom — do not apply sparx's restraints

This is the mistake to avoid, and it is easy to make while holding the rest of
this file in mind. **No shadows, no gradients, restraint about color and soft
tints — those govern sparx's own product surfaces, and Piggles' console. They do
not govern a tenant's website.** A customer's site is the customer's brand: it
may have a gradient, a hero image, a shadow, a display typeface, anything the
business would actually want.

Judge these sites by whether they look like a real business's site, not by
whether they obey the console's design contract.

## Standing checks — every run, every persona

These are not acts. They are the things a real business does that the scripted
acts do not, and each persona file names its own concrete instance of each.

**Wrong moves.** The scripts are mostly happy paths plus a few refusals. Real
owners make mistakes, and mistakes are where data loss and wrong money live:
delete something that other records point at, import the same file twice,
double-click the pay button, press Back after checkout, refund the same line
twice, edit a document after it has been sent. Every persona does at least three,
named in its file.

**Reload, deep link, restore.** Press F5 on an open pane. Copy the address bar and
open it in a new window. Close a pane and restore yesterday's arrangement. Six
studio panes shipped with no address at all and blanked the address bar when
focused — a pane you cannot link to is a pane nobody can be sent to.

**Time and dates.** A booking at 18:30, a publish at Thursday 06:00, a Net 15 due
date, "40 days overdue", a warranty at month 11 and month 13, a renewal after a
six-week freeze. Check the boundary, not the middle. Say which timezone the
machine is in when you record the result.

**Money at the edges.** Not the happy total — the composition: tax on a
discounted line, a partial refund of a discounted order, rounding when two
percentages stack, a deposit against a balance, a zero-value document. Compute it
by hand first, then look. Where they disagree, the software is wrong.

**The buyer's side, past the sale.** Every run ends as the customer, not the
owner. Can they get back to what they bought? A tenant site's shoppers have their
own accounts (a separate Better Auth instance, per `(tenant, email)`), and a shop
where somebody can buy once and never see the order again is broken in a way all
ten scripts would otherwise pass.

**Without a mouse.** One full job per run driven by keyboard alone, with the focus
ring visible the whole way. Piggles' own audience includes a 61-year-old on a
phone in a workshop — tap targets and focus are not a compliance exercise here,
they are the product working for the person it was written for.

## What every run records

Four numbers and two confirmations, in the persona file. They cost minutes and
they are the only comparable data across ten businesses:

| Record                   | Why                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Time to live site**    | From landing on meetpiggles to a published site a stranger can reach. The product's core promise, measured ten times                                               |
| **Speed at real volume** | How the lists feel at 1,400 contacts, 60 variants, 300 photos. An owner's verdict, not a benchmark                                                                 |
| **Growth board**         | Did this signup produce one contact, one deal, the `brand:piggles` tag and the story fields? Built, never seen with a real signup                                  |
| **Usage rollup**         | Do the meters read sensibly for this tenant? Ten real businesses is the first data they will ever have — and point-in-time vs daily-total is easy to get backwards |

## Dev email WORKS — read it, do not write "not checked"

**This section used to say the opposite, and it was wrong.** It described a
transport selector that no longer exists: `SPARX_DEV_WORKER_ROUTES`, unset,
falling through to `{ kind: 'log' }`, so every `email.send` was logged and
never rendered. The selector is `EVENT_BROKER` now, `piggles/apps/account/.env`
sets it to `nats`, and the whole path runs. Measured end to end on 2026-09-01
(issue [368](issues/368-the-sign-in-screen-said-it-had-emailed-her-a-link-and-had-not.md)):
a magic link published as `sparx.email.send`, and the email-worker delivered and
acked that exact sequence number.

So a run CAN read what the customer receives. The console provider prints, to
the **event-worker's** stdout:

```
[email/console] magic-link → p03.devi@piggles.test :: Your sign-in link
<the full plain-text body follows on the next line>
```

Set `SPARX_EMAIL_LOG_HTML=1` to get the HTML instead of the text. That is the
subject line, the rendered body and whether the merge tags resolved — the half
this file previously said was unobtainable. **Order confirmations, booking
reminders, invoices, reset links, newsletters and review requests are all
checkable**, and eight of the ten personas depend on them.

Two things to hold on to:

- **It is the worker's terminal, not the app's.** The event is published by the
  app and rendered by `wizeworks/services/event-worker`, so the output appears
  there. Nothing is written to a table you can query — `email_events` records an
  `accepted` row for tenant-scoped mail, which tells you it was relayed, not what
  it said.
- **Absence still is not measurement (RULE #4).** If you did not go and look at
  the worker output, write "not checked". What must never happen is a run
  reporting that an email was sent because a screen said so — that exact false
  report is issue 368.

1. Read the persona file top to bottom before touching anything.
2. Set `Status: in progress` and stamp the date in **Run log**.
3. Work the acts in order. Each act names its jobs and what "done" means.
4. Fill in the **Account** block as soon as signup gives you the values — tenant
   id, subdomain, published site URL. A run nobody can revisit is a run nobody
   can confirm.
5. **On every pane you open**: score it in [rating.md](rating.md) in both themes
   and at 360px, and write its gap to 10 (RULE #6).
6. **On every defect**: file, fix, re-run the step as the persona, confirm in the
   issue, re-score the pane (RULE #3). Do not carry it to the end of the run.
7. Work the **standing checks** as you go — wrong moves, reload and deep links,
   dates, money edges, the buyer's side, one job without a mouse. The persona
   file names its own instance of each.
8. Complete **Verification** honestly at the end, including what you skipped.
9. Set `Status: done` only when every act has a recorded outcome — including
   "blocked on a decision, issue #012". Silence is not an outcome.

### Accounts

One persona, one real account, one real tenant. Never reuse another persona's —
the whole point is a business starting from nothing.

| Field    | Convention                                                 |
| -------- | ---------------------------------------------------------- |
| Email    | `p01.marisol@piggles.test` — persona id, then first name   |
| Password | `Piggles-Test-2026!` for every persona (local docker only) |
| Business | exactly the name in the persona file, apostrophes included |

Dev email is delivered and rendered — read it in the event-worker's terminal
(see above). The token is also in `verifications` if you would rather take it
from there; either way, record which you did.

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
**Fixed:** 2026-08-18
**Confirmed by:** re-ran P03 act 4 — 15 variants priced in one pass, saw the grid save
**Blocked on:** — (pipeline · decision · scope, only when the fix could not be made)
```

**Title it the way the owner would say it.** "Devi had to type fifteen prices one
at a time", not "bulk price mutation absent on variant grid". The cause goes in
**Where it lives**, not in the heading (RULE #1).

| Severity | Means                                                                                        |
| -------- | -------------------------------------------------------------------------------------------- |
| blocker  | cannot proceed · data loss · wrong money · a security exposure                               |
| major    | a real job cannot be finished the way an owner would do it, or a sentence on screen is FALSE |
| minor    | friction, confusion, a wrong count, an ugly edge                                             |
| design   | breaks a binding rule in DESIGN.md or either CLAUDE.md                                       |
| copy     | off-voice, jargon, sparx vocabulary — true, but the wrong words                              |

**When an issue is fixed, it stays.** Set `Status: fixed`, stamp `Fixed:`, and
record what the fix was, where it landed, and **how it was confirmed from the
screen**. A fix with no confirmation line is not fixed. This is a defect ledger,
not a queue — [FOLLOW_UPS.md](../FOLLOW_UPS.md) is the register that gets emptied.

There is deliberately **no index of issues**. `ls issues/` is the index, and a
hand-maintained table would be wrong within two runs.

## What is out of scope on a run

Fixing what the run finds is the job (RULE #3). These are the edges of it:

- **Redesigning a screen you are only passing through.** A pane you did not open
  as the persona gets no score and no rewrite.
- **A fix bigger than the surface under test.** File it, mark
  `Blocked on: scope`, say what it would take, and keep the run moving.
- **Running a migration.** Author the file; the pipeline applies it.
- **Restarting the dev server.** Ask Brandon. Parallel work dies with it.
- **Committing or pushing.** Leave the tree dirty and report what changed.
- **Resizing the browser window.** Check 360/390px in an iframe, never by
  resizing somebody's actual window.

## Definition of done — the whole exercise

- All ten persona files at `Status: done`, every act with a recorded outcome
- Every defect in `issues/` carrying a status, and every `fixed` one carrying a
  confirmation line naming the screen it was re-proved on
- [rating.md](rating.md) scored for every pane the ten runs opened, each with a
  gap to 10, and the unreached ones still visibly `—`
- **Twelve complete websites** — every page in every persona's inventory built,
  published and working; legal pages published and their footer links resolving;
  and each site looking like its own business rather than one template twelve
  times (RULE #8)

Ten scripts and no runs is nothing. Nine runs and one stock persona is an
unfinished deliverable that reads as finished. Ten runs with a hundred logged
defects and no fixes is a survey, which is not what this is. And ten businesses
whose websites are four pages of template copy have tested the builder's Publish
button, not the builder.
