# 098 — A place in her Bookings was called "Maison Élan"

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › Bookings › Places
**Filed:** 2026-08-22
**Fixed:** 2026-08-24 — installing a design now offers the choice
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Nia's Bookings module contains two places. One is hers. The other is called
**Maison Élan** — the demo salon the `sparx-salon-editorial` starter was written
around, created 0.4 seconds after her account existed, before she had answered a
single question about her own business.

```
Main location  2026-08-21 22:24:46.809+00
Maison Élan    2026-08-21 22:24:47.182+00
```

It is not a draft, a preview or a sample. It is a live row in the table her
booking page reads, it was marked **In use**, and it carried seven of the demo
services and three of the demo staff.

## Why this is different from placeholder page copy

The platform has a documented position on demo content, and it is a good one. It
lives in
[wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.test.ts](../../../../wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.test.ts):

> Placeholder prose on a page is fine — "Maeve began with two chairs" is visibly
> someone else's story, it sits on the screen the tenant opens first, and
> rewriting it IS the act of making the site theirs. An email is the opposite on
> every count: it lives in a surface they may never open, it reads as finished…

There is a mechanical guard enforcing exactly that for emails, keyed off each
blueprint's own `brand.businessName`, so a demo name can never reach a tenant's
mailing list.

**A scheduling location is on the email side of that line, not the page side**,
and nothing checks it:

| Test                                      | A page's prose | This location                                                  |
| ----------------------------------------- | -------------- | -------------------------------------------------------------- |
| Sits on the screen she opens first        | yes            | no — Bookings › Places, three levels in                        |
| Visibly somebody else's                   | yes            | no — it looks like a place she set up                          |
| Rewriting it is the act of making it hers | yes            | no — she has one salon and does not need a second place at all |
| Reaches a customer                        | when published | on any booking filed against it                                |

The reasoning that makes demo prose acceptable is the reasoning that makes this
unacceptable, and it was never applied here because the guard only ever looked at
emails.

## Why it matters

She has one salon. A second place, named after a business she has never heard of,
is not a starting point she edits — it is a row she has to work out the meaning of
before she can delete it. And until [097](097-her-bookings-said-two-places-were-in-use-by-people-she-had-deleted.md)
was fixed, the delete talked her out of it.

The blast radius is bigger than the name, too. Everything the blueprint installs
into Scheduling — resources, services, policies — is real operating data on day
one, and the whole set is somebody else's business until the owner clears it.

## How to reproduce

Every time, for any tenant whose starter site ships a booking flow.

1. Sign up, pick the salon look at onboarding.
2. `mypiggles` › Bookings › **Places**.

## Where it lives

The blueprint declares its own demo business, correctly:

```ts
brand: { businessName: 'Maison Élan', tagline: 'Considered hair, calmly done.' },
```

The installer renames the **site** with the tenant's name, so her header, footer
and wordmark all read Halo & Hem. It does not carry that rename into the rows it
writes, so the location — and the three stylists, and the seven services — keep
the names the pack was authored with.

## The fix

Not made, because it is a product decision with three defensible answers:

- **Name the location after the tenant.** The installer already knows the business
  name; a place created at install becomes "Halo & Hem" rather than "Maison Élan".
  Smallest change, and it makes the row read like something she set up.
- **Do not install a second place at all.** Provisioning already creates
  `Main location`; a blueprint attaching its services to that one instead leaves a
  tenant with exactly one place, which is what a one-salon business has.
  Cleanest, and it removes the row rather than renaming it.
- **Extend the email guard to operating data.** The mechanical check that already
  refuses `brand.businessName` in an email is extended to the rows a bundle
  installs — locations, resources, service names. Slowest, and the only one of the
  three that stops the next pack doing it again.

The second and third together are the honest fix. Renaming alone leaves three
stylists called Ava, Maya and Noor in her staff list.

## What Nia did

Removed **Maison Élan** from Places, renamed `Main location` to **Halo & Hem**,
set its timezone to Pacific and typed her real address into it. Recorded in act 5.

Two smaller things noticed on the same screen and not filed separately:

- **A new place defaults to `UTC`**, for a business whose owner has already told
  the product where she is. Hers said UTC until she changed it, and the field's own
  helper text says "this is what a customer is shown".
- **The latitude and longitude examples are `51.5072` / `-0.1276`** — central
  London, on a product priced in dollars.

## Decision — 2026-08-24, Brandon

**Seeding is on purpose, so the named place stays** — same answer as
[174](174-a-warehouse-in-ohio-she-never-opened.md), for the same reason: a
blueprint that installs nothing leaves a new business staring at an empty
console.

**But the owner should get a say.** Installing a blueprint should offer a choice
about whether its sample data comes with it, so somebody who already knows what
they are doing can take the structure without the furniture. That is a feature
rather than a repair, and it is filed as its own item.

## Rating effect

`Bookings › Places` is scored in [rating.md](../rating.md).

## What was built — 2026-08-24

Installing a design asks one question, and the answer is a fact about the install
rather than a fact about the request that made it.

### The line between structure and examples

A blueprint carries two different things, and the install now separates them:

| Kept, always                                      | A choice                                  |
| ------------------------------------------------- | ----------------------------------------- |
| The look, the theme, the brand identity           | The products                              |
| The pages and the site chrome                     | The articles, their bylines, their tags   |
| The categories and collections the pages point at | The premises, the staff, the service menu |
| The email designs                                 |                                           |
| The imagery                                       |                                           |

**Commerce is the only slice with a half on each side.** The categories and
collections are the shelves — the navigation points at them and the grids are
bound to them, so an empty "Colour" is a shelf waiting for her own work. The
products standing on those shelves are somebody else's stock.

