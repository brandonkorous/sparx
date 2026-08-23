# 145 — Removing a service was called permanent, and never was

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — wrong moves
**Surface:** mypiggles › Bookings › Services
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia removed **Cut and finish**, her core service. The confirm said:

> **Remove Cut and finish?**
>
> This takes the service off your booking page and out of this list. Bookings
> already made against it are kept. This cannot be undone — you would have to set
> it up again.

Both halves are the wrong shape.

**"Bookings already made against it are kept" is a reassurance with no number in
it.** Seven bookings were on that service and two of them are next week, one
being a client with a confirmed Thursday at 4 PM. The sentence that would have
stopped her hand is the one with the count in it.

**"This cannot be undone" was not true.** `deleteService` stamps `deletedAt` and
nothing else. The row, its price, its rules and its resource strategy were all
still there — every read simply filtered them out, and no route could reach one.
A soft delete behaving like a hard one is the worst of both: the data is kept
and the person is told it is gone.

And "you would have to set it up again" hides the real cost. Rebuilding by hand
mints a **new id**, so the seven bookings already taken would keep pointing at
the invisible old service forever. Re-creating is not restoring.

## What it also did not say

The removal came off her **published homepage**, not just her booking page. The
price list on the front page is the live services block, so the moment she
confirmed, the salon's flagship $65 haircut vanished from the website a stranger
sees. "Your booking page" understates that: a business owner reads it as `/book`.

## What turning the light on found

The new filter shows Halo & Hem has **twelve removed services** sitting in the
database — Balayage, Bridal styling, Full colour, Manicure, Gloss & toner and the
rest of the starter pack she replaced in act 3. They have been invisible and
unrecoverable since the day she cleared them out.

## Where it lives

- [packages/scheduling/src/services.ts](../../../../wizeworks/packages/scheduling/src/services.ts) — `restoreService`, `includeRemoved`
- [services/api-rest/.../scheduling/services.ts](../../../../wizeworks/services/api-rest/src/routes/v1/scheduling/services.ts) — the restore route, `removedAt`
- [services/api-rest/.../scheduling/bookings.ts](../../../../wizeworks/services/api-rest/src/routes/v1/scheduling/bookings.ts) — `statusIn`
- [surfaces/scheduling/service-removal.ts](../../../apps/workbench/surfaces/scheduling/service-removal.ts) (new) — the counts and the sentence
- [surfaces/scheduling/services-table.tsx](../../../apps/workbench/surfaces/scheduling/services-table.tsx) (new) — "Put it back"
- [surfaces/scheduling/services-toolbar.tsx](../../../apps/workbench/surfaces/scheduling/services-toolbar.tsx) (new) — the Removed filter

## The fix

**Removing is reversible, because it always was.** `restoreService` clears the
stamp, `POST /v1/scheduling/services/:id/restore` reaches it, and the services
list has a **Removed** toggle beside "Active only" — its own control, because
that one narrows what is live and this one widens to what is gone. A removed row
wears a `Removed` badge and carries one action, "Put it back". It is not
clickable: every other read still filters it out, so there is no detail pane
behind it.

**The confirm counts what it is about to affect:**

> 7 bookings were taken on it and 2 are still to come. Those keep their time and
> their price, and stay in your diary. It comes off your website straight away,
> so nobody new can book it. You can put it back from your services list.

"Still to come" means what it says. The bookings list has always accepted
`serviceId` and `from`, and the engine has always accepted `statusIn`; none of
the three was exposed, so the first draft counted a cancelled appointment next
Thursday as one somebody was coming for. `statusIn` is now a query parameter and
the count asks for the four states an appointment can still be in when it
happens. While either number is loading the sentence falls back to the count-free
version rather than printing a zero nobody measured.

`service-detail.tsx` was 596 lines with a 370-line component in it, and
`services-list.tsx` 342. Both are split (RULE #0.5): the draft and its payload,
what the form knows and does, the form's tail, the table, and the toolbar.

## Confirmed by

> Removed Cut and finish as Nia and watched the damage: all 13 bookings survived
> and still named it, but her live homepage went from ten services to nine and
> the $65 haircut was gone from the price list with no way back on any screen.
>
> After the fix: turned on **Removed**, found it among twelve removed services,
> pressed **Put it back**. It went straight to `Bookable`, the homepage went back
> to ten with Cut and finish in it, and `select count(*) from bookings where
service_id = 'f32d6c20…'` still returns 7 — the same service, not a rebuilt
> one. Then opened it and pressed Remove again to read the new question: "7
> bookings were taken on it and 2 are still to come." Those two are Colette's
> Thursday and Margot's Friday. Pressed Keep it.
