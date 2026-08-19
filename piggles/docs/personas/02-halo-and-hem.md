# P02 — Nia Okafor · Halo & Hem

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Beauty & salon (`salon`) · **Rail groups:** people · web · money

## Account

| Field         | Value                  |
| ------------- | ---------------------- |
| Email         | `p02.nia@piggles.test` |
| Tenant id     | —                      |
| Subdomain     | —                      |
| Published URL | —                      |

## The person

Nia Okafor, 41, she/her. Twenty years behind a chair, six years running her own
salon. She rents a second chair to Dara Bell, who keeps her own diary and her own
clients but books through the same page.

Nia lives in her appointment book. Her current one is a paper diary plus a phone
that rings during colour services, and she loses roughly two bookings a week to
voicemail. She has tried two booking apps; both wanted a deposit setup she did
not understand, so both got deleted.

**What made her look:** a client rebooked with a competitor because Nia did not
call back until Tuesday.

## The business

**Halo & Hem** — a two-chair salon. Tuesday to Saturday. Cuts, colour and
barbering. She sells almost nothing physical — four retail products on a shelf by
the till, and that is it.

- **Time is the product.** Every service has a length, and colour has two lengths
  depending on hair
- Colour needs a **free consultation first** — non-negotiable, and it is the
  thing every booking system gets wrong
- She takes a **$25 deposit** on anything over 90 minutes because no-shows cost
  her a half day
- Closed Mondays; she takes a 45-minute lunch at 13:00; the first week of August
  she is away

## Why she is here today

1. "Clients book themselves, without ringing me."
2. "Nobody books a full head of colour without talking to me first."
3. "If they do not turn up, I am not out of pocket."

## Onboarding answers

| Question       | Answer                                                      |
| -------------- | ----------------------------------------------------------- |
| Business name  | `Halo & Hem`                                                |
| Trade          | Beauty & salon                                              |
| What do you do | I deal with customers · I need a website · I invoice people |
| Look           | first services-shelf option; record which                   |

She does **not** tick "I sell things". Watch what that costs her later — she has
four retail products, and the promise is that nothing is locked.

## The data

### Services

| Service              | Length  | Price   | Notes                           |
| -------------------- | ------- | ------- | ------------------------------- |
| Colour consultation  | 20 min  | free    | must precede any colour booking |
| Cut and finish       | 60 min  | $65.00  |                                 |
| Dry cut              | 30 min  | $40.00  |                                 |
| Restyle, long hair   | 90 min  | $95.00  | $25 deposit                     |
| Full head highlights | 150 min | $180.00 | $25 deposit, Nia only           |
| Root tint            | 75 min  | $85.00  | $25 deposit                     |
| Toner and gloss      | 45 min  | $45.00  |                                 |
| Barbering, skin fade | 30 min  | $30.00  | Dara only                       |
| Beard trim and shape | 20 min  | $18.00  | Dara only                       |
| Blow dry             | 40 min  | $38.00  |                                 |

### People and chairs

| Who        | Works                                  | Does                      |
| ---------- | -------------------------------------- | ------------------------- |
| Nia Okafor | Tue–Sat 09:00–17:30, lunch 13:00–13:45 | everything                |
| Dara Bell  | Wed, Fri, Sat 10:00–18:00              | barbering, cuts, blow dry |

Away: **1–8 August**, whole salon.

### Retail, on the shelf

| Product                       | Price  |
| ----------------------------- | ------ |
| Bond repair treatment, 100ml  | $32.00 |
| Sea salt texture spray, 200ml | $24.00 |
| Wide-tooth comb               | $9.00  |
| Silk scrunchie, set of three  | $14.00 |

### Clients to load

At least eight real-looking clients with history, including:

- **Priyanka Deshmukh** — `priyanka.d@example.test` — highlights every 10 weeks, allergic to ammonia (note on file)
- **Rob Alvarez** — `r.alvarez@example.test` — skin fade every 3 weeks with Dara
- **Margot Lindqvist** — `margot@example.test` — no-showed once, deposit kept
- **Ekaterina Volkonskaya** — `ekaterina.v@example.test` — a name long enough to break a table cell

## The website

