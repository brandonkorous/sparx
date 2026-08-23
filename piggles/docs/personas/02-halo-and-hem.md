# P02 — Nia Okafor · Halo & Hem

**Version:** 1.9
**Author:** Brandon Korous
**Last Updated:** 2026-08-22

**Status:** in progress
**Run:** started 2026-08-21. **All ten acts done.**
Machine clock is **PDT (UTC-7)**. Four standing checks are done and recorded
below (reload · deep link · restore, someone else's business, money at the edges,
**wrong moves**, and now **dates**); the buyer's side and one job without a mouse
are not.

**Act 5 is done.** Home, About, Contact and Book are written in her voice and
published, the header and footer are hers, and the site's identity — name,
tagline, phone, email, address, Instagram — is filled in and flowing through to
every page that shows it. The homepage's price list is the **live** booking
services block, so it can never drift from what she charges. Eight issues came
out of it ([093](issues/093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md)–[100](issues/100-the-check-before-publishing-said-1-things-to-look-at.md)),
six of them fixed and re-proved on the screen that found them.

**Act 6 is done.** Six real bookings exist, made through the public form as six
different clients, and the availability engine is proved right to the minute from
the customer's side. The confirmation now names **who** and **where**, and says
which clock it means. Three defects came out of the confirmation alone, and two of
them were the same shape: a value nobody had ever supplied, quietly standing in
for one nobody had measured.

- [107](issues/107-the-booking-confirmation-does-not-say-where-the-salon-is-or-who-she-booked.md) — the confirmation gave a time and nothing else. **Fixed:** the panel, the `.ics` and the email all read one resolver, and a booking at a business with one address now carries it even though nothing on that booking ever named a location.
- [108](issues/108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md) — **blocker.** Every website booking was stamped `UTC`, so Nia's own diary showed her clients seven hours late, three of them after she had locked up. **Fixed** at the engine, plus a migration that repairs the rows already written.
- [109](issues/109-the-booking-page-shows-its-times-in-the-visitors-timezone-not-the-salons.md) — the booking page drew every time in the reader's timezone, so a client booking from out of town read the whole grid shifted. **Fixed:** the page shows the salon's clock and names it, but only for a reader whose own would say something else.

Still open from act 6: the consultation rule before colour is words on a page and
nothing enforces it, and a deposit cannot be paid at all because every new tenant
is provisioned onto the `manual` payment gateway
([105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)).

**Three probe bookings need clearing in act 7** — `Refusal Probe`, at Thursday
13:15, Thursday 15:00 and Monday 10:00. The first and last were created by the
defect in [106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md)
before it was fixed and are exactly the impossible appointments it describes;
cancelling them is act 7's cancel step doing real work.

**Act 7 is done.** All five steps driven, three probe bookings cancelled, Margot
moved from Thursday to Friday (and told, on email AND text), a past appointment
marked a no-show, Yusuf checked in and completed. Four more defects, two fixed:

- [110](issues/110-her-diary-follows-the-laptops-clock-so-a-thursday-appointment-can-land-on-friday.md) — **open.** Her calendar draws in the laptop's timezone, so from Lisbon her Thursday runs 4 PM to 2 AM and one appointment lands on Friday. Right today only because her laptop is in Sacramento.
- [111](issues/111-the-appointment-does-not-know-who-it-is-for-so-an-allergy-sits-four-screens-away.md) — **fixed.** Priyanka's ammonia allergy was four screens from her colour appointment, and the client's name on the booking was not even a link. The appointment now carries who it is for, how to reach them, and what is written down about them.
- [112](issues/112-she-marked-a-no-show-and-was-never-told-whether-anyone-had-been-charged.md) — **fixed.** Marking a $180 no-show said a fee "is applied" and then never said whether one was. Both dialogs and the booking now say what actually happens to the money.
- [113](issues/113-a-clients-record-in-a-booking-business-has-no-appointments-on-it.md) — **open.** A client with a booked $180 appointment reads "no deals, tasks, orders or logged activity", Total spent $0.00, and is labelled a Lead. The customer record has no appointments on it at all.

**Act 8 is done, and it was the biggest one.** There was no way to take money in
person — in a product whose audience takes most of its money in person. A **Take
a sale** surface now exists, three real sales went through it, and Dara's $600
chair rent is invoiced and showing under what she is owed. Eight issues, five
fixed. Detail below.

**Act 9 is done, and the reminder turned out to already be switched on and going
nowhere.** Booking rules said _1 day before_ and _2 hours before_, and had since
act 3 — but **three of her five upcoming appointments had no reminder scheduled at
all**, because seven of her ten services carried no rule set and reminders hang off
the rule set. The dropdown that turns them off is under a heading about money and
is labelled "No deposit or cancellation rules", which is true and is not what it
does ([126](issues/126-seven-of-her-ten-services-remind-nobody-and-the-switch-is-labelled-as-something-else.md)).

Her reminder is now in her words — subject **"See you soon at Halo & Hem"**,
heading **"Your chair is booked"**, button **"Change or cancel"** — saved and
published. Seven issues, six fixed:

- [122](issues/122-every-email-her-salon-sends-is-signed-with-another-companys-name.md) — **blocker, fixed.** Every email her salon sends was signed **"Sent with sparx"**, linked to another company's marketing site, in front of her clients. The one file the documented de-branding sweep missed is the engine wrapped around every send.
- [123](issues/123-editing-one-paragraph-of-an-email-silently-overwrites-a-different-one.md) — **blocker, fixed.** Clicking a second paragraph and typing two words **replaced** it with the first paragraph's text. The editor's own comment said each field was keyed by node id; not one call site did it.
- [126](issues/126-seven-of-her-ten-services-remind-nobody-and-the-switch-is-labelled-as-something-else.md) — **blocker, fixed.** The reminder switch, wearing a label about deposits. All ten of her live services now carry a rule set.
- [124](issues/124-checking-what-an-email-says-shows-the-labels-and-none-of-the-facts.md) — **major, fixed.** Proofreading the reminder showed "Service" and "When" with nothing beside them: five of the sixteen merge-tag sources had no sample, including the booking.
- [125](issues/125-her-emails-sign-off-with-the-products-name-instead-of-her-salons.md) — **major, fixed.** The footer signed off **"Piggles"** where her salon's name belonged, because a flag meaning "we had no name" ships as true and nothing ever set it false.
- [127](issues/127-a-booking-never-says-whether-anyone-is-being-reminded.md) — **major, fixed.** A booking never said what had been sent or what still would. It does now, which is what makes [126]'s residue visible.
- [128](issues/128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md) — **open.** `check:boundaries` is documented as failing on a brand literal under `wizeworks/**`. It has no string rule at all, and ran green on [122] for as long as [122] existed.
- [129](issues/129-the-email-editor-draws-her-button-black-and-the-preview-draws-it-brown.md) — **open.** The editor canvas draws her button near-black and the preview draws it in her brand brown. The preview is the one that ships. Not chased: it is a canvas-theming question, not part of the reminder.

[119](issues/119-the-search-only-finds-you-what-you-already-know-the-name-of.md) was
closed on the way: act 9 began by typing **reminder** into the search box, which
returned a to-do list under Customers and nothing else. Neither screen that owns
reminders carried the word.

### What actually sends, in dev

Recorded on the screen rather than in the database, which is the point of [127]:

| What                       | When                                          | Where it is visible                         |
| -------------------------- | --------------------------------------------- | ------------------------------------------- |
| Booking confirmation       | immediately, email + text if both are on file | booking › What reaches them, marked Sent    |
| Reminder                   | at each ticked offset before the start        | same panel, marked **To go**, with its date |
| Change / cancellation note | on the move or cancel, immediately            | same panel, marked Sent                     |

The mechanics behind it: rows are written into `scheduling_booking_notifications`
**inside the booking transaction**, so a confirmed booking never exists without its
reminders. A 60-second tick in api-rest claims each due row, marks it `sent`
optimistically (at-most-once: a crash loses one notice rather than double-texting
somebody), renders the tenant's own `booking-reminder` email and hands it to
`email.send`. In dev that publish is a **logged no-op** — 25 `accepted` rows in
`email_events` for this tenant and no body stored anywhere, so the words can only be
read from the email designer, never from a delivery.

One reminder design serves every offset. Nia's two-hours-before reminder sends the
same words as her day-before one, which is why "See you soon" was the right subject
and "See you tomorrow" would have been wrong for one of the two. Nothing on either
screen says so.