**Scheduling has no structural half, which is why 098 was filed.** A booking
policy governing no service is a row with nothing behind it, so the whole slice
stands down. Bookings then opens on her own `Main location` and nothing else,
which is what a business that has not written its menu yet actually has.

**The media always installs**, whichever way the examples went. Those images are
the design's own — the hero photograph, the section backgrounds — and the pages
address them by id, so withholding them would put holes in the structure she DID
ask for. A few unused product photographs in her library is the far smaller cost.

### The answer has to outlive the install

This is the half that would have been easy to miss, and getting it wrong would
have handed back the furniture months later without anybody touching a button:

- **The backfill.** Turning a feature on after the install re-runs that feature's
  slice. Switching Bookings on in November is not a second chance to install
  Maison Élan, so `tenant_blueprint_installs.sample_data` is read there and an
  examples-only slice reports `examples-declined` rather than re-running.
- **The updater.** A newer version of a design adds artifacts, and "an artifact
  this version adds" was a clean route around the choice. The example kinds are
  filtered out of the incoming set, so an update brings the new pages and not the
  new products.
- **The baselines.** Filtered on both sides of the merge, so no baseline claims a
  product that was never written.

### On the screens

- **Designs › one design.** "What this adds to your site" is now two lists: what
  it brings, then "The examples it brings" with a sentence saying whose they are.
  A **Bring its examples** switch sits in "Add it to a site", on by default, and
  the confirm says which way it is going. Once installed the switch is gone and
  the status line states what happened: "Its examples came with it" / "Its
  examples were left out". The update prompt says the update leaves them out too.
- **Setup › Starting point.** The same switch under the chosen design, on by
  default. Changing the answer re-installs, because the answer is fixed at install
  time and a stale draft would make the new one meaningless.
- **The story flow keeps the examples.** Somebody describing their business in one
  sentence is asking to be shown; the choice belongs on the two paths where a
  person is deliberately picking a design.

### One thing the card was not saying

`blueprintContents` counted products, categories, collections, articles, pages and
emails, and said nothing at all about scheduling. So the biggest set of example
rows a booking design installs — a premises, its staff and its whole menu — was
the one thing the card never mentioned, which is precisely what somebody deciding
whether to take the examples needs to see. It now counts all three, and a test
asserts the count against the bundle rather than against zero.

### Where it lives

| File                                     | What changed                                           |
| ---------------------------------------- | ------------------------------------------------------ |
| `db/prisma/schema/56-blueprints.prisma`  | `sampleData Boolean @default(true)`                    |
| `…/20270415000000_a_design_can…/`        | the column, defaulting true so no row needs a backfill |
| `api-rest/lib/blueprint-baseline.ts`     | `EXAMPLE_ARTIFACT_KINDS` + the filter                  |
| `api-rest/lib/blueprint-installer.ts`    | `InstallOptions`, `SliceEnv.sampleData`, three gates   |
| `api-rest/lib/blueprint-backfill.ts`     | reads the stored answer; `examplesOnly` slices         |
| `api-rest/lib/blueprint-updater.ts`      | the incoming set is filtered too                       |
| `api-rest/routes/v1/blueprints/index.ts` | `sample_data` in and out                               |
| `api-rest/routes/v1/tenant.ts`           | the onboarding state remembers the answer              |
| `console › surfaces/builder/blueprint-*` | the choice, the two lists, the status sentence         |
| `console › onboarding/wizard/*`          | the same choice at setup                               |

Both `blueprints-data.ts` and `blueprint-detail.tsx` were over piggles RULE #0.5's
250 lines before this touched them, as were `lib/onboarding/api.ts` and
`wizard.tsx`; all four were split rather than grown.

## Nothing owed

The migration is applied, the client regenerated, and the walk-through is done —
recorded below.

## Confirmed on screen — 2026-08-24, as Devi

Juniper Row's baseline was the state this issue argues for: **one** booking place
("Main location"), zero services. Catering (Events & Weddings) was chosen because
it seeds the same shape Maison Élan did — a premises, its staff, its whole menu.

**The card now names the diary before it installs**, which it never did:

```
The examples it brings
7 example services
3 example team members
1 example place            ← the Maison Élan row, named in advance
```

with the sentence that says whose they are: "These are somebody else's: a shop's
stock, a salon's treatments, a writer's articles. They are there so every screen
has something real on it while you find your way around. You can leave them out
below."

**The switch reads its own consequence.** On: "Its example products, articles and
bookings come too, so there is something real on every screen to look at and
change." Off: "Its examples are left out, so nothing arrives that is not yours.
The pages and shelves come in empty, ready for your own." The confirm dialog
carries whichever sentence applies, so the choice is restated at the moment it
is committed.

**Installed with the examples off, and the diary stayed hers:**

```
scheduling_locations  → Main location          (unchanged, no second place)
scheduling_services   → 0
install row           → sample_data = f
counts                → pages 4, emails 2, assets 9,
                        products 0, content 0,
                        schedulingServices 0, schedulingResources 0
```

The structure arrived — four pages, two email designs, the imagery, the
saffronsage look. The furniture did not. **No Maison Élan.**

The answer is on the row as `sample_data = f`, which is what the backfill and the
updater read later, so switching Bookings on in November cannot hand back what she
declined. The two installs that predate this carry `sample_data = t`, which is the
behaviour they were made under.

Removed afterwards to leave her site as it was found; the tear-down was clean and
`Main location` survived it, which is the never-clear-a-location rule holding.
