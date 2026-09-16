# 506 — "Nothing is covered by this" sent her to fix the wrong control

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, proving the zone fix from [501](501-the-coverage-count-could-not-see-a-zone.md)
**Surface:** counting schedule detail, both consoles
**Filed:** 2026-09-14

## What she saw

With a zone typed into "Narrow to one zone", the warning fired correctly and then
gave her the wrong instructions:

> **Nothing is covered by this**
> There is no stock at this location **in this group**, so this schedule would
> never raise a count. Try **"Everything at this location"**, or **pick the place
> your stock actually sits**.

Her group was "Everything at this location" already. Her location was the only
one holding stock. The zone was the problem, and the zone is not mentioned.

Both remedies it names leave the zone box exactly as it is. Follow the advice and
the warning stays up, which teaches her the console is broken rather than that
her setup is.

## Why

Three controls can narrow a schedule — location, group, zone — and the sentence
was written when the count could only see two of them. [501](501-the-coverage-count-could-not-see-a-zone.md)
taught it to see the third without teaching the sentence to mention it.

This is the house's "one outcome, two causes" shape: a single message covering
several causes with different fixes, sending somebody to redo the thing they had
already got right.

## What changed

The sentence names what is actually narrowing it, and how to widen that:

| what is set | what she reads                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zone only   | Nothing at this location matches **the zone you named** … **Clear the zone box**, or pick the place your stock actually sits.                                                                   |
| group only  | Nothing at this location matches **the group you picked** … **Choose "Everything at this location"**, or pick the place your stock actually sits.                                               |
| both        | Nothing at this location matches **the zone you named and the group you picked** … **Clear the zone box, or choose "Everything at this location"**, or pick the place your stock actually sits. |
| neither     | There is no stock at this location at all … Pick the place your stock actually sits.                                                                                                            |

All four proven on screen.

## One I wrote myself in the fixing

The first version rendered:

> …would never raise a count. **choose** "Everything at this location", or pick…

Lowercase, mid-sentence-start. The remedies were phrased to follow "Clear the
zone box, or …", so whichever one leads the sentence has to be capitalized at the
point of use rather than baked into the list. Caught the only way it could be:
by reading the sentence on the screen after changing one dropdown.