**Act 10 is done, and it is the act that found the most.** Twelve issues
([130](issues/130-every-button-in-three-apps-is-see-through-in-the-dark.md)–[141](issues/141-a-narrow-toolbar-s-menu-loses-the-app-it-belongs-to.md)),
eleven of them fixed and re-proved at 390px, and two of the twelve are the widest
defects this run has turned up — neither of them about the phone at all.

**The phone found them because the phone is where you look at things.** Nia's
device is on dark, and on dark **every grey control in the console was invisible**
— `#27232a` ink on `#272d39` ground, a contrast ratio of **1.09** where AA wants
4.5. A completed booking in her diary was a blank rectangle; the Previous and
Next buttons under every list were button-shaped holes; 416 controls say
`color="neutral"` and every soft, outline and ghost one of them drew like that
([131](issues/131-the-console-s-grey-is-invisible-on-the-dark-canvas.md)). One
token was doing two jobs — the chrome's fill AND the semantic grey — and a colour
pinned dark in both themes cannot be ink. The two meanings are two tokens now.

Beside it, **three of the fifteen apps drew every control at 43% opacity**,
because one colour token carried an alpha byte: `--color-group-people: #8fc2c06e`
([130](issues/130-every-button-in-three-apps-is-see-through-in-the-dark.md)). Save,
Take a booking and Check in were all half there. Two characters, valid CSS,
green through typecheck, lint and every test — so the fix ships with a guard that
was shown to go **red on the real defect** before being trusted green.

**The diary would not say what day it is.** At 390px the toolbar was an empty
capsule: the date label carried `hidden … @sm:block`, and its own comment says
"in the day view especially — whose columns are resource names, not dates — this
is the ONLY thing naming the day". Today sat three columns off the right edge
behind a horizontal scroll, pressing **Today** did nothing visible, the two
chairs did not fit, and scrolling sideways took the hour gutter with it
([132](issues/132-the-diary-on-a-phone-never-says-what-day-it-is.md)). The week
heading was wrong at every width as well — "17–Aug 23, 2026", the start month
simply gone, four weeks in five
([133](issues/133-the-week-s-date-range-loses-its-first-month.md)).

**The act's own jobs, and what each one found.**

- **Tomorrow's appointments** — the diary named neither the day nor the client.
  A block showed the service and the CHAIR, which in Day view is the column
  heading directly above it
  ([135](issues/135-a-booking-calls-its-customer-a-customer.md)). And Sunday, the
  day the salon is shut, read "Nothing is booked yet. New bookings appear here as
  soon as they are made"
  ([136](issues/136-a-closed-sunday-reads-as-an-empty-one.md)).
- **Check somebody in** — worked, first time, on the phone. The one job that did.
- **Add a walk-in** — the form invites one in its own words and had nowhere to
  write the name. Four doors were shut at once: no field on the form, no way to
  make a customer from the picker, `addAttendee` refuses anything that is not a
  class, and `UpdateBookingInput` has no `customerId`. The booking pane said
  nothing about any of it
  ([134](issues/134-a-walk-in-has-no-name-and-can-never-be-given-one.md)).
- **Rob's last visit** — two separate walls. The search box returned three
  screens whose keyword "problem" contains r-o-b and said nothing at all about
  Rob ([137](issues/137-the-search-box-finds-three-screens-and-says-nothing-about-rob.md)),
  and his record has ten tabs, none of them his appointments
  ([139](issues/139-a-customer-s-record-has-ten-tabs-and-none-is-their-appointments.md)).

**One finding is still open on purpose.** The record search reaches Typesense and
gets a 200, and the index holds nine documents, all of them from synthetic
tenants. **None of Halo & Hem's customers, bookings, products or orders are in
it.** Whether that is a dev-environment gap (the indexer consumes
`search.entity.changed`, and the worker fleet does not run locally) or a real one
is not established, and [137] says so rather than guessing. What IS fixed is the
silence: the box now says "Nothing in your orders, customers or products matches
'Rob'", so it is a defect that can be seen instead of one that has to be assumed.

**Two things known going into act 10 are still true.** The diary draws in the
laptop's clock ([110](issues/110-her-diary-follows-the-laptops-clock-so-a-thursday-appointment-can-land-on-friday.md)),
and **seven of the twelve bookings still carry `UTC`** rather than the salon's
zone — they predate the [108](issues/108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)
fix and the repair migration has not been run, so a reminder timed off those rows
is seven hours out until it lands. **And three of her upcoming appointments still
have no reminder queued** — Colette on Thursday, Rob and Margot on Friday —
because reminders are laid at booking time and attaching a rule set does not
catch up what was already taken. The booking pane says so on each of them, which
is the point of [127](issues/127-a-booking-never-says-whether-anyone-is-being-reminded.md).

Two standing checks are still outstanding: the buyer's side, and one job without
a mouse. **Dates is done** — four defects out of it ([148]–[151]), and the last
one turned out to be that the salon had never said what time zone it is in. **Wrong moves is done** — all three of Nia's, six defects out of
them, in the section below.

## What act 10 found that no wider screen could

The phone is not a smaller version of the desktop; it is the version with nowhere
to hide. Four of the twelve are defects a wide screen genuinely conceals:

| What the wide screen showed            | What 390px showed                                   |
| -------------------------------------- | --------------------------------------------------- |
| A toolbar with the date in it          | An empty capsule and a hamburger ([132])            |
| A week of seven columns                | Three columns, and today off the right edge ([132]) |
| Four table columns, all readable       | A date over five lines and a clipped badge ([140])  |
| A footer telling you about shift-click | The same, on a device with no shift key ([138])     |

And two are the opposite — defects the phone did not cause and only made
impossible to keep ignoring. Grey text at 1.09:1 was on every screen all along;
it took looking at a dark phone in a dark room to see that the block was blank
rather than subtle.

[132]: issues/132-the-diary-on-a-phone-never-says-what-day-it-is.md
[138]: issues/138-eighty-seven-lists-each-wrote-their-own-instructions-for-a-keyboard.md
[140]: issues/140-the-bookings-list-on-a-phone-spends-five-lines-on-a-date.md

### Ids, so they are not looked up twice

| Service              | id                                     | Who / strategy               |
| -------------------- | -------------------------------------- | ---------------------------- |
| Barbering, skin fade | `b94ce185-78f5-45e3-a4c6-2627ddbacc4e` | Dara only (`barbering`)      |
| Beard trim and shape | `49000446-f849-4e00-8ea2-438933d69085` | Dara only (`barbering`)      |
| Blow dry             | `c28b3f18-0630-4378-9bd4-47bbde1689a8` | either · **customer choice** |
| Colour consultation  | `3fa80723-0fee-477d-8002-35536c5bb35d` | Nia only (`colour`)          |
| Cut and finish       | `f32d6c20-3d60-41e9-b407-dbeab23ac601` | either · **customer choice** |
| Dry cut              | `8346e858-504a-47cb-87e7-af954687fb37` | either · **customer choice** |
| Full head highlights | `7b8f00de-a8c2-4e6e-9abd-41de4b41d918` | Nia only (`colour`)          |
| Restyle, long hair   | `cf8a28bf-d897-4f7f-ad4a-ac24fd8b81e6` | either · **customer choice** |
| Root tint            | `3049177d-9fa6-4b7b-93d9-ea7644bfd46f` | Nia only (`colour`)          |
| Toner and gloss      | `e7ad4f40-f36a-4834-9324-6e6c2ae5e53a` | Nia only (`colour`)          |

People: Nia `94409651-7acb-45a9-ae90-16b1198c48c3` (`cut,colour,styling,treatment`),
Dara `7d8fc0c5-5f1f-4c8e-9a6a-d3a19e218520` (`cut,barbering,styling`).
Place: **Halo & Hem** `69b08bcc-b602-42d0-aaba-f5dd9554f5e1`, America/Los_Angeles.

Pages: Home `0d2e3c5b-67b2-468e-9877-1b6348fe8805` · Book
`65d41168-cd74-4186-91d5-ce4f7f86c058` · About `9c0e4507-4763-408c-a703-4308a1002b61`
· Contact `f61d9c64-3e78-4c37-84ad-d839d8001060` · The team
`162ddfb4-2b39-43e0-8755-5df815fc2f29` · Our work
`26098707-9ed6-45dc-9aa3-4d14ce9e78d6` · Deposits and changes
`aad42687-34d2-400e-8b74-fcaf4fa84923`.

