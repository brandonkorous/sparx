# P02 — Nia Okafor · Halo & Hem

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-21

**Status:** in progress
**Run:** started 2026-08-21. **Acts 1–4 done; act 5 part-done; 6–10 outstanding.**
Machine clock is **PDT (UTC-7)**. Three standing checks are done and recorded
below (reload · deep link · restore, someone else's business, money at the
edges); wrong moves, dates, the buyer's side and one job without a mouse are not.

**Where act 5 stands.** The **booking page is live and correct** — `/book` on the
published site lists her ten services and its availability matches the hours set
in act 3 to the minute (proved below). What is NOT done is the rest of the site:
her homepage, About and Contact are still drafts, so the page a client actually
lands on is the starter, and it is wrong in three separate ways
([091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md),
[092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md),
and the blueprint's hardcoded price list).

**Next:** finish act 5 — write and publish Home, About and Contact in her voice,
with a Book call to action on the homepage, her real hours, address and phone,
and a footer that is not the starter's. Then act 6, as the client.

Three things already known about that work, so they do not have to be found again:

- **Her draft Home is a good salon page with the wrong numbers on it.** The
  blueprint's "The menu" block hardcodes four services as static text — `Cut &
finish $85`, `Balayage $240`, `Full colour $160`, `Blow-dry & style $50/45min`.
  Her real prices are $65 and $38, and she does not offer balayage or "full
  colour" at all (she deleted both in act 4). That block has to be replaced, not
  edited: `/book` renders her real services live, so the homepage holding a
  hand-typed copy of the same list guarantees drift. Check whether the Add
  palette offers a live services block before hand-writing one.
- **Site identity is empty** — phone, email and address are all still
  placeholders, and RULE #8 wants the same name/address/phone in the footer, on
  Contact, and in the structured data.
- **The footer is the starter's**: "Everything you publish and sell, in one
  place.", with Explore/Account columns naming Shop, Journal, Orders and Cart —
  none of which a salon that does not sell online has.

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

| Date       | Act | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | 1   | meetpiggles → Start free → signup → onboarding. Business `Halo & Hem`, trade **Beauty & salon**, ticked website · customers · invoices (NOT selling). Look shelf offered six: Universal Starter, **Salon (Editorial)** (chosen), Salon (Modern), Barbershop (Heritage), Barbershop (Modern), Nail Studio (Gallery). Installed `sparx-salon-editorial` 1.3.0 + base `sparx` 1.4.0. `settings.industry = 'salon'` confirmed. Slug came out readable — `halo-and-hem`, not a random pair.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-21 | 2   | **Nothing is locked.** Sell and Stock are both in her rail despite not ticking "I sell things", each one click, each fully populated (Sell: Orders 2, Products, Bundles, Discounts, Gift cards…; Stock: Locations, Shelves, Counts, Barcodes…). No upsell, no gate, no price anywhere. Only Partners, Automations and Connections sit outside the rail, reachable from All apps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-21 | 3   | Created **Nia Okafor** and **Dara Bell**. Set Nia Tue–Sat 09:00–13:00 + 13:45–17:30, Dara Wed/Fri/Sat 10:00–18:00, Mon and Sun closed, and one whole-business closure **1–8 Aug 2027** ("Salon closed, summer week", Everyone). Used 2027 because 1–8 Aug 2026 is already past. Two defects found and fixed: [081](issues/081-her-salon-opens-at-nine-and-the-diary-showed-appointments-at-three-in-the-morning.md) (everything defaulted to UTC — her 9am diary showed 3am colour appointments) and [084](issues/084-she-typed-her-whole-week-in-and-the-diary-looked-exactly-the-same.md) (the diary drew none of the hours she had just typed). The calendar now shows her real week.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-21 | —   | Standing check **reload · deep link · restore** run early, because act 3 needed it: [082](issues/082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md) — **every** link into the console opened nothing at all. Found, fixed, re-proved on five addresses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-21 | 4   | Found **18 services** where a two-chair salon should have none — two seeders both wrote a salon menu, with two prices for Balayage and two for a full head of colour ([085](issues/085-her-price-list-had-two-of-everything-at-two-different-prices.md)). Cleared the practice data (7 went), deleted the other 11 one at a time, and typed her ten. **Money edge on the way in:** `65,00` for a cut read back as **6500** — a blocker, swept across ten money fields ([086](issues/086-she-priced-a-cut-at-sixty-five-and-the-booking-page-said-six-thousand-five-hundred.md)). The service pane then insisted "Not saved" after saving ([087](issues/087-the-screen-kept-telling-her-the-change-was-not-saved-after-it-saved.md)), and there was no way at all to say only Dara does the fades ([088](issues/088-she-could-not-say-that-only-dara-does-the-fades.md)). All three fixed. Also deleted four staff she never hired that the sample clear left behind.                                                                                                                                                                                                                                                                        |
| 2026-08-21 | 5   | Published `/book`. **The booking page is right, and the availability engine is right to the minute** — see the table below. Then opened her own homepage as a client would and found it selling **six sparx-branded products** with prices ([091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)) — a hardcoded `GOLDEN_BLUEPRINT_KEY = 'sparx'` dresses every tenant of every brand, while `piggles-starter` (same six, named "Rowan") sat unused. Fixed by making the starter site a fact about the BRAND. Deleted her six; the empty grid then advertised **"Product name · $0.00 · Sold out"** ([092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md)). On the way in, her web address turned out to be `swift-horizon-4860.piggles.site` while the account app calls her `halo-and-hem.piggles.site` — two screens, two addresses, and the console's is the one that resolves to nothing ([089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)). And Domains offered to sell her a domain from **shop.sparx.works** ([090](issues/090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md)), now removed. |
| 2026-08-21 | —   | Standing check **someone else's business**: deep-linked one of Marisol's orders (`ee8bd403…`, Thistle & Rye). `GET /v1/orders/…` → **404**, nothing leaked. The panel then spun for ever instead of saying so — [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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

| #                                                                                                       | Severity | What (in her words)                                                                | Fixed | Confirmed by                                                         |
| ------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| [081](issues/081-her-salon-opens-at-nine-and-the-diary-showed-appointments-at-three-in-the-morning.md)  | major    | Her salon opens at nine, and the diary showed appointments at three in the morning | yes   | New-person form opens on Los Angeles; both her people corrected      |
| [082](issues/082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md)                          | major    | A link to any screen in the console opened nothing at all                          | yes   | Five addresses across three apps now open and take focus             |
| [083](issues/083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md)                             | minor    | A link to an order this salon cannot see spun for ever                             | no    | RLS refused it (404, no leak); the panel's dead end is scoped        |
| [084](issues/084-she-typed-her-whole-week-in-and-the-diary-looked-exactly-the-same.md)                  | major    | She typed her whole week in, and the diary looked exactly the same                 | yes   | Monday and Sunday shaded shut, the 1:00 lunch band across five days  |
| [085](issues/085-her-price-list-had-two-of-everything-at-two-different-prices.md)                       | major    | Her price list had two of everything, at two different prices                      | no    | Two seeders collide; both are shared with sparx — scoped             |
| [086](issues/086-she-priced-a-cut-at-sixty-five-and-the-booking-page-said-six-thousand-five-hundred.md) | blocker  | She priced a cut at sixty-five, and it came out six thousand five hundred          | yes   | `65,00` settles to `65.00`; ten money fields swept                   |
| [087](issues/087-the-screen-kept-telling-her-the-change-was-not-saved-after-it-saved.md)                | major    | The screen kept telling her the change was not saved, after it had saved           | yes   | Dot cleared, Save greyed, warning gone                               |
| [088](issues/088-she-could-not-say-that-only-dara-does-the-fades.md)                                    | major    | She could not say that only Dara does the fades                                    | yes   | "Only Dara Bell can take this booking." said on screen before saving |
| [089](issues/089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)                   | major    | Her salon's web address is "swift-horizon-4860", and it goes nowhere               | part  | Cause fixed; her own row waits on the pipeline migration             |
| [090](issues/090-piggles-offered-to-sell-her-a-domain-from-another-companys-shop.md)                    | major    | Piggles offered to sell her a domain, from another company's shop                  | yes   | Toolbar reads Connect a domain only; no shop.sparx.works in the pane |
| [091](issues/091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)                     | major    | Her salon's homepage is selling sparx-branded mugs and t-shirts                    | part  | Cause fixed; proving it needs a fresh signup after a deploy          |
| [092](issues/092-with-nothing-to-sell-her-site-advertised-a-product-called-product-name-at-0-00.md)     | major    | With nothing to sell, her site advertised "Product name", $0.00, Sold out          | no    | Blocked on a decision: hide the section, or a real empty state       |
