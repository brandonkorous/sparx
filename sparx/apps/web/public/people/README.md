# Customer photography

Portraits for the **customer record** device on `/crm` — the avatar on the
unified record card that crossfades through `EXAMPLE_BUSINESSES`.

One file per entry in [`sparx/apps/web/lib/example-businesses.ts`](../../lib/example-businesses.ts);
the filename matches the `crm.avatar` field on that entry.

## Why a photograph and not a monogram

A CRM record is a **person**. An initials monogram is the placeholder you show
when you don't have a photo, so leading the marquee device with one made the demo
record read as an empty seat. The monogram was also the page's worst contrast
failure — drawn `bg-module-crm bg-soft text-module-crm`, the accent inked over a
15% tint of itself, measured **2.15:1**. `crm.initials` is kept as the accessible
fallback and for any surface too small to carry a face.

Faces sit high in a standing portrait, so the avatar crops `object-top`. A centred
square crop of these lands on the torso.

## Selection

Real proprietors in their own shops — a florist, a café owner, a market trader —
not corporate stock. No suits at whiteboards, no team-around-a-laptop. That is a
deliberate line: generic business stock is the house look `DESIGN.md` and the
no-slop rules in `CLAUDE.md` exist to avoid, and it would also contradict the
audience these pages are written for (see the non-technical-business-owner rule).

Faces are assigned to fixtures **in list order**. No attempt is made to match a
face to a name — that is not a judgement worth making, and the fixture names are
already varied by design.

## Source & licence

All from [Pexels](https://www.pexels.com), used under the
[Pexels licence](https://www.pexels.com/license/): free for commercial use, no
attribution required.

**One licence term binds directly here:** the licence forbids implying that a
depicted person endorses a product. These appear only as the customer inside a
rendered mockup of the sparx CRM — a depiction of software, not a testimonial —
and no photographed person is named, quoted, or presented as a sparx user. Keep
it that way. Do not move these into a testimonial, a logo wall, a "trusted by"
row, or any position that reads as a real customer vouching for the product.

Fetched 2026-08-03 at 160×160 (dpr 2), `?auto=compress&cs=tinysrgb&fit=crop`.

| File             | Fixture    | Business            | Pexels ID                                          |
| ---------------- | ---------- | ------------------- | -------------------------------------------------- |
| `dana-ruiz.jpg`  | Dana Ruiz  | Flax & Fern         | [4473398](https://www.pexels.com/photo/4473398/)   |
| `marcus-lee.jpg` | Marcus Lee | Hudson Farm Stand   | [36330752](https://www.pexels.com/photo/36330752/) |
| `priya-nair.jpg` | Priya Nair | Waggle Pet Co       | [3933017](https://www.pexels.com/photo/3933017/)   |
| `sam-carter.jpg` | Sam Carter | North Loop Roasters | [7175989](https://www.pexels.com/photo/7175989/)   |
| `luis-reyes.jpg` | Reyes Fab. | Atlas Supply Co     | [5920775](https://www.pexels.com/photo/5920775/)   |

Verify any replacement at actual size before committing it: the avatar renders at
42px, and a full-body shot becomes an unreadable smudge there. One candidate was
rejected for exactly that.