### The diary as it stands, for act 9

Real times, in the salon's own clock. Six live appointments, three cancelled
probes, and two finished.

| When (PDT)       | Who                   | What                 | State               |
| ---------------- | --------------------- | -------------------- | ------------------- |
| Thu 20 Aug 14:00 | Margot Lindqvist      | Full head highlights | **Did not turn up** |
| Sat 22 Aug 15:00 | Yusuf Karadeniz       | Cut and finish       | **Completed**       |
| Thu 27 Aug 13:15 | Refusal Probe         | Cut and finish       | Cancelled           |
| Thu 27 Aug 15:00 | Refusal Probe         | Cut and finish       | Cancelled           |
| Thu 27 Aug 16:00 | Colette Mbeki         | Cut and finish       | Confirmed           |
| Fri 28 Aug 09:00 | Priyanka Deshmukh     | Full head highlights | Confirmed           |
| Fri 28 Aug 10:30 | Rob Alvarez           | Barbering, skin fade | Confirmed           |
| Fri 28 Aug 14:00 | Margot Lindqvist      | Cut and finish       | Confirmed           |
| Sat 29 Aug 11:00 | Ekaterina Volkonskaya | Restyle, long hair   | Confirmed           |
| Mon 31 Aug 10:00 | Refusal Probe         | Cut and finish       | Cancelled           |

**Only three rows carry the right stored zone** — Margot's no-show, Yusuf's
completed cut and Colette's Thursday, all written after
[108](issues/108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)
was fixed. The other seven still say `UTC`, so the bookings LIST and the booking
header show them seven hours late until the backfill migration runs. **The
calendar shows them all correctly**, because it reads the laptop's clock — which
is the coincidence [110](issues/110-her-diary-follows-the-laptops-clock-so-a-thursday-appointment-can-land-on-friday.md)
is about. The table above is what the clients actually booked.

Margot's Friday cut is the one moved in act 7 (from Thursday 14:00); she was
told on email and text. Her Thursday 20 Aug colour is the past booking created
so a no-show could be marked, and it settled to nothing — no deposit was ever
taken, because none can be
([105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)).

Priyanka's record carries the ammonia note, and it now shows on her appointment
([111](issues/111-the-appointment-does-not-know-who-it-is-for-so-an-allergy-sits-four-screens-away.md)).

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

### The money as it stands, for act 9

Written during act 8, all of it real and none of it seeded.

| What                                 | Who               | Amount  | State                        |
| ------------------------------------ | ----------------- | ------- | ---------------------------- |
| O-000001 · Bond repair treatment     | Priyanka Deshmukh | $45.00  | Paid on **card** · _To send_ |
| O-000002 · Bond repair take-home kit | Priyanka Deshmukh | $22.00  | Paid in cash · **Collected** |
| O-000003 · Dry cut                   | Rob Alvarez       | $40.00  | Paid in cash · **Collected** |
| INV-000001 · Chair rent, September   | Dara Bell         | $600.00 | Owed, due 1 Sep 2026         |

Only **O-000001** still reads To send — it is the one written before
[116](issues/116-a-sale-taken-at-the-counter-waits-forever-to-be-sent-to-a-warehouse.md)
was fixed. The first **two** are missing from Money, because both predate
[117](issues/117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md)
and carry no origin site. Left exactly as they
are, because they are the evidence — `What you kept` reading **$40.00** rather
than $107.00 is the defect staying visible instead of being tidied away.

**Dara Bell is now a customer as well as a stylist**
(`d992ef70-fdc7-4b6c-93d8-9de2fa49457f`), because the person who pays you rent is
a customer. She is still not in My Team
([120](issues/120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)),
so no sale can be credited to her.

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

**Done.** Both exist, and Money shows them apart: **Money paid to you** lists the
counter sale, **Owed to you** carries the rent. Getting there meant building the
till, because there was none — the single largest gap this persona has found. The
act produced eight issues, five of them fixed and re-proved on the screen that
found them.

- [114](issues/114-she-cannot-write-down-money-she-took-in-the-room.md) — **blocker.** There was no way to write down money taken in the room. Not a missing button: `POST /v1/orders` had `channel: 'admin'` in its enum the whole time and nothing in either console called it. **Fixed:** a **Take a sale** surface that sells her diary services and her products from one list, takes a written-in one-off, and records the money.
- [117](issues/117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md) — **blocker.** $67 in the till and Money said "No payments yet" and "No money came in". Two causes: the sale carried no origin site, and **Rebuild figures** rebuilt a cache of a cache — the revenue it subtracts from is owned by a nightly job. **Fixed** at both.
- [116](issues/116-a-sale-taken-at-the-counter-waits-forever-to-be-sent-to-a-warehouse.md) — a $45 treatment closed as **To send**, offering **Send to the warehouse**. **Fixed:** a counter sale records as collected and closes.
- [118](issues/118-there-was-no-way-to-say-a-card-was-taken-on-her-own-machine.md) — Cash, Cheque or Wire transfer, and most of her money arrives on the reader on her counter. **Fixed:** `card` is a real way to be paid, and refunding one no longer promises a credit nothing can make.
- [115](issues/115-she-typed-600-into-the-invoice-and-it-billed-dara-nothing.md) — she typed 600 into the box marked **Cost** and invoiced Dara **$0.00**, with the figure shown nowhere. **Fixed:** **Price each** and **Cost to you**, each saying which is which, and the tax rate asked for out of a hundred.

Still open from act 8: the search rejects the sentence it invites
([119](issues/119-the-search-only-finds-you-what-you-already-know-the-name-of.md)),
her two stylists are staff in Bookings and nobody in My Team so a sale cannot be
credited ([120](issues/120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)),
and a monthly rent has to be re-keyed every month
([121](issues/121-rent-is-due-every-month-and-the-invoice-can-only-be-raised-once.md)).

Act 7's open question is answered: completing Yusuf's cut produced no order and
no money **because nothing on the platform could produce one**. That was the
defect, and it is [114].

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

**Done 2026-08-22.** All four done at 390px, three of them only after a fix.
Check-in was the one that worked first time. Twelve issues
([130](issues/130-every-button-in-three-apps-is-see-through-in-the-dark.md)–[141](issues/141-a-narrow-toolbar-s-menu-loses-the-app-it-belongs-to.md)),
eleven fixed and re-proved on the phone that found them; [137]'s empty search
index is open and deliberately not diagnosed.

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

