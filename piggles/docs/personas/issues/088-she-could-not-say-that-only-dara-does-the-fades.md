# 088 — She could not say that only Dara does the fades

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 4
**Surface:** mypiggles › Bookings › Services › Who or what it needs
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Two chairs, two people, and they do different work. Nia does color; Dara does
the barbering. Act 4's whole point is saying so.

On **Barbering, skin fade** she opened **Who or what it needs**, pressed **Add
something it needs**, and got one row:

| What it is | Kind     | How many |
| ---------- | -------- | -------- |
| `Stylist`  | A person | 1        |

She typed `barbering` — the same word she had already put in Dara's own **Skills
or features** — and saved.

**It does nothing.** Read back from the database:

```json
{ "kind": "staff", "role": "barbering", "count": 1, "skillTags": [] }
```

The engine filters candidates on `skillTags`, and only when that list is not
empty:

```ts
...(req.skillTags?.length ? { skillTags: { hasEvery: req.skillTags } } : {})
```

`role` is a grouping label and nothing else. With no skills on the requirement,
**every member of staff qualifies** — so a client booking a skin fade can be
given Nia, who does not do them, and a full head of highlights can be given
Dara, who does not do those either.

## What should have happened

The row says "What it is" next to a person, and the person's own record has a
field called "Skills or features" with `barbering` in it. Typing the same word in
both places should connect them. It is the only mechanism on the screen that
looks like it would, and it is not wired to anything.

## How to reproduce

Every time.

1. Bookings › People and equipment › a person › **Skills or features**: type
   `barbering`. Save.
2. Bookings › Services › a service › **Who or what it needs** › **Add something
   it needs** › **What it is**: type `barbering`. Save.
3. Read the service back, or look at who the booking page offers.

Anyone can be booked for it.

## Why it matters

This is the single thing P02 exists to test — "a service only one person
performs" — and there is no way to express it from the console.

The failure is silent and lands on the customer: somebody books a skin fade,
turns up, and the person at the chair does not do skin fades. Nia finds out at
the chair, in front of the client.

It also makes the deposit rules and the consultation rule less useful than they
look, because none of them can be tied to who is actually able to do the work.

## Where it lives

- `surfaces/scheduling/service-detail.tsx` — the requirement row renders `role`,
  `kind` and `count`. `skillTags` exists in the type, is sent in the payload, and
  **has no control on the form**, so it is always `[]`.
- `wizeworks/packages/scheduling/src/availability.ts` — the `skillTags` filter is
  the only thing that narrows candidates.

## The fix

**The row asks for the skills, and says who they get you.**

New [surfaces/scheduling/service-requirements.tsx](../../../apps/workbench/surfaces/scheduling/service-requirements.tsx)
owns the whole "Who or what it needs" section:

- A new field, **"Only people with"**, wired to `skillTags` — the one thing the
  engine actually filters on. Comma-separated, same as the "Skills or features"
  field on the person's own record, because that is the list it is matched
  against.
- **"What it is" is now labelled as what it is**: "Your name for it, so the diary
  reads clearly." It was reasonable to think it did the matching; now it says it
  does not.
- Under the field, **who currently fits**, live, before saving:
  - "Only Dara Bell can take this booking."
  - "Ava Bennett, Nia Okafor and Noor Rahim can take this booking."
  - "Anyone can take this booking." — when no skill is asked for.
  - And in red when nothing matches: "Nobody has that, so this cannot be booked
    at all. Add it under Skills or features on the person who does it." That is
    the `roles.length === 0 → nothing is bookable` case in `availability.ts`,
    which would otherwise be a service that silently offers no slots.

The last one is the point. A skill that matches nobody and a skill that matches
everybody looked identical before; now they read differently on the screen where
the decision is made ([[feedback_absent_behaves_like_fine]]).

**Housekeeping the size rule forced** (piggles RULE #0.5, on a file that was 973
lines before this): `service-detail.tsx` is now 596, with
`service-requirements.tsx` (251) and `service-basics.tsx` (296) beside it.

## Confirmed by

Re-run as Nia on 2026-08-21, on all three services that belong to one person:

| Service              | Only people with | The screen said                                               |
| -------------------- | ---------------- | ------------------------------------------------------------- |
| Barbering, skin fade | `barbering`      | **Only Dara Bell can take this booking.**                     |
| Beard trim and shape | `barbering`      | **Only Dara Bell can take this booking.**                     |
| Full head highlights | `color`          | Ava Bennett, Nia Okafor and Noor Rahim can take this booking. |

That third line is the fix earning its keep on its first day: it named two people
Nia has never employed — leftovers the sample clear did not take
([085](085-her-price-list-had-two-of-everything-at-two-different-prices.md)). She
deleted them, and the line now reads **"Only Nia Okafor can take this booking."**
