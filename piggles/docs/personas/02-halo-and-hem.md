# P02 — Nia Okafor · Halo & Hem

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-08-22

**Status:** in progress
**Run:** started 2026-08-21. **Acts 1–5 done; 6–10 outstanding.**
Machine clock is **PDT (UTC-7)**. Three standing checks are done and recorded
below (reload · deep link · restore, someone else's business, money at the
edges); wrong moves, dates, the buyer's side and one job without a mouse are not.

**Act 5 is done.** Home, About, Contact and Book are written in her voice and
published, the header and footer are hers, and the site's identity — name,
tagline, phone, email, address, Instagram — is filled in and flowing through to
every page that shows it. The homepage's price list is the **live** booking
services block, so it can never drift from what she charges. Eight issues came
out of it ([093](issues/093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md)–[100](issues/100-the-check-before-publishing-said-1-things-to-look-at.md)),
six of them fixed and re-proved on the screen that found them.

**Act 6 is part-done.** Four real bookings exist, made through the public form as
four different clients, and the availability engine is proved right to the minute
from the customer's side. What is NOT done: the confirmation still does not say
**where** the salon is or **who** the client picked, the consultation rule before
colour is words on a page and nothing enforces it, and a deposit cannot be paid at
all because every new tenant is provisioned onto the `manual` payment gateway
([105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)).

**Three probe bookings need clearing in act 7** — `Refusal Probe`, at Thursday
13:15, Thursday 15:00 and Monday 10:00. The first and last were created by the
defect in [106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md)
before it was fixed and are exactly the impossible appointments it describes;
cancelling them is act 7's cancel step doing real work.

**Next:** finish act 6 — the confirmation's missing where/who
([107](issues/107-the-booking-confirmation-does-not-say-where-the-salon-is-or-who-she-booked.md)) —
then act 7 behind the chair, and 8 to 10.

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

### The diary as it stands, for act 7

| When (PDT)       | Who                   | What                 | With |
| ---------------- | --------------------- | -------------------- | ---- |
| Thu 27 Aug 13:15 | **Refusal Probe**     | Cut and finish       | Dara |
| Thu 27 Aug 14:00 | Margot Lindqvist      | Cut and finish       | Nia  |
| Thu 27 Aug 15:00 | **Refusal Probe**     | Cut and finish       | Nia  |
| Fri 28 Aug 09:00 | Priyanka Deshmukh     | Full head highlights | Nia  |
| Fri 28 Aug 10:30 | Rob Alvarez           | Barbering, skin fade | Dara |
| Mon 31 Aug 10:00 | **Refusal Probe**     | Cut and finish       | Nia  |
| Sat 29 Aug 11:00 | Ekaterina Volkonskaya | Restyle, long hair   | Nia  |

The three `Refusal Probe` rows are the ones to cancel. Note the Thursday 13:15 one
was assigned to **Dara on a day she does not work** — further proof of
[106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md).

Act 7 also needs a **past** booking for Margot to mark as a no-show; there is none
yet, so one has to be made first (the console can book in the past; the public
endpoint cannot).

**The site is built.** Seven pages live — Home, Book, The team, Our work, About,
Contact, and Deposits, changes and no-shows — plus Privacy, Terms and Cookie
published with their footer links resolving, a real 404, and her own mark in the
tab. The one page in the persona's inventory with no page of its own is **Services
& prices**: `/book` is that page, and it is better than a separate one because it
renders her ten services live rather than as a hand-typed copy. **Find us** is
`/contact`, which carries the address, the hours, the parking, the map and the
form.

**Still open on the site:** photographs are the starter pack's stock, not
photographs of this salon — there are no real ones to be had for a business that
does not exist, and the alt text on every one of them is now hers rather than a
file name ([102](issues/102-picking-a-photo-wrote-the-file-name-where-the-description-should-go.md)).
Responsive at 390px and both themes are **not checked yet**.

