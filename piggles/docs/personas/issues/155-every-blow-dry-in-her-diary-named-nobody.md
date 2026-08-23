# 155 — Every blow dry in her diary named nobody

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — the buyer's side
**Surface:** mypiggles › Bookings › Calendar
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Nia's week, read across:

> 10:00 AM **Cut and finish** · Saoirse Whelan
> 12:00 PM **Cut and finish** · Ifeoma Achike
> 1:00 PM **Cut and finish** · Bilal Osei
> 3:15 PM **Blow dry**
> 4:00 PM **Cut and finish** · Colette Mbeki

Every hour-long appointment says who is coming. Every blow dry says nobody. So
does every beard trim, every toner, every root tint — three of her ten services
run between forty minutes and an hour, and not one of them names the client in
the place she actually reads her day from.

## Why it happened

Issue 148's fix, working exactly as written and one row short of right. A block
is as tall as the appointment is long, so it decides how much it can say:

```ts
function linesFor(slots: number): 1 | 2 | 3 {
  if (slots >= 4) return 3;
  return slots === 3 ? 2 : 1;
}
```

An hour is four slots and gets three rows: time, service, client. Forty minutes
is three slots and gets two — and the two it drew were **time** and **service**,
so the row that went was the client's name.

That was the wrong row to drop. The service repeats down the whole column and is
half-guessable from the height of the block; the chair is the column heading in
day view. **Who is coming is the one fact on a block that is nowhere else on the
screen.** Two rows was the right call; giving the clock a row of its own was not.

## The fix

At two rows the clock moves up beside the service and the client gets the second
row to herself:

> 3:15 PM **Blow dry**
> Delphine Aubert

Three rows is unchanged, and the half-hour one-row layout already did this — it
carries `Dry cut · Imani Reyes` on a single line. So all three sizes name the
client, and none of them draws a row it has no room for, which is what 148 was
about.

## Confirmed by

Nia's Calendar, week of Aug 24: the 40-minute blow dries read **3:15 PM Blow dry
/ Delphine Aubert** and **3:00 PM Blow dry / Imani Reyes**, and the hour-long
appointments still read time / service / client on three rows. Nothing is cut.
