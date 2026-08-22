# 082 — A link to any screen in the console opened nothing at all

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing checks (reload · deep link · restore)
**Surface:** mypiggles › every screen
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Nia opened `mypiggles.com/scheduling/availability` — the address the Availability
panel itself puts in the bar, copied from the panel's own **Copy a link to this
panel** button.

The workbench loaded, restored the panels she already had open, and **the
Availability panel did not open**. The address bar still read
`/scheduling/availability`. Nothing said anything.

Reproduced on five different addresses across three apps, in a brand-new tab, on
a cold load, waited on for twenty seconds each:

| Link                                   | What opened |
| -------------------------------------- | ----------- |
| `/scheduling/availability`             | nothing     |
| `/scheduling/services`                 | nothing     |
| `/scheduling/people-and-equipment/new` | nothing     |
| `/scheduling/reports`                  | nothing     |
| `/crm/customers`                       | nothing     |

**The error path was dead too.** `/nothing-like-this-exists` should open the
"That link doesn't open anything" panel. It opened nothing either, so a mistyped
link and a working link were indistinguishable: both showed you your old panels.

## What should have happened

The linked panel opens on top of the arrangement and takes focus. That is the
contract the whole module is written around —
[lib/workbench/deep-link.ts](../../../apps/workbench/lib/workbench/deep-link.ts)
opens with "Arriving somewhere — the whole journey from a URL to an open pane",
and lists four things that have to go right. All four were right. A fifth was not.

## How to reproduce

Every time, on any account with a saved arrangement.

1. Sign in to the console and open two or three panels, so there is an
   arrangement to restore.
2. Paste `http://localhost:3022/crm/customers?site=primary` into a new tab.
3. Wait as long as you like.

The saved panels come back. Customers does not open.

## Why it matters

A link is how one person sends another person to a thing. Piggles' own audience
is people who work off their phone between jobs, and the module's comments say so
— "a phone is where an emailed link is opened". Every one of those links was
landing people on yesterday's screen.

It is also the **silent** kind: the address bar keeps showing the link, so the
person believes they are looking at what they clicked. Nia's answer to "why am I
on the calendar" is not "the link failed", it is "I must have clicked the wrong
thing".

And it disabled two of this project's own checks. RULE #7 asks every persona to
deep-link another business's record and confirm nothing comes back; with links
inert, that test could not have failed and could not have passed.

## Where it lives

[components/deep-link-arrival.tsx](../../../apps/workbench/components/deep-link-arrival.tsx),
against [lib/dock/dock-wiring.ts](../../../apps/workbench/lib/dock/dock-wiring.ts)'s
`restoreOrDefault`.

**Resolution was never the problem.** Instrumented, the gate reported exactly
what it should:

```
[probe] resolved {"kind":"open","targets":[{"surface":"scheduling.services.list"}]} attached true
[probe] opened   ["p_b5f9340c-fa7"]
[probe] SYNC     docks=1 tabs=7        ← the tab strip went 6 → 7
[probe] +100ms   tabs= Home|People and equipment|Nia Okafor|Dara Bell|Availability|Calendar   ← back to 6
```

**The panel opened, and a layout restore swept it away inside 100ms.**

The dock's `onReady` attaches its host and THEN rebuilds the saved arrangement:

```ts
controller.attach(new DockPaneHost(api)); // isAttached() → true
configureDock(api);
restoreOrDefault(api, controller, siteKey); // hydrate() + api.fromJSON()
```

The arrival gate waits for `isAttached()` and opens the moment it turns true —
so its panel is added into a dock that is about to be replaced wholesale by
`fromJSON`. The gate then sets `arrived = true` and never looks again, because
its only re-arming condition was the host going away, and the host had not gone
away: its contents had.

## The fix

**The arrival gate re-arms per restore, not just per host.**

- `WorkbenchController` counts restores. `hydrate()` — called only when an
  arrangement is rebuilt from storage, by the dock and by the mobile stack, and
  never by a window-mode switch — bumps `restoreCount()`.
- `DeepLinkArrival` subscribes to that count and honours the link once per
  `(host × restore)` rather than once per host. `controller.open` focuses a match
  instead of duplicating, so re-applying costs nothing when the panel did
  survive, and is the only thing that saves it when it did not.

Ordering-independent on purpose: whether the restore lands before the arrival or
after it, the link is honoured against the arrangement that actually ends up on
screen.

## Confirmed by

Re-run as Nia on 2026-08-21, in the tab that had just failed, five times:

| Link                                           | Result                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/scheduling/services?site=primary`            | **Services** opens and is active; her 18 services listed                                                              |
| `/crm/customers?site=primary`                  | **Customers** opens and is active                                                                                     |
| `/nothing-like-this-exists`                    | **"That link doesn't open anything"** — "There is nothing at …"                                                       |
| `/commerce/orders/<another tenant's order id>` | the Order panel opens; the read is refused (see [083](083-a-link-to-an-order-this-salon-cannot-see-spun-for-ever.md)) |
| `/` (no link)                                  | the arrangement restores, nothing extra opens                                                                         |

The tab strip is read exactly (`.dv-active-tab`, not `className.includes('active')`
— `dv-inactive-tab` contains that substring, which produced a false reading in
P01).

## Rating effect

Recorded in [rating.md](../rating.md) once the panes it reaches are scored.