| Date       | Act | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | 1   | meetpiggles → Start free → signup → onboarding. Business `Halo & Hem`, trade **Beauty & salon**, ticked website · customers · invoices (NOT selling). Look shelf offered six: Universal Starter, **Salon (Editorial)** (chosen), Salon (Modern), Barbershop (Heritage), Barbershop (Modern), Nail Studio (Gallery). Installed `sparx-salon-editorial` 1.3.0 + base `sparx` 1.4.0. `settings.industry = 'salon'` confirmed. Slug came out readable — `halo-and-hem`, not a random pair.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-21 | 2   | **Nothing is locked.** Sell and Stock are both in her rail despite not ticking "I sell things", each one click, each fully populated (Sell: Orders 2, Products, Bundles, Discounts, Gift cards…; Stock: Locations, Shelves, Counts, Barcodes…). No upsell, no gate, no price anywhere. Only Partners, Automations and Connections sit outside the rail, reachable from All apps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-21 | 3   | Created **Nia Okafor** and **Dara Bell**. Set Nia Tue–Sat 09:00–13:00 + 13:45–17:30, Dara Wed/Fri/Sat 10:00–18:00, Mon and Sun closed, and one whole-business closure **1–8 Aug 2027** ("Salon closed, summer week", Everyone). Used 2027 because 1–8 Aug 2026 is already past. Two defects found and fixed: [081](issues/081-her-salon-opens-at-nine-and-the-diary-showed-appointments-at-three-in-the-morning.md) (everything defaulted to UTC — her 9am diary showed 3am colour appointments) and [084](issues/084-she-typed-her-whole-week-in-and-the-diary-looked-exactly-the-same.md) (the diary drew none of the hours she had just typed). The calendar now shows her real week.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-21 | —   | Standing check **reload · deep link · restore** run early, because act 3 needed it: [082](issues/082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md) — **every** link into the console opened nothing at all. Found, fixed, re-proved on five addresses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-21 | 4   | Found **18 services** where a two-chair salon should have none — two seeders both wrote a salon menu, with two prices for Balayage and two for a full head of colour ([085](issues/085-her-price-list-had-two-of-everything-at-two-different-prices.md)). Cleared the practice data (7 went), deleted the other 11 one at a time, and typed her ten. **Money edge on the way in:** `65,00` for a cut read back as **6500** — a blocker, swept across ten money fields ([086](issues/086-she-priced-a-cut-at-sixty-five-and-the-booking-page-said-six-thousand-five-hundred.md)). The service pane then insisted "Not saved" after saving ([087](issues/087-the-screen-kept-telling-her-the-change-was-not-saved-after-it-saved.md)), and there was no way at all to say only Dara does the fades ([088](issues/088-she-could-not-say-that-only-dara-does-the-fades.md)). All three fixed. Also deleted four staff she never hired that the sample clear left behind.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-21 | 5   | Published `/book`. **The booking page is right, and the availability engine is right to the minute** — see the table below. Then opened her own homepage as a client would and found it selling **six sparx-branded products** with prices ([091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)) — a hardcoded `GOLDEN_BLUEPRINT_KEY = 'sparx'` dresses every tenant of every brand, while `piggles-starter` (same six, named "Rowan") sat unused. Fixed by making the starter site a fact about the BRAND. Deleted her six; the empty grid then advertised **"Product name · $0.00 · Sold out"** ([092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md)). On the way in, her web address turned out to be `swift-horizon-4860.piggles.site` while the account app calls her `halo-and-hem.piggles.site` — two screens, two addresses, and the console's is the one that resolves to nothing ([089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)). And Domains offered to sell her a domain from **shop.sparx.works** ([090](issues/090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md)), now removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-22 | 5   | **Act 5 finished.** Wrote and published Home, About, Contact and Book in her voice; filled Site identity (phone, email, address, Instagram, tagline) and rebuilt the footer around it. Replaced the starter's hand-typed four-service price list with the **live** Booking services block — her ten real services, prices and lengths, on the homepage, unable to drift. Eight issues out of one act: her contact page carried a **map of the demo salon's street in Portland** with no field anywhere to move it, because five host cores declared author props that nothing in the console ever drew ([093](issues/093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md), fixed); the palette's Contact strip and Find us blocks shipped **(555) 123-4567 and hello@example.com** while the identical blocks the starter installed were bound to Site identity and said so on screen ([094](issues/094-the-blocks-for-how-to-reach-us-shipped-a-strangers-phone-number.md), fixed); `/book` went to search as a module constant rather than the title she typed ([096](issues/096-her-booking-page-went-to-search-as-the-platforms-sentence-not-hers.md), fixed); Bookings › Places claimed two places were in use by **four people and eleven services she had deleted**, and the delete confirmation warned her off removing one on the strength of it ([097](issues/097-her-bookings-said-two-places-were-in-use-by-people-she-had-deleted.md), fixed). Open: the live services block emits a second `<h1>` and two sentences she cannot edit ([095](issues/095-the-booking-list-put-a-second-page-title-on-her-homepage-in-words-she-cannot-change.md)), a Bookings place called **Maison Élan** ([098](issues/098-a-place-in-her-bookings-was-called-maison-elan.md)), and `site.map` printed as a layer name ([099](issues/099-the-layers-list-called-her-map-site-map.md)). |
| 2026-08-22 | 5   | **The rest of the site.** Built and published **The team**, **Our work** and **Deposits, changes and no-shows**, put all three in the header, the mobile drawer and the footer, and published Privacy, Terms and Cookie after rewriting the commerce language out of each (a salon does not have "orders, payments and deliveries"). Four more issues, all fixed and re-proved: every page of her website carried **sparx's logo in the browser tab** ([101](issues/101-her-salons-website-put-another-companys-logo-in-the-browser-tab.md)); picking a photograph wrote the **file name** into the field a screen reader reads, which also satisfied the pre-publish check that exists to catch a missing one ([102](issues/102-picking-a-photo-wrote-the-file-name-where-the-description-should-go.md)); Legal pages told a hair salon it was **"0 of 4 required"** because one of the four was a returns policy ([103](issues/103-a-hair-salon-was-told-it-had-to-publish-a-returns-policy.md)); and the count on the pre-publish check read "1 things" ([100](issues/100-the-check-before-publishing-said-1-things-to-look-at.md)). The check itself is good — it caught an image with no picture in it, and a skipped heading level on the gallery, both fixed. Site now: 7 pages live, 3 legal pages published with their footer links resolving, a real 404, her own favicon and logo, and one live services block that cannot drift from her prices.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-22 | 6   | **As the client, on the live site.** Three real bookings made through the public form: Margot's cut with **Nia** on Thursday at 2:00, Priyanka's full head of highlights on Friday at 9:00 with her ammonia note, Ekaterina's restyle on Saturday at 11:00, and Rob's skin fade with **Dara** on Friday at 10:30. **The availability engine is right to the minute from the customer's side** — with Nia chosen on a Thursday the grid runs 9:00–12:00 then jumps to 1:45, which is her 45-minute lunch and a one-hour service; with Dara on a Friday there is no gap at all, because Dara takes no lunch; Monday returns "No open times that day" and offers the waitlist. Three defects, two of them blockers. Her booking page offered **no way to choose a stylist** — the setting existed but was hidden on every service more than one person can do ([104](issues/104-a-two-chair-salon-could-not-let-a-client-choose-their-stylist.md)). Priyanka's $180 highlight booking answered **"An internal error occurred"** while creating the appointment anyway, because every new tenant is provisioned onto the `manual` payment gateway and the deposit step treated that as a broken one ([105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)). And the public endpoint **accepted a booking inside Nia's lunch and one on the Monday she is shut** — the slot grid was the only thing enforcing her hours ([106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md)). All three fixed and re-proved from the screen.                                                                                                                                                                                                                                                                                                                       |
| 2026-08-22 | 6   | **Act 6 finished — reading the confirmation.** It said WHEN and what happens next, and nothing about **where** or **who** ([107](issues/107-the-booking-confirmation-does-not-say-where-the-salon-is-or-who-she-booked.md)) — a client who has never been to Halo & Hem got a time and three calendar links. Fixing it meant asking where a booking happens, and that question turned up the run's third blocker: **`location_id` is null on every row Nia owns**, because a two-chair salon never picks a location anywhere, and `createBooking` fell through the same missing answer to stamp `timezone: 'UTC'` on every booking made from her website. Her own diary was showing Margot at **9:00 PM** for a 2:00 PM cut, and three clients arriving after she had locked up ([108](issues/108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)). The same thread ran one step further out: the booking PAGE drew its times in the reader's own timezone, so a client booking from out of town read the whole grid shifted with nothing saying so ([109](issues/109-the-booking-page-shows-its-times-in-the-visitors-timezone-not-the-salons.md)). All three fixed and proved on the screen: Yusuf's booking confirms as "Cut and finish **with Nia Okafor** … Saturday, August 22 at 3:00 PM" over **Halo & Hem, 214 Bower Street, Suite B, Sacramento, CA 95811**, the `.ics` carries the same address in `LOCATION` and "With Nia Okafor" in its description, the diary reads **3:00 PM**, and a browser pretending to be in New York sees the salon's own 9:00 AM–4:30 PM with "All times shown are our local time (PDT)" beneath it.                                                                                                                                                                                                                                                   |
| 2026-08-22 | 7   | **Behind the chair.** Cancelled the three `Refusal Probe` bookings (each one warned properly — it named the slot, said the customer is told, and the dismiss button reads "Keep it"), moved Margot's cut from Thursday to Friday, and confirmed **the client really is told**: a `change` notice went out on email AND text within the minute, and the three cancelled probes got cancellation emails. Took a booking in the past for a client who did not turn up, marked it a **no-show**, checked Yusuf in and completed his cut — the history reads back cleanly, and it distinguishes "Automatic" (the website took it) from "A team member". Four defects. Her **calendar** turns out to be drawn in the laptop's clock, so from Lisbon her Thursday runs 4 PM to 2 AM and a 4 o'clock appointment lands on Friday ([110](issues/110-her-diary-follows-the-laptops-clock-so-a-thursday-appointment-can-land-on-friday.md), open). Priyanka's ammonia allergy went onto her record and was **four screens away from the colour appointment it exists for** — the client's own name on the booking was not even a link ([111](issues/111-the-appointment-does-not-know-who-it-is-for-so-an-allergy-sits-four-screens-away.md), fixed; the 835-line pane came apart into nine files on the way). Marking a **$180 no-show** said "any no-show fee in your booking rules is applied" and then never said whether one was — her colour rule sets no fee, and no deposit exists to keep ([112](issues/112-she-marked-a-no-show-and-was-never-told-whether-anyone-had-been-charged.md), fixed). And Priyanka's customer record, with $180 booked for Friday, reads "no deals, tasks, orders or logged activity", **Total spent $0.00**, and calls her a **Lead** ([113](issues/113-a-clients-record-in-a-booking-business-has-no-appointments-on-it.md), open).                                                            |
| 2026-08-21 | —   | Standing check **someone else's business**: deep-linked one of Marisol's orders (`ee8bd403…`, Thistle & Rye). `GET /v1/orders/…` → **404**, nothing leaked. The panel then spun for ever instead of saying so — [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-22 | 8   | **The till that was not there.** Nia finished a bond repair on Priyanka in the chair and had nowhere to write down the $45. `take a payment` in the box that asks what she wants to do returned **Nothing matches that** ([119](issues/119-the-search-only-finds-you-what-you-already-know-the-name-of.md)); Orders offered no way to make one and said so in its own code — _"orders are placed by customers, or by checkout on their behalf"_. Built **Take a sale** ([114](issues/114-she-cannot-write-down-money-she-took-in-the-room.md)) and sold her three things through it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-22 | 8   | **Three defects fell out of the first sale.** It closed as **To send** with **Send to the warehouse** as its next step, in a salon with no warehouse ([116](issues/116-a-sale-taken-at-the-counter-waits-forever-to-be-sent-to-a-warehouse.md)). There was no way to say the card was taken on her own reader, and refunding one promised the platform would send the money back ([118](issues/118-there-was-no-way-to-say-a-card-was-taken-on-her-own-machine.md)). And $67 of takings never reached Money at all — two causes, one symptom ([117](issues/117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md)). All three fixed and re-proved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-22 | 8   | **Dara’s chair rent.** Added Dara Bell as a customer (she was staff in Bookings and no one anywhere else — [120](issues/120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)) and raised **INV-000001**, $600, due 1 Sep. Typing 600 into the box labelled **Cost** produced a **$0.00** invoice with the figure nowhere on screen ([115](issues/115-she-typed-600-into-the-invoice-and-it-billed-dara-nothing.md)). Nothing on the editor can say the rent repeats ([121](issues/121-rent-is-due-every-month-and-the-invoice-can-only-be-raised-once.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-23 | 9   | **The reminder that was on and going nowhere.** Typed **reminder** into the search box and got a to-do list under Customers — neither screen that owns reminders carried the word ([119](issues/119-the-search-only-finds-you-what-you-already-know-the-name-of.md), now fixed along with the phrase search it was filed for). Found Booking rules already ticked for _1 day_ and _2 hours_ since act 3, and then found that **three of her five upcoming appointments had no reminder scheduled at all**: seven of her ten services carry no rule set, reminders hang off the rule set, and the control that turns them off is filed under **What it costs** and labelled "No deposit or cancellation rules" ([126](issues/126-seven-of-her-ten-services-remind-nobody-and-the-switch-is-labelled-as-something-else.md), blocker, fixed). Set a rule set on all seven — five onto Salon cancellation, the free consultation onto Standard, which asks the same notice without the $25 fee.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-23 | 9   | **Her words, and two blockers in the way of writing them.** Rewrote the reminder's subject, heading, greeting, button and closing line, saved and published. Getting there cost two fixes: clicking a second paragraph and typing two words **replaced it** with the first paragraph's text ([123](issues/123-editing-one-paragraph-of-an-email-silently-overwrites-a-different-one.md), blocker) and the preview showed the card's labels with **none of the facts** beside them, because five of the sixteen merge-tag sources had no sample and the booking was one of them ([124](issues/124-checking-what-an-email-says-shows-the-labels-and-none-of-the-facts.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-23 | 9   | **The footer, read properly for the first time.** Every email her salon sends was signed **"Sent with sparx"** and linked to another company's marketing site ([122](issues/122-every-email-her-salon-sends-is-signed-with-another-companys-name.md), blocker, fixed) — and the sign-off line above it said **"Piggles"** where **Halo & Hem** belonged ([125](issues/125-her-emails-sign-off-with-the-products-name-instead-of-her-salons.md), fixed). The guard `wizeworks/CLAUDE.md` says catches exactly this has no string rule at all ([128](issues/128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md), open).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-23 | 9   | **What reaches them.** The booking pane never said what a customer had been told or would be told, though the ledger has carried it since act 7. It does now ([127](issues/127-a-booking-never-says-whether-anyone-is-being-reminded.md)) — Priyanka's Friday colour lists three reminders **To go** with their dates; Margot's Friday cut lists a confirmation and a change notice **Sent** and then says no reminder is due, and why. That sentence is the residue of [126]: attaching a rule set now does not catch up a booking already taken.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-22 | 10  | **The phone, and the two things it made impossible to ignore.** Opened the console in a 390px frame on dark. Her Save button was see-through: one colour token in the People group carried an alpha byte (`#8fc2c06e`), so every control in Customers, Messages and Bookings drew at 43% ([130](issues/130-every-button-in-three-apps-is-see-through-in-the-dark.md)). Asked what colour the text on a calendar event was and got `#27232a` on `#272b37` — **1.09:1** — which is not faint, it is blank: `neutral` was Piggles' chrome colour, pinned dark in both themes, and silica's soft/outline/ghost variants ink themselves with the colour itself. 416 controls draw that way ([131](issues/131-the-console-s-grey-is-invisible-on-the-dark-canvas.md)). Both fixed at the token, plus a guard proved red on the real defect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-22 | 10  | **Tomorrow's appointments.** The toolbar was an empty capsule — the date carried `hidden @sm:block` — and in Day view the columns are staff names, so nothing on screen named the day. Today was three columns off the right edge and **Today** did nothing visible; two chairs did not fit; scrolling sideways took the hour gutter with it ([132](issues/132-the-diary-on-a-phone-never-says-what-day-it-is.md)). The week heading read "17–Aug 23, 2026" at every width ([133](issues/133-the-week-s-date-range-loses-its-first-month.md)). Sunday, the day the salon is shut, read "Nothing is booked yet" ([136](issues/136-a-closed-sunday-reads-as-an-empty-one.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-22 | 10  | **Checked somebody in, and added a walk-in.** Check-in worked first time on the phone — the one job that did. The walk-in did not: the form invites a name in its own copy and had nowhere to write it, and four doors were shut at once ([134](issues/134-a-walk-in-has-no-name-and-can-never-be-given-one.md)). Took a second walk-in after the fix — **Tomas Herrera**, 6 PM Dry cut — and he is named in the header, the Who section, the list and the diary. The first one still reads "No one assigned", as it should: nobody ever wrote one down.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-22 | 10  | **Rob's last visit, and two walls.** Typed "Rob" in the search box and got three screens whose keyword "problem" contains r-o-b, and not a word about Rob ([137](issues/137-the-search-box-finds-three-screens-and-says-nothing-about-rob.md) — the index holds nine documents, all from synthetic tenants, and none of this tenant's). Opened his record instead: ten tabs, none of them his appointments ([139](issues/139-a-customer-s-record-has-ten-tabs-and-none-is-their-appointments.md)). Both fixed; his Friday barbering now sits on his own record.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-22 | 10  | **The list, the footer and the folded toolbar.** The bookings list spent five lines on a date and clipped its badges ([140](issues/140-the-bookings-list-on-a-phone-spends-five-lines-on-a-date.md)). Every list's footer told a phone about shift-click and alt-click — 87 hand-written copies of one sentence, in five wordings, none of them changeable at once ([138](issues/138-eighty-seven-lists-each-wrote-their-own-instructions-for-a-keyboard.md)). The narrow toolbar's menu held an unlabelled chain glyph, a right-shoved toggle and the wrong app's colour ([141](issues/141-a-narrow-toolbar-s-menu-loses-the-app-it-belongs-to.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-22 | SC  | **Wrong moves, one: cancelled the wrong client.** Meant to clear a leftover probe at 10 PM Thursday, hit the row above it. The confirm said "Cancel Cut and finish?" — she has six of those — and never said Colette. Clicked through; Colette had a cancellation email 39 seconds later. Slot released cleanly and the booking was re-takeable, so the repair works; the guard did not ([142](issues/142-the-question-before-cancelling-an-appointment-never-says-whose.md), blocker, fixed). Fixing it found the same two questions written twice, the diary's copy still carrying the hedges 112 removed ([143](issues/143-turning-off-tell-the-customer-on-a-cancellation-still-told-them.md) fell out of it), and the console greeting the owner of the business as a **Team member** on every load ([144](issues/144-the-console-greets-the-owner-of-the-business-as-a-team-member.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-22 | SC  | **Wrong moves, two: removed a service seven bookings point at.** Removed **Cut and finish**. The confirm said bookings are kept (no number: seven, two of them next week) and that it could not be undone (untrue: `deleteService` only stamps `deletedAt`). Her live homepage went 10 services to 9 and the 5 haircut vanished from the price list. Turning the light on found **twelve** removed services sitting invisible since act 3 ([145](issues/145-removing-a-service-was-called-permanent-and-never-was.md), fixed: a Removed filter, a Put it back action, and a confirm that counts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-22 | SC  | **Wrong moves, three: two windows, one chair.** Fired up to eight simultaneous requests at one slot. **The data was never wrong** — one booking every time, the no-overlap constraint doing its job. What she was told was: the losers came back 500 and the console said "Something went wrong on our end" beside a booking that had just succeeded. Postgres names the cause — `deadlock detected / while checking exclusion constraint`, 40P01 not 23P01 ([147](issues/147-two-people-booking-one-chair-at-once-told-the-winner-it-had-failed.md)). And a clean refusal told her somebody had edited her booking ([146](issues/146-a-slot-that-was-taken-told-her-somebody-had-edited-her-booking.md)). Both fixed and re-proved: 32 racing requests, zero server errors, one live booking per slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-22 | SC  | **Dates, one: 13:15, in the middle of lunch.** Her week runs 9:00–1:00 and 1:45–5:30; her diary shades the gap; her website stops offering times at 12:30 and picks up at 1:45. The console booked a client into 1:15 PM and marked it **Confirmed**, with no warning — and the diary drew the block inside its own closed band. Two of her real appointments were already in there, plus four on a Monday she is shut. The engine checked clashes, outside calendars and closures, and never once checked the hours ([149](issues/149-the-lunch-break-she-set-was-only-enforced-on-her-website.md), blocker, fixed). Act 6's [106] had fixed this from the customer's side — in the public ROUTE, so the staff route never saw the guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-08-22 | SC  | **Dates, two: a booking inside the 1–8 August holiday.** The closure held, and the sentence did not: "That time was taken while you were filling this in. Pick another time." Nobody took it — she shut the salon, and picking another time gets the same refusal eight days running ([150](issues/150-a-week-the-salon-was-shut-was-reported-as-somebody-elses-booking.md), fixed). Now: _Nothing can be booked then: "Salon closed, summer week" runs from Sun, Aug 1, 2027 to Sun, Aug 8, 2027._                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-22 | SC  | **Dates, three: a reschedule across a week boundary.** Clean. Moved Tue 25 Aug 1:15 PM → Tue 1 Sep 2:00 PM: header, history ("From … to …") and both weeks' grids all followed, no ghost left behind. But the modal's own promise — _"a time that clashes or falls outside opening hours is refused"_ — was false, and the pane beside it made a different promise. Both now single-sourced and both true.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-08-22 | SC  | **Dates, four: which clock.** The machine is **America/Los_Angeles**, the same zone as the salon — the one condition under which a zone bug is invisible, so it is stated. Asking where the salon's zone came from answered it: `tenant_businesses` has **no row**. Nia has never told Piggles where she is; her staff are on Pacific because her laptop is ([151](issues/151-the-salon-had-never-said-what-clock-it-runs-on.md), fixed). The blueprint stamped `UTC` on its four stylists and on all 97 bundles' premises. What the machine could not test was tested in code instead: the clocks going back is handled on the real path (9 AM Oct 24 stores 16:00Z, 9 AM Nov 7 stores 17:00Z, and 8:45 on Nov 7 is refused).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-22 | SC  | **Brandon, from the screen: a half-hour booking sliced its own words.** Her two Saturday dry cuts drew three lines into thirty-two pixels, so the service and the client came out cut through the middle of the letters ([148](issues/148-a-half-hour-booking-sliced-its-own-words-in-half.md), fixed). A block is now told how tall it is and says what fits: three lines from an hour up, one row at a half hour or less, running out of width with an ellipsis instead of being sliced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Act 5 — what the live booking page actually offers

Driven as a client on the published site, against the hours set in act 3 (Nia
Tue–Sat 09:00–13:00 + 13:45–17:30; Dara Wed/Fri/Sat 10:00–18:00, no lunch; whole
salon closed 1–8 Aug 2027). **Every one of these is correct.**

| Service · day                                 | Offered                            | Why that is right                                                        |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| **Full head highlights** (150 min, Nia) · Sat | 9:00–10:30, then **1:45–3:00**     | Last start that fits before lunch is 10:30; after it, 13:45 → 15:00      |
| Full head highlights · the 13:00 lunch        | **nothing**                        | Her break, and only she does colour                                      |
| **Barbering, skin fade** (30 min, Dara) · Sat | 10:00–5:30                         | Dara's whole day, last start 17:30                                       |
| Barbering, skin fade · **Tue**                | **nothing**, with a real sentence  | Dara is not in, and Nia cannot do a fade — [088] proving itself publicly |
| **Cut and finish** (60 min, either) · Sat     | 9:00–5:00, **including 1:00–1:30** | Correct: Dara covers the lunch hour and works till 18:00                 |
| Cut and finish · **Mon**                      | **nothing**                        | Closed Mondays                                                           |
| Cut and finish · **Wed 4 Aug 2027**           | **nothing**                        | Inside the summer closure                                                |
| Cut and finish · **Wed 11 Aug 2027**          | 9:00–5:00                          | The closure ends; not simply "empty that far out"                        |

**One correction to this script.** The standing check says "try to book 13:15,
it must be impossible". That is only true of a service **Nia alone** performs.
Dara takes no lunch, so 13:15 is genuinely bookable for anything either of them
can do, and offering it is right. Act 6 tests 13:15 against **Full head
highlights**, not against a cut.

The empty state is a real sentence rather than a blank: "No open times that day —
try another date, or join the waitlist and we'll let you know the moment a spot
opens."

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Nia's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Cancel the wrong client's appointment. Delete "Cut and finish"
while Thursday's booking still points at it. Book the same 14:00 slot from two
windows at once. **Done 2026-08-22 — all three, and the shape of every finding
was the same: the records were right and the sentences were wrong.**

A cancellation that could not name who it was about. A removal that undercounted
what it touched and called itself permanent when the row was only stamped. A race
that came out with exactly one booking and told the winner it had failed. Six
defects ([142]–[147]), all fixed and re-proved as Nia, and not one of them
produced a wrong record.

**Thirteen probe bookings were left in the diary** by the third move, mostly
under walk-in names on 27, 28 and 31 August. They are real bookings taken through
the real screen, so they stay (the run rule keeps what it creates), but a later
act reading the diary should know what they are.

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

| Standing check               | Result                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong moves                  | **Done, all three.** Cancelled the wrong client ([142]), removed a service seven bookings point at ([145]), raced one chair from many windows ([146], [147]). Six defects, all fixed and re-proved. **No data was ever wrong** — only what she was told.                                                    |
| Reload · deep link · restore | Done — run early, in the run log above                                                                                                                                                                                                                                                                      |
| Dates                        | **Done, all four.** Booked into her lunch ([149]), refused by her holiday with the wrong sentence ([150]), a clean week-crossing reschedule, and the machine's zone stated — which is what surfaced [151]. Four defects; three were the software describing itself falsely, one was it not checking at all. |
| Money edge                   | Done — in the run log above                                                                                                                                                                                                                                                                                 |
| Buyer's side                 | —                                                                                                                                                                                                                                                                                                           |
| Someone else's business      | Done — deep-linked one of Marisol's orders; nothing came back                                                                                                                                                                                                                                               |
| One job without a mouse      | —                                                                                                                                                                                                                                                                                                           |
| Time to live site            | —                                                                                                                                                                                                                                                                                                           |

[142]: issues/142-the-question-before-cancelling-an-appointment-never-says-whose.md
[145]: issues/145-removing-a-service-was-called-permanent-and-never-was.md
[146]: issues/146-a-slot-that-was-taken-told-her-somebody-had-edited-her-booking.md
[147]: issues/147-two-people-booking-one-chair-at-once-told-the-winner-it-had-failed.md
[149]: issues/149-the-lunch-break-she-set-was-only-enforced-on-her-website.md
[150]: issues/150-a-week-the-salon-was-shut-was-reported-as-somebody-elses-booking.md
[151]: issues/151-the-salon-had-never-said-what-clock-it-runs-on.md

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

| #                                                                                                         | Severity | What (in her words)                                                                  | Fixed | Confirmed by                                                                 |
| --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------- |
| [081](issues/081-her-salon-opens-at-nine-and-the-diary-showed-appointments-at-three-in-the-morning.md)    | major    | Her salon opens at nine, and the diary showed appointments at three in the morning   | yes   | New-person form opens on Los Angeles; both her people corrected              |
| [082](issues/082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md)                            | major    | A link to any screen in the console opened nothing at all                            | yes   | Five addresses across three apps now open and take focus                     |
| [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md)                               | minor    | A link to an order this salon cannot see spun for ever                               | no    | RLS refused it (404, no leak); the panel's dead end is scoped                |
| [084](issues/084-she-typed-her-whole-week-in-and-the-diary-looked-exactly-the-same.md)                    | major    | She typed her whole week in, and the diary looked exactly the same                   | yes   | Monday and Sunday shaded shut, the 1:00 lunch band across five days          |
| [085](issues/085-her-price-list-had-two-of-everything-at-two-different-prices.md)                         | major    | Her price list had two of everything, at two different prices                        | no    | Two seeders collide; both are shared with sparx — scoped                     |
| [086](issues/086-she-priced-a-cut-at-sixty-five-and-the-booking-page-said-six-thousand-five-hundred.md)   | blocker  | She priced a cut at sixty-five, and it came out six thousand five hundred            | yes   | `65,00` settles to `65.00`; ten money fields swept                           |
| [087](issues/087-the-screen-kept-telling-her-the-change-was-not-saved-after-it-saved.md)                  | major    | The screen kept telling her the change was not saved, after it had saved             | yes   | Dot cleared, Save greyed, warning gone                                       |
| [088](issues/088-she-could-not-say-that-only-dara-does-the-fades.md)                                      | major    | She could not say that only Dara does the fades                                      | yes   | "Only Dara Bell can take this booking." said on screen before saving         |
| [089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)                     | major    | Her salon's web address is "swift-horizon-4860", and it goes nowhere                 | part  | Cause fixed; her own row waits on the pipeline migration                     |
| [090](issues/090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md)                      | major    | Piggles offered to sell her a domain, from another company's shop                    | yes   | Toolbar reads Connect a domain only; no shop.sparx.works in the pane         |
| [091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)                       | major    | Her salon's homepage is selling sparx-branded mugs and t-shirts                      | part  | Cause fixed; proving it needs a fresh signup after a deploy                  |
| [092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md)       | major    | With nothing to sell, her site advertised "Product name", $0.00, Sold out            | no    | Blocked on a decision: hide the section, or a real empty state               |
| [093](issues/093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md)   | major    | Her contact page showed a map of another salon's street, and no screen could move it | yes   | Address field drawn; her map now points at Bower Street                      |
| [094](issues/094-the-blocks-for-how-to-reach-us-shipped-a-strangers-phone-number.md)                      | major    | The blocks for "how to reach us" shipped a stranger's phone number                   | yes   | Both blocks insert her real phone, email and address, untyped                |
| [095](issues/095-the-booking-list-put-a-second-page-title-on-her-homepage-in-words-she-cannot-change.md)  | major    | The booking list put a second page title on her homepage, in words she cannot change | no    | Blocked on a decision: whose heading a pinned core's is                      |
| [096](issues/096-her-booking-page-went-to-search-as-the-platforms-sentence-not-hers.md)                   | major    | Her booking page went to search as the platform's sentence, not hers                 | yes   | Live `<title>` and description are the ones she typed                        |
| [097](issues/097-her-bookings-said-two-places-were-in-use-by-people-she-had-deleted.md)                   | major    | Her Bookings said two places were in use by people she had deleted                   | yes   | Both read "Nothing filed here yet"; the delete warning is honest             |
| [098](issues/098-a-place-in-her-bookings-was-called-maison-elan.md)                                       | major    | A place in her Bookings was called "Maison Élan"                                     | no    | Hers removed; blocked on a decision about blueprint-installed rows           |
| [099](issues/099-the-layers-list-called-her-map-site-map.md)                                              | minor    | The Layers list called her map "site.map"                                            | no    | Blocked on scope: needs a `describeNode` hook on the shared engine           |
| [100](issues/100-the-check-before-publishing-said-1-things-to-look-at.md)                                 | minor    | The check before publishing said "1 things to look at"                               | yes   | Reads "1 thing" and "Nothing to fix across 4 pages"                          |
| [101](issues/101-her-salons-website-put-another-companys-logo-in-the-browser-tab.md)                      | major    | Her salon's website put another company's logo in the browser tab                    | yes   | No vendor mark on any page; her own mark is live                             |
| [102](issues/102-picking-a-photo-wrote-the-file-name-where-the-description-should-go.md)                  | major    | Picking a photo wrote the file name where the description should go                  | yes   | The library's own words fill the field, untyped                              |
| [103](issues/103-a-hair-salon-was-told-it-had-to-publish-a-returns-policy.md)                             | major    | A hair salon was told it had to publish a returns policy                             | yes   | Reads "0 of 3"; Return Policy is optional; all three published               |
| [104](issues/104-a-two-chair-salon-could-not-let-a-client-choose-their-stylist.md)                        | major    | A two-chair salon could not let a client choose their stylist                        | yes   | "Choose your team member — Any available · Dara Bell · Nia Okafor" is live   |
| [105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)            | blocker  | A client booked her most expensive appointment and was told it had failed            | yes   | A deposit service books cleanly and says "You're booked"                     |
| [106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md)                      | blocker  | A client could book inside her lunch, and on the day she is shut                     | yes   | Both refused 409; a genuinely open time still books                          |
| [107](issues/107-the-booking-confirmation-does-not-say-where-the-salon-is-or-who-she-booked.md)           | major    | The booking confirmation does not say where the salon is, or who she booked          | yes   | "with Nia Okafor", the address beneath, and the same in the `.ics` LOCATION  |
| [108](issues/108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)              | blocker  | Every booking made from her website lands in her diary seven hours late              | yes   | A 3:00 PM booking now reads 3:00 PM in her diary; old rows backfilled        |
| [109](issues/109-the-booking-page-shows-its-times-in-the-visitors-timezone-not-the-salons.md)             | major    | The booking page shows its times in the visitor's timezone, not the salon's          | yes   | An out-of-town reader sees the salon's hours + "our local time (PDT)"        |
| [110](issues/110-her-diary-follows-the-laptops-clock-so-a-thursday-appointment-can-land-on-friday.md)     | major    | Her diary follows the laptop's clock, so a Thursday appointment can land on Friday   | no    | Recommended fix written; needs the multi-zone case decided                   |
| [111](issues/111-the-appointment-does-not-know-who-it-is-for-so-an-allergy-sits-four-screens-away.md)     | major    | The appointment does not know who it is for, so an allergy sits four screens away    | yes   | The allergy is on the appointment; their record is one click away            |
| [112](issues/112-she-marked-a-no-show-and-was-never-told-whether-anyone-had-been-charged.md)              | major    | She marked a no-show and was never told whether anyone had been charged              | yes   | Both dialogs and the booking say what happens to the money                   |
| [113](issues/113-a-clients-record-in-a-booking-business-has-no-appointments-on-it.md)                     | major    | A client's record, in a booking business, has no appointments on it                  | no    | Filed; the other half of 111                                                 |
| [114](issues/114-she-cannot-write-down-money-she-took-in-the-room.md)                                     | blocker  | She cannot write down money she took in the room                                     | yes   | Three real sales taken at the counter; O-000003 opens Paid · Collected       |
| [115](issues/115-she-typed-600-into-the-invoice-and-it-billed-dara-nothing.md)                            | major    | She typed 600 into the invoice and it billed Dara nothing                            | yes   | Both boxes say what they are for; the hidden one names its purpose           |
| [116](issues/116-a-sale-taken-at-the-counter-waits-forever-to-be-sent-to-a-warehouse.md)                  | major    | A sale taken at the counter waits forever to be sent to a warehouse                  | yes   | O-000003 opens Paid · Collected, no warehouse walk offered                   |
| [117](issues/117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md)                  | blocker  | The money she took over the counter never reached her money screens                  | yes   | Rob’s $40 reaches What you kept after a rebuild; O-000001/2 left as evidence |
| [118](issues/118-there-was-no-way-to-say-a-card-was-taken-on-her-own-machine.md)                          | major    | There was no way to say a card was taken on her own machine                          | yes   | Card is offered, and refunding one no longer promises a gateway credit       |
| [119](issues/119-the-search-only-finds-you-what-you-already-know-the-name-of.md)                          | minor    | The search only finds you what you already know the name of                          | yes   | “reminder” finds both screens; “take a payment” and “sale” rank right        |
| [120](issues/120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)                         | major    | Her two stylists are staff in Bookings and nobody in My Team                         | no    | Blocked on a decision — one roster, a bridge, or an honest sentence          |
| [121](issues/121-rent-is-due-every-month-and-the-invoice-can-only-be-raised-once.md)                      | minor    | Rent is due every month and the invoice can only be raised once                      | no    | Blocked on scope — a repeating charge is a feature, not a repair             |
| [122](issues/122-every-email-her-salon-sends-is-signed-with-another-companys-name.md)                     | blocker  | Every email her salon sends is signed with another company’s name                    | yes   | Footer reads Halo & Hem, then “Sent with Piggles”                            |
| [123](issues/123-editing-one-paragraph-of-an-email-silently-overwrites-a-different-one.md)                | blocker  | Editing one paragraph of an email silently overwrites a different one                | yes   | Each of four blocks rewritten in turn; nothing else moved                    |
| [124](issues/124-checking-what-an-email-says-shows-the-labels-and-none-of-the-facts.md)                   | major    | Checking what an email says shows the labels and none of the facts                   | yes   | Preview reads Consultation · Sat, Jun 14 · 45 min · Main room · Sam          |
| [125](issues/125-her-emails-sign-off-with-the-products-name-instead-of-her-salons.md)                     | major    | Her emails sign off with the product’s name instead of her salon’s                   | yes   | Sign-off reads Halo & Hem, linked to her site                                |
| [126](issues/126-seven-of-her-ten-services-remind-nobody-and-the-switch-is-labelled-as-something-else.md) | blocker  | Seven of her ten services remind nobody, and the switch says deposits                | yes   | All ten live services carry a rule set; the empty option names the cost      |
| [127](issues/127-a-booking-never-says-whether-anyone-is-being-reminded.md)                                | major    | A booking never says whether anyone is being reminded                                | yes   | Priyanka’s colour lists three reminders To go; Margot’s cut says none is     |
| [128](issues/128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md)             | major    | The check that was meant to catch the brand leak does not look for it                | no    | Open — check:boundaries has no string rule at all                            |
| [129](issues/129-the-email-editor-draws-her-button-black-and-the-preview-draws-it-brown.md)               | minor    | The email editor draws her button black and the preview draws it brown               | no    | Open — a canvas-theming question, not chased in act 9                        |
| [130](issues/130-every-button-in-three-apps-is-see-through-in-the-dark.md)                                | blocker  | Every button in three of her apps is see-through in the dark                         | yes   | A colour token carried an alpha byte; guard added, proved red                |
| [131](issues/131-the-console-s-grey-is-invisible-on-the-dark-canvas.md)                                   | blocker  | Every grey control is invisible on the dark canvas                                   | yes   | 1.09:1 across 416 controls; chrome and neutral split into two tokens         |
| [132](issues/132-the-diary-on-a-phone-never-says-what-day-it-is.md)                                       | blocker  | The diary on a phone never says what day it is                                       | yes   | Date shown, today scrolled into view, two chairs fit, gutter sticky          |
| [133](issues/133-the-week-s-date-range-loses-its-first-month.md)                                          | major    | The week heading reads "17-Aug 23, 2026"                                             | yes   | A hand-assembled range in the wrong locale; now formatRange                  |
| [134](issues/134-a-walk-in-has-no-name-and-can-never-be-given-one.md)                                     | blocker  | A walk-in has no name, and can never be given one                                    | yes   | A name field where the copy already promised one                             |
| [135](issues/135-a-booking-calls-its-customer-a-customer.md)                                              | major    | A booking calls its customer "A customer"                                            | yes   | The name was one read away; the diary named the chair instead                |
| [136](issues/136-a-closed-sunday-reads-as-an-empty-one.md)                                                | major    | A closed Sunday reads as an empty one                                                | yes   | Issue 084 reached only the view showing one person                           |
| [137](issues/137-the-search-box-finds-three-screens-and-says-nothing-about-rob.md)                        | major    | The search box finds three screens and says nothing about Rob                        | part  | Silence fixed; the empty index is open and not diagnosed                     |
| [138](issues/138-eighty-seven-lists-each-wrote-their-own-instructions-for-a-keyboard.md)                  | major    | 87 lists each told her phone about the shift key                                     | yes   | One component; 86 call sites migrated, two honest exceptions                 |
| [139](issues/139-a-customer-s-record-has-ten-tabs-and-none-is-their-appointments.md)                      | major    | A customer's record has ten tabs and none is their appointments                      | yes   | A Bookings tab; the endpoint already took the filter                         |
| [140](issues/140-the-bookings-list-on-a-phone-spends-five-lines-on-a-date.md)                             | major    | The bookings list on a phone spends five lines on a date                             | yes   | State folds into What below @md; five rows on screen, not two                |
| [141](issues/141-a-narrow-toolbar-s-menu-loses-the-app-it-belongs-to.md)                                  | minor    | A narrow toolbar's menu loses the app it belongs to                                  | yes   | An unlabelled glyph, a stray ml-auto, and a hue lost in a portal             |
| [142](issues/142-the-question-before-cancelling-an-appointment-never-says-whose.md)                       | blocker  | The question before cancelling an appointment never says whose                       | yes   | The person is the title; both questions in one file, shared with the diary   |
| [143](issues/143-turning-off-tell-the-customer-on-a-cancellation-still-told-them.md)                      | major    | Turning off "tell the customer" on a cancellation still told them                    | yes   | A documented input that was parsed and ignored                               |
| [144](issues/144-the-console-greets-the-owner-of-the-business-as-a-team-member.md)                        | major    | The console greets the owner of the business as a team member                        | yes   | A default branch answering for an unloaded viewer                            |
| [145](issues/145-removing-a-service-was-called-permanent-and-never-was.md)                                | major    | Removing a service was called permanent, and never was                               | yes   | Put it back, and a confirm that counts what it touches                       |
| [146](issues/146-a-slot-that-was-taken-told-her-somebody-had-edited-her-booking.md)                       | major    | A slot that was taken told her somebody had edited her booking                       | yes   | One 409, three causes, three remedies                                        |
| [147](issues/147-two-people-booking-one-chair-at-once-told-the-winner-it-had-failed.md)                   | major    | Two people booking one chair at once told the winner it had failed                   | yes   | A deadlock is not an answer, so run it again                                 |
| [148](issues/148-a-half-hour-booking-sliced-its-own-words-in-half.md)                                     | major    | A half-hour booking sliced its own words in half                                     | yes   | A block is told its height and says what fits                                |
| [149](issues/149-the-lunch-break-she-set-was-only-enforced-on-her-website.md)                             | blocker  | The lunch break she set was only enforced on her website                             | yes   | The write path asks the question the read path asks                          |
| [150](issues/150-a-week-the-salon-was-shut-was-reported-as-somebody-elses-booking.md)                     | major    | A week the salon was shut was reported as somebody else's booking                    | yes   | The reason survives to the message, and names her own closure                |
| [151](issues/151-the-salon-had-never-said-what-clock-it-runs-on.md)                                       | major    | The salon had never said what clock it runs on                                       | part  | Guess made visible, blueprint stops inventing; existing rows not backfilled  |