**Trade:** Beauty & salon (`salon`) · **Rail groups:** people · web · money

## Account

| Field         | Value                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email         | `p02.nia@piggles.test`                                                                                                                                                                                                                     |
| Tenant id     | `dfdffe98-154f-473b-946d-6e60b03aa2c5`                                                                                                                                                                                                     |
| Site id       | `6282b2b1-a7b0-4ef2-90eb-e3dbfe1e729d` (slug `primary`)                                                                                                                                                                                    |
| Subdomain     | `halo-and-hem.piggles.site`                                                                                                                                                                                                                |
| Published URL | `swift-horizon-4860.piggles.site` — stored, but dead; her site resolves at `halo-and-hem.piggles.site` ([089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)). Dev: `localhost:3004/?tenant=halo-and-hem` |

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

**Where she is, and how she is reached.** Not given when this persona was written,
and RULE #8 wants the same name, address and phone in the footer, on Contact and
in the structured data — so these were settled in act 5 and are now the fixture.
Reserved-for-fiction phone range, deliberately.

| Fact    | Value                                           |
| ------- | ----------------------------------------------- |
| Address | 214 Bower Street, Suite B, Sacramento, CA 95811 |
| Phone   | (916) 555-0146                                  |
| Email   | hello@haloandhem.com                            |
| Social  | instagram.com/haloandhemsalon                   |
| Tagline | Two chairs, no rush.                            |

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
| 2026-08-21 | —   | Standing check **someone else's business**: deep-linked one of Marisol's orders (`ee8bd403…`, Thistle & Rye). `GET /v1/orders/…` → **404**, nothing leaked. The panel then spun for ever instead of saying so — [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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

| #                                                                                                        | Severity | What (in her words)                                                                  | Fixed | Confirmed by                                                                |
| -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------- |
| [081](issues/081-her-salon-opens-at-nine-and-the-diary-showed-appointments-at-three-in-the-morning.md)   | major    | Her salon opens at nine, and the diary showed appointments at three in the morning   | yes   | New-person form opens on Los Angeles; both her people corrected             |
| [082](issues/082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md)                           | major    | A link to any screen in the console opened nothing at all                            | yes   | Five addresses across three apps now open and take focus                    |
| [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md)                              | minor    | A link to an order this salon cannot see spun for ever                               | no    | RLS refused it (404, no leak); the panel's dead end is scoped               |
| [084](issues/084-she-typed-her-whole-week-in-and-the-diary-looked-exactly-the-same.md)                   | major    | She typed her whole week in, and the diary looked exactly the same                   | yes   | Monday and Sunday shaded shut, the 1:00 lunch band across five days         |
| [085](issues/085-her-price-list-had-two-of-everything-at-two-different-prices.md)                        | major    | Her price list had two of everything, at two different prices                        | no    | Two seeders collide; both are shared with sparx — scoped                    |
| [086](issues/086-she-priced-a-cut-at-sixty-five-and-the-booking-page-said-six-thousand-five-hundred.md)  | blocker  | She priced a cut at sixty-five, and it came out six thousand five hundred            | yes   | `65,00` settles to `65.00`; ten money fields swept                          |
| [087](issues/087-the-screen-kept-telling-her-the-change-was-not-saved-after-it-saved.md)                 | major    | The screen kept telling her the change was not saved, after it had saved             | yes   | Dot cleared, Save greyed, warning gone                                      |
| [088](issues/088-she-could-not-say-that-only-dara-does-the-fades.md)                                     | major    | She could not say that only Dara does the fades                                      | yes   | "Only Dara Bell can take this booking." said on screen before saving        |
| [089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)                    | major    | Her salon's web address is "swift-horizon-4860", and it goes nowhere                 | part  | Cause fixed; her own row waits on the pipeline migration                    |
| [090](issues/090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md)                     | major    | Piggles offered to sell her a domain, from another company's shop                    | yes   | Toolbar reads Connect a domain only; no shop.sparx.works in the pane        |
| [091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)                      | major    | Her salon's homepage is selling sparx-branded mugs and t-shirts                      | part  | Cause fixed; proving it needs a fresh signup after a deploy                 |
| [092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md)      | major    | With nothing to sell, her site advertised "Product name", $0.00, Sold out            | no    | Blocked on a decision: hide the section, or a real empty state              |
| [093](issues/093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md)  | major    | Her contact page showed a map of another salon's street, and no screen could move it | yes   | Address field drawn; her map now points at Bower Street                     |
| [094](issues/094-the-blocks-for-how-to-reach-us-shipped-a-strangers-phone-number.md)                     | major    | The blocks for "how to reach us" shipped a stranger's phone number                   | yes   | Both blocks insert her real phone, email and address, untyped               |
| [095](issues/095-the-booking-list-put-a-second-page-title-on-her-homepage-in-words-she-cannot-change.md) | major    | The booking list put a second page title on her homepage, in words she cannot change | no    | Blocked on a decision: whose heading a pinned core's is                     |
| [096](issues/096-her-booking-page-went-to-search-as-the-platforms-sentence-not-hers.md)                  | major    | Her booking page went to search as the platform's sentence, not hers                 | yes   | Live `<title>` and description are the ones she typed                       |
| [097](issues/097-her-bookings-said-two-places-were-in-use-by-people-she-had-deleted.md)                  | major    | Her Bookings said two places were in use by people she had deleted                   | yes   | Both read "Nothing filed here yet"; the delete warning is honest            |
| [098](issues/098-a-place-in-her-bookings-was-called-maison-elan.md)                                      | major    | A place in her Bookings was called "Maison Élan"                                     | no    | Hers removed; blocked on a decision about blueprint-installed rows          |
| [099](issues/099-the-layers-list-called-her-map-site-map.md)                                             | minor    | The Layers list called her map "site.map"                                            | no    | Blocked on scope: needs a `describeNode` hook on the shared engine          |
| [100](issues/100-the-check-before-publishing-said-1-things-to-look-at.md)                                | minor    | The check before publishing said "1 things to look at"                               | yes   | Reads "1 thing" and "Nothing to fix across 4 pages"                         |
| [101](issues/101-her-salons-website-put-another-companys-logo-in-the-browser-tab.md)                     | major    | Her salon's website put another company's logo in the browser tab                    | yes   | No vendor mark on any page; her own mark is live                            |
| [102](issues/102-picking-a-photo-wrote-the-file-name-where-the-description-should-go.md)                 | major    | Picking a photo wrote the file name where the description should go                  | yes   | The library's own words fill the field, untyped                             |
| [103](issues/103-a-hair-salon-was-told-it-had-to-publish-a-returns-policy.md)                            | major    | A hair salon was told it had to publish a returns policy                             | yes   | Reads "0 of 3"; Return Policy is optional; all three published              |
| [104](issues/104-a-two-chair-salon-could-not-let-a-client-choose-their-stylist.md)                       | major    | A two-chair salon could not let a client choose their stylist                        | yes   | "Choose your team member — Any available · Dara Bell · Nia Okafor" is live  |
| [105](issues/105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)           | blocker  | A client booked her most expensive appointment and was told it had failed            | yes   | A deposit service books cleanly and says "You're booked"                    |
| [106](issues/106-a-client-could-book-inside-her-lunch-and-on-the-day-she-is-shut.md)                     | blocker  | A client could book inside her lunch, and on the day she is shut                     | yes   | Both refused 409; a genuinely open time still books                         |
| [107](issues/107-the-booking-confirmation-does-not-say-where-the-salon-is-or-who-she-booked.md)          | major    | The booking confirmation does not say where the salon is, or who she booked          | no    | Blocked on scope: one widget, its `.ics` and its email must change together |