**This list is the definition of done for the site** (CLAUDE.md RULE #8). Every
page real, in Nia's voice, with real photographs — no template sentence left
anywhere, and the whole thing working from the public side.

A salon site is a booking funnel with a price list attached. Everything points
at one button.

| Page                | What is really on it                                                  |
| ------------------- | --------------------------------------------------------------------- |
| Home                | What she does, the book button, hours, the two chairs                 |
| Services & prices   | All ten, with lengths and prices, and which need a consultation first |
| Book                | Live availability, the right stylist per service, deposits explained  |
| The team            | Nia and Dara, what each of them does, real photographs                |
| Gallery             | Real work — the reason anyone books a colourist                       |
| About               | Twenty years, why she opened                                          |
| Find us             | Address, hours including Monday closed, parking, phone                |
| Cancellation policy | Deposits, no-shows, 48 hours — the thing she is protecting            |
| Privacy · Terms     | Real, published, linked                                               |
| 404                 | Offers the booking page                                               |

**Working end to end:** booking with live slots, the deposit taken on the three
services that need one, the consultation rule visible before a colour booking,
the client changing her own appointment, and the four retail products buyable.

**Legal.** Run `get_legal_checklist` and close it out. Privacy is always
required. Scaffolding drafts them; **publishing is the owner's act**
in Content → Legal pages, and the footer links have to actually resolve.

**The look.** Considered and grown-up — a salon sells taste. Not clinical, not cute.

**Also required, as on every site:** a real header and mobile drawer, a footer
carrying hours, address, socials and legal links, per-page title and description
in plain words, a social card that renders, the sitemap, a favicon, a real 404,
and the same name/address/phone everywhere it appears.

## The run

### Act 1 — Sign up and onboard

Spine at speed, from `:3020`. Report only what differs from P01: the salon
starter, the salon pack, and a rail that has no "sell" group on it.

**Done when:** in the console, and `settings.industry = 'salon'` is confirmed.

### Act 2 — The rail she chose

She did not tick selling. Check honestly: can she still reach Sell and Stock in
one action, and does anything imply she must buy something to do so? A locked
door here is the whole product's promise failing.

**Done when:** confirmed, or filed.

### Act 3 — Set up the shop's time

In Bookings: create both people as resources, set their real hours including the
lunch break, close Mondays, and add the August holiday as an exception.

Watch for: whether an exception can span a week, whether a lunch break is
expressible at all, and what happens when Dara's hours are outside Nia's.

**Done when:** the calendar shows the real week, with Monday empty and lunch
blocked out.

### Act 4 — The services

Add all ten. Attach the right person to the ones only one of them does. Put the
deposit on the three that need it. Make the consultation free and 20 minutes.

**Done when:** ten services exist with correct lengths, prices, deposits and
resources.

### Act 5 — The booking page

Get bookings onto the published site: a page a client can reach in one tap from
the homepage, showing real availability. Write the salon's own words around it.

**Done when:** published, and the available slots on the live page match the
hours set in act 3 — including Monday being absent and lunch being unavailable.

### Act 6 — Be the client

On the published site, in a clean browser:

1. Book **Cut and finish** with Nia, Thursday afternoon.
2. Book **Full head highlights** and see what happens about the deposit and the
   consultation rule.
3. Pay a deposit with a test card.
4. Try to book Monday. Try to book 13:15. Both must be impossible.
5. Read the confirmation. Does it say where, when, and what happens next?

**Done when:** two bookings exist, the deposit was taken, and the two impossible
bookings were refused clearly rather than accepted quietly.

### Act 7 — Behind the chair

Back in the console:

- Both bookings appear on the right day, with the right person
- Reschedule the Thursday cut to Friday and see whether the client is told
- Mark Margot's old booking a **no-show** and confirm the deposit outcome
- Check one client in, and complete the service
- Add the ammonia allergy to Priyanka's record and confirm it is visible from the
  booking, not buried three screens away

**Done when:** each is done or filed.

### Act 8 — Money without a shop

Sell Priyanka a bond repair treatment at the till — a real sale, no online order.
Then invoice Dara for her chair rent, $600, monthly.

**Done when:** both exist and Money shows takings and rent apart from each other.

### Act 9 — Reminders

Set up the reminder the day before an appointment, in Nia's words rather than the
default. Confirm what actually sends in dev (`email.send` is a no-op — read the
queued event or the `verifications`/outbox rather than claiming it arrived).

**Done when:** the reminder exists and its real dev behaviour is written down.

### Act 10 — Phone reality

Nia runs the day from a phone between clients. At 390px: open tomorrow's
appointments, check somebody in, add a walk-in, and look up Rob's last visit.

**Done when:** all four done on a phone width, or the ones that could not are
filed.

## What only this persona proves

A business whose product is **time**: resources with different hours, a lunch
break, a holiday, a service only one person performs, a prerequisite
consultation, deposits, reschedules and a no-show. Plus the harder promise — a
salon that did not tick "I sell things" can still ring up a bottle of shampoo.

## Verification

| Check                                                         | Result |
| ------------------------------------------------------------- | ------ |
| `industry = 'salon'`, salon starter and pack installed        | —      |
| Sell and Stock reachable despite not being ticked             | —      |
| Live availability matches configured hours, exceptions, lunch | —      |
| Deposit taken on the services that require one                | —      |
| Monday and lunch cannot be booked from the public site        | —      |
| Reschedule, no-show and check-in all behave                   | —      |
| Client allergy note visible where it matters                  | —      |
| A till sale and a rent invoice both land in Money             | —      |
| Long client name does not break the list at 390px             | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Nia's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Cancel the wrong client's appointment. Delete "Cut and finish"
while Thursday's booking still points at it. Book the same 14:00 slot from two
windows at once.

**Dates.** 13:15, in the middle of lunch. A booking inside the 1–8 August
holiday. A reschedule that crosses a week boundary. Say which timezone the
machine is in.

**Money edge.** Refunding a $25 deposit on a cancellation. What is owing at the
chair after a deposit against the $180 highlights.

**Buyer's side.** The client changing her own appointment from the confirmation,
with no account and no phone call — the thing Nia bought this software for.

**Someone else's business.** Deep-link a Wildwater booking id. Nothing must come
back.

**Without a mouse.** Take one booking start to finish, keyboard only.

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
