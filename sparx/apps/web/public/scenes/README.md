# Scene photography

Real photographs used **in the marketing page layout itself** — the picture half
of a [`<PhotoBand>`](../../components/marketing/photo-band.tsx) section.

Distinct from [`../products/`](../products/README.md) (product thumbnails inside
a rendered mockup) and [`../people/`](../people/README.md) (customer avatars
inside the CRM record device). Those are device fixtures. These are the design.

## Why these exist

The marketing site was built entirely from type, color and rendered UI mockups.
That is a real gap, not a stylistic position: a visitor scanning a page takes in
the pictures long before the prose, and a page with none asks them to read their
way to the point. Most won't.

Photography arrives through the shared `<PhotoBand>` rather than as a loose
`<img>` on whichever page someone was editing, so the aspect ratio, radius and
column split change in one place.

## What to choose

**Real people doing real work, in their own premises.** A stylist talking with a
client, a barista handing a bag across the counter, two makers over drawings on a
bench. Natural light, candid, specific.

**Not** generic business stock. No suits at whiteboards, no team-around-a-laptop,
no handshake-over-a-contract, no headset call-centre smiles. That look is the
house style `DESIGN.md` and the no-slop rules in `CLAUDE.md` exist to avoid, and
it also contradicts who these pages are written for — non-technical owners of
small businesses, not enterprise buyers.

The subject should be the WORK the section is describing. If the photo could be
swapped onto any other page without anyone noticing, it is decoration and the
section is better without it.

## Accessibility

These are content, not decoration, so every one carries a real `alt` describing
the scene. `<PhotoBand>` requires it.

## Source & licence

All from [Pexels](https://www.pexels.com), used under the
[Pexels licence](https://www.pexels.com/license/): free for commercial use, no
attribution required.

**The one term that binds directly here:** the licence forbids implying that a
depicted person endorses the product. These illustrate a KIND OF WORK. Never
caption one as a sparx customer, never attach a name or a quote to a face, and
never place one in a testimonial or "trusted by" position.

Fetched 2026-08-03 at 800×600 (dpr 2), `?auto=compress&cs=tinysrgb&fit=crop`.

| File                   | Scene                                      | Pexels ID                                        |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| `salon-consult.jpg`    | Stylist in consultation with a client      | [3992863](https://www.pexels.com/photo/3992863/) |
| `salon-welcome.jpg`    | Receptionist greeting a customer at a desk | [8834028](https://www.pexels.com/photo/8834028/) |
| `counter-handover.jpg` | Café worker handing a bag to a customer    | [6684768](https://www.pexels.com/photo/6684768/) |
| `workshop-plans.jpg`   | Two makers over drawings at a bench        | [7484152](https://www.pexels.com/photo/7484152/) |
| `craft-bench.jpg`      | Artisans collaborating in a studio         | [7167029](https://www.pexels.com/photo/7167029/) |
| `color-consult.jpg`    | Stylist showing color samples to a client  | [7819732](https://www.pexels.com/photo/7819732/) |

`salon-welcome`, `craft-bench` and `color-consult` are staged and unused so far —
available for the remaining module pages.
