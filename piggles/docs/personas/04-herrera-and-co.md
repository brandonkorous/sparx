# P04 — Tomás Herrera · Herrera & Co. Bookkeeping

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Professional services (`professional`) · **Rail groups:** money · people · web

## Account

| Field         | Value                    |
| ------------- | ------------------------ |
| Email         | `p04.tomas@piggles.test` |
| Tenant id     | —                        |
| Subdomain     | —                        |
| Published URL | —                        |

## The person

Tomás Herrera, 47, he/him. A bookkeeper with 22 clients, working from a spare
room with one part-time assistant two days a week. He is precise, slow to trust
software with money, and will check every total by hand the first time.

He has a spreadsheet that works and a website that does not. What he wants from
software is fewer unpaid invoices and fewer emails asking "did you get my
proposal".

**What made him look:** he wrote off $2,400 last year in invoices he never chased.

## The business

**Herrera & Co. Bookkeeping** — professional services. Nothing is shipped,
nothing is stocked, and there is no shop of any kind.

- Work is sold as **monthly retainers** and **one-off projects**
- Every engagement starts as a **quote** the client accepts
- Terms are **Net 15**, and he charges late fees he never actually applies
- He has **expenses** — software subscriptions, an accountant, mileage
- Enquiries come from his website's contact form and from referrals

The accented `á` in his name and the period in `Co.` both travel into the site
title, the invoice header, the sender name and the URL slug.

## Why he is here today

1. "A proposal a client can accept without printing anything."
2. "Invoices that go out on the first, every month, without me."
3. "A list of who owes me what, that is right."

## Onboarding answers

| Question       | Answer                                                      |
| -------------- | ----------------------------------------------------------- |
| Business name  | `Herrera & Co. Bookkeeping`                                 |
| Trade          | Professional services                                       |
| What do you do | I invoice people · I deal with customers · I need a website |
| Look           | first services-shelf option; record which                   |

He does **not** tick "I sell things", and he means it — this run should never
need a product. If a screen forces him to create one to raise an invoice, that is
a blocker.

## The data

### What he sells (services, not products)

| Service                                      | Basis   | Rate       |
| -------------------------------------------- | ------- | ---------- |
| Monthly bookkeeping — up to 75 transactions  | monthly | $340.00    |
| Monthly bookkeeping — up to 200 transactions | monthly | $620.00    |
| Payroll run, per cycle                       | monthly | $95.00     |
| Year-end preparation                         | fixed   | $1,150.00  |
| Catch-up bookkeeping                         | hourly  | $85.00/hr  |
| Systems setup and migration                  | fixed   | $900.00    |
| Advisory call                                | hourly  | $120.00/hr |

### Clients

| Client                  | Contact          | Email                         | Engagement                |
| ----------------------- | ---------------- | ----------------------------- | ------------------------- |
| Silverback Fencing LLC  | Dean Prosser     | `dean@silverbackfencing.test` | $620 monthly + payroll    |
| Ottoline Interiors      | Ottoline Fairfax | `o.fairfax@ottoline.test`     | $340 monthly              |
| Kwan Brothers Auto      | Michael Kwan     | `mkwan@kwanbrothers.test`     | $340 monthly, always late |
| Pemberton & Sload Legal | Ruth Sload       | `rsload@pembertonsload.test`  | year-end only             |
| Cutter Creek Farm       | Hal Dyson        | `hal@cuttercreek.test`        | catch-up, 14 hours        |

Load at least ten more so the list pages.

### The pipeline

Enquiry → Discovery call → Proposal sent → Won / Lost. Three live opportunities:

- **Northfield Dental** — $620/mo, at Proposal sent, $7,440 annual value
- **Bex Studio** — catch-up work, at Discovery call
- **Marrowbone Cycles** — year-end, at Enquiry, came from the website form

### Expenses

| What                   | Amount  | Frequency |
| ---------------------- | ------- | --------- |
| Accounting software    | $58.00  | monthly   |
| Professional insurance | $71.00  | monthly   |
| Assistant, 2 days/week | $980.00 | monthly   |
| Mileage, client visits | varies  | as logged |

