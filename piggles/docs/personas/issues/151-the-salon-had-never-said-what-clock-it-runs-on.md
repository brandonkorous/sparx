# 151 — The salon had never said what clock it runs on

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — dates ("say which timezone the machine is in")
**Surface:** mypiggles › Settings › Business details · blueprint install · api-rest
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

The dates check ends with an instruction to state which time zone the testing
machine is in. It is `America/Los_Angeles`. The salon is in Sacramento, which is
the same zone — so every date test in this run was conducted in the one condition
under which a zone bug is invisible.

That is worth stating on its own. It is also how the actual defect turned up,
because the follow-up question is: **where did the salon's zone come from?**

It came from the laptop.

```
sparx=# select timezone from tenant_businesses where tenant_id = '…';
 timezone
----------
(0 rows)
```

**No row at all.** Nia has never told Piggles what time zone the salon is in.
Business details shows Time zone as an empty "Search for your city…" and the only
thing under it was:

> Used for dates on documents you send.

Meanwhile `useBusinessTimezone()` does this:

```ts
return data?.timezone ?? thisComputersTimezone();
```

So: Nia Okafor and Dara Bell are stamped `America/Los_Angeles` because her browser
is, not because anything recorded that the salon is in Sacramento. Everything in
this run that looked right about times was right by coincidence of the device.

**Set the salon up from a hotel in London and her staff would be stamped
Europe/London, her 9:00 shift would begin at 1:00 in the morning her time, and
nothing on any screen would say so.**

## The other half: the blueprint stamped UTC on everything

The four stylists the salon design installed came out in `UTC`:

| Resource    | Zone                  | Created                    |
| ----------- | --------------------- | -------------------------- |
| Stylist     | `UTC`                 | blueprint install          |
| Ava Bennett | `UTC`                 | blueprint install          |
| Maya Cole   | `UTC`                 | blueprint install          |
| Noor Rahim  | `UTC`                 | blueprint install          |
| Nia Okafor  | `America/Los_Angeles` | added by hand, 5 min later |
| Dara Bell   | `America/Los_Angeles` | added by hand, 5 min later |

Ava's declared week is Tue–Sat, 9:00 AM to 6:00 PM. Read in UTC that is **2:00 AM
to 11:00 AM** in Sacramento. Her salon's public booking page would offer the
middle of the night and refuse the afternoon.

This came from two `.default('UTC')`s in the blueprint manifest and a literal
`"timezone": "UTC"` written into all **97** bundles by the generator. The comment
above the location declaration said the zone was "safe to guess and easy to
correct". It is neither: a guessed zone is invisible, and it is the value the
entire availability engine reads a business's own hours through.

Nia never hit it because she deleted all four blueprint stylists in an earlier
act and added her own. Nothing warned her; she got lucky.

## Where it lives

- [surfaces/business-details-fields.tsx](../../../apps/workbench/surfaces/business-details-fields.tsx) (new) — `TimezoneField`
- [packages/blueprints/src/manifest.ts](../../../../wizeworks/packages/blueprints/src/manifest.ts) — `SchedulingResourceDecl`, `SchedulingLocationDecl`
- [services/api-rest/src/lib/blueprint-installer.ts](../../../../wizeworks/services/api-rest/src/lib/blueprint-installer.ts) — `zoneOfBusiness`
- [marketplace-catalog/\_gen/service-sites/harness.ts](../../../../marketplace-catalog/_gen/service-sites/harness.ts)
- 97 `marketplace-catalog/blueprints/*/scheduling.json`

## The fix

**The field says what it actually governs**, instead of naming the smallest of
its consequences:

> The clock your business runs on. Working hours, bookings and the dates on
> documents you send are all read in it.

**The guess is stated instead of hidden.** Nothing is written on the owner's
behalf — the field stays visibly empty, which is the truth — but the sentence
under it names the fallback and why it is not the same as choosing:

> Nothing set, so times are being read as Los Angeles — Pacific Daylight Time
> (GMT-07:00) — whatever clock the computer you are on is set to. Choose it here
> and it stops depending on the device.

**A blueprint no longer invents a zone.** `timezone` is now optional on both the
resource and location declarations, the generator stops writing one, and the
literal `"timezone": "UTC"` came out of all 97 bundles. The installer fills the
gap from what the tenant has recorded and falls back to `UTC` only when the
tenant has recorded nothing either — never from the SERVER's clock, which would
stamp a machine's region onto somebody else's shop.

Together with issue 149 this stops being silent: a tenant whose staff are still
stamped UTC now gets told, in the words of the refusal, _"Ava Bennett is not
working at 2:00 PM. The hours that day are 2:00 AM to 11:00 AM"_ — which is a
sentence an owner reads once and understands.

## What is NOT fixed

**Existing rows are not backfilled.** Any tenant already carrying UTC-stamped
staff keeps them until someone opens that person's Time zone field. Rewriting
other businesses' scheduling data is a migration and a decision, not a repair,
and it is Brandon's to make.

**Onboarding still does not ask.** The fix makes the guess visible on the screen
that owns the answer; it does not add a step to the sign-up flow. Given the
under-five-minutes rule, whether it earns a step there is a product call.

## Confirmed by

> Read it as Nia. Business details, Defaults: Time zone empty, with the amber
> line naming **"Los Angeles — Pacific Daylight Time (GMT-07:00) — whatever clock
> the computer you are on is set to"**. Picked Los Angeles, saved, and the line
> disappeared; `tenant_businesses.timezone` now holds `America/Los_Angeles` for
> the first time, and the description under the field reads "The clock your
> business runs on…".
>
> The salon bundle's `scheduling.json` no longer carries a `timezone` key, and
> nor do the other 96.

## The zone tests the machine could not run

Because the machine and the salon share a zone, two things were asserted in code
rather than by clicking, and both pass:

- `blockedError` renders a New York resource's hours on **New York's** wall
  clock while the machine is on Pacific.
- The clocks going back is handled on the real path: 9:00 AM on Sat **Oct 24**
  stores `16:00Z`, 9:00 AM on Sat **Nov 7** stores `17:00Z`, and 8:45 AM on Nov 7
  is refused as outside her hours — so the WINDOW moved with the clocks, not just
  the display.