## The website

**This list is the definition of done for the site** (CLAUDE.md RULE #8). Every
page real, in Tomás's voice, with real photographs — no template sentence left
anywhere, and the whole thing working from the public side.

No shop, no cart, nothing to add to a basket. A site that has to make a stranger
trust him with their books.

| Page            | What is really on it                                                       |
| --------------- | -------------------------------------------------------------------------- |
| Home            | Who he helps, what it costs to start, one clear next step                  |
| Services        | All seven, with how each is priced — monthly, fixed, hourly                |
| Who I work with | The five kinds of business, in their words not his                         |
| About           | 22 years, qualifications, why he works alone                               |
| Book a call     | A real time-picker, or a form if that is what exists                       |
| FAQ             | What a bookkeeper does that an accountant does not; what he needs from you |
| Contact         | Name, business, email, phone, "what do you need help with"                 |
| Privacy · Terms | Real, published, linked                                                    |
| 404             | Offers the contact form                                                    |

**Working end to end:** the contact form producing a findable record and a
notification, a client opening a quote by link and accepting it, a client opening
an invoice by link and paying it — all without an account. **If any page here
requires a product to exist, that is the finding.**

**Legal.** Run `get_legal_checklist` and close it out. Privacy is always
required. Scaffolding drafts them; **publishing is the owner's act**
in Content → Legal pages, and the footer links have to actually resolve.

**The look.** Plain, calm, high-contrast, no exclamation marks. Trust is the aesthetic.

**Also required, as on every site:** a real header and mobile drawer, a footer
carrying hours, address, socials and legal links, per-page title and description
in plain words, a social card that renders, the sitemap, a favicon, a real 404,
and the same name/address/phone everywhere it appears.

## The run

### Act 1 — Sign up and onboard

Spine at speed. Report what the `professional` starter and pack install, and
whether a business that sells nothing gets a shop it did not ask for.

**Done when:** in the console, `industry = 'professional'` confirmed.

### Act 2 — The empty-shop question

Look at the console as Tomás. How much of it assumes a product? Does the site
template come with a shop page? Does Home talk about sales? Does the first-run
checklist ask him to add something to sell — and if so, what is he supposed to
do?

This is the act that matters most for the roster. Root CLAUDE.md: a CRM-only team
and a CMS-only publisher are first-class. Prove it or file it.

**Done when:** every assumption of a product is either absent or filed.

### Act 3 — The website

Four pages: **Services**, **Who I work with**, **About**, **Contact**. Real copy
in his voice — plain, calm, no exclamation marks. A contact form that asks name,
business, email, phone and "what do you need help with".

**Done when:** published, and the form is on a page a stranger can reach.

### Act 4 — A lead arrives

From a clean browser on the published site, submit the contact form as
**Marrowbone Cycles** asking about year-end work.

Then in the console: does it arrive? Where? Is Tomás notified in any way he would
actually see? Does it become a person, an opportunity, both, or a row in a place
he will never look?

**Done when:** the enquiry is findable and its path from form to record is
recorded.

### Act 5 — Clients and the pipeline

Add the five named clients and at least ten more. Build the four-stage pipeline
and put the three opportunities on it with real values.

Move Northfield Dental from Proposal sent to Won and see what the software does
about it — ideally something, because that is the moment a bookkeeper wants an
engagement to exist.

**Done when:** the board reflects reality and a stage change is not a dead end.

### Act 6 — Quote to invoice

Build a real quote for **Northfield Dental**: monthly bookkeeping at $620, plus
$900 setup, plus payroll at $95, with a note about Net 15.

- Send it in a form a client could accept
- Accept it (as the client if that is possible; otherwise record how)
- Turn it into an invoice **without retyping the lines**

**Done when:** the invoice exists, matches the quote to the cent, and carries Net 15.

### Act 7 — The first of the month

Set up the recurring monthly invoices for the three retainer clients. Then raise
this month's by hand for all five clients, including:

- Cutter Creek's **14 hours at $85** — check the multiplication
- Silverback's **$620 + $95 payroll** on one invoice
- Tax applied correctly, whatever this business's rate is

**Done when:** five invoices exist, correct to the cent, sent.

### Act 8 — Getting paid, and not getting paid

- Record full payment from Ottoline
- Record a **partial** payment of $300 from Silverback
- Leave Kwan Brothers unpaid and push its date past due
- Send Kwan Brothers a reminder in his words, not a default

**Done when:** each invoice shows the right state and the right balance.

### Act 9 — Money

Open Money and answer his three questions: **who owes me what**, **how much came
in this month**, **what did it cost me**. Enter the four recurring expenses and a
mileage claim first.

If a number is wrong, it is a blocker — this is a bookkeeper.

**Done when:** the three questions are answered correctly, or the wrong figure is
filed with the arithmetic.

### Act 10 — The assistant

His assistant works Tuesdays and Thursdays and must see clients and invoices but
not the bank figures. Invite her, choose what she can see, and confirm from her
side what she actually gets.

**Done when:** the second user is in and the boundary is verified by signing in
as her — not by reading a permissions screen.

## What only this persona proves

A business with **no products at all**: quote → acceptance → invoice, recurring
retainers, partial payments, an overdue chase, expenses, and a real answer to
"who owes me what". Plus the accented character and the period in the business
name travelling everywhere, and the second user with a narrower view.

## Verification

| Check                                                                | Result |
| -------------------------------------------------------------------- | ------ |
| No screen required a product to be created                           | —      |
| `Herrera & Co. Bookkeeping` renders intact in title, invoice, sender | —      |
| Website form produces a findable record and some notification        | —      |
| Quote converts to an invoice without retyping                        | —      |
| Recurring invoices scheduled; manual invoices correct to the cent    | —      |
| Partial payment leaves the right balance                             | —      |
| Overdue invoice is visibly overdue and chaseable                     | —      |
| Money answers owed / in / out correctly                              | —      |
| Assistant's restricted view verified by signing in as her            | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Tomás's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Edit an invoice after it has been paid. Record the Ottoline
payment twice. Delete Kwan Brothers while $340 is outstanding against them.

**Dates.** Net 15 counted from a month-end issue date. The recurring invoice due
on the 1st. The 40-day overdue figure — check it against a calendar.

**Money edge.** A zero-value invoice. 14 hours at $85. Silverback's $620 + $95
with a $300 partial payment — the remaining balance to the cent.

**Buyer's side.** A client opening the quote and then the invoice by link, with
no account, and paying it.

**Someone else's business.** Deep-link a Kanto invoice id. Nothing must come back.

**Without a mouse.** Build and send one invoice, keyboard only.

**Recorded for this run** — time from landing on meetpiggles to a live site,
how the lists feel at this business's volume, whether the growth board got its
contact + deal + `brand:piggles` tag, and whether the usage meters read sensibly
for this tenant.

| Standing check               | Result |
| ---------------------------- | ------ |
| Wrong moves                  | —      |
| Reload · deep link · restore | —      |
| Dates                        | —      |
| Money edge                   | —      |
| Buyer's side                 | —      |
| Someone else's business      | —      |
| One job without a mouse      | —      |
| Time to live site            | —      |

## Panes rated

Every pane opened during this run gets a Design and an Ease score in
[rating.md](rating.md), with its gap to 10 (CLAUDE.md RULE #6). Score it as you
leave it, not from memory at the end.

| Pane | Design | Ease | Gap to 10 |
| ---- | ------ | ---- | --------- |
| —    | —      | —    | —         |

## Issues found

Filed, fixed and re-proved from the screen during the run (CLAUDE.md RULE #3).
A row with no confirmation is not a fixed defect.

| #   | Severity | What (in her words) | Fixed | Confirmed by |
| --- | -------- | ------------------- | ----- | ------------ |
| —   | —        | —                   | —     | —            |
