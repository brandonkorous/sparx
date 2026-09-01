# 366 — A whole app existed and there was no door to it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · sweeping for re-declared module lists (FOLLOW_UPS #2)
**Surface:** mypiggles › the rail › All apps
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** opened All apps as Devi — Campaigns is there, after Get Found, with its own glyph

## What happened

Devi opens **All apps**, which introduces itself:

> **All apps**
> Everything Piggles does. Every one of them is included and working — this only
> decides which are on your rail, and it never changes what you pay.

It lists fifteen: Home, My Site, Content, Get Found, Sell, Stock, Partners, Customers,
Messages, Bookings, Invoices, Money, My Team, Automations, Connections. Then it ends.

**Campaigns is not in it.** Neither is it on the rail. And Devi has the app switched
on — `funnels: true` — with two real registered surfaces behind it (`funnels.campaigns`
"Campaigns", and `funnels.campaign`), a hue in both brands' tokens, and a slot in the
console's own nav ordering with a label and an icon beside it:

```ts
// lib/surfaces/nav.ts
funnels: 'Campaigns',
…
// Between the apps that DO the campaign and the money it brings in.
'funnels',
…
funnels: faArrowProgress,
```

Everything was built. The only way to reach it was ⌘K, or a pane somebody had already
opened — which is how it had been reached in this run, so it never looked missing.

## Why it happened

Three lists have to agree and nothing made them:

| list                                      | holds                         | had funnels |
| ----------------------------------------- | ----------------------------- | ----------- |
| `APPS` (`@piggles/config/apps`)           | the rail and All apps         | **no**      |
| `APP_ICONS` (`@piggles/config/app-icons`) | the glyph each door wears     | **no**      |
| the surface catalog                       | the screens, tagged `module:` | yes         |

`APPS[].modules` is `ModuleKey[]` where `ModuleKey = string`, deliberately — the
comment says "the platform owns that list, and Piggles must not hold a stale copy of
it". Which is right, and it is also why nothing noticed that the copy was incomplete:
an app catalogue missing an entry typechecks perfectly.

The same sweep found the same shape in four more places, all `funnels`:

- `api-rest`'s per-site `MODULE_SLUGS`, under a comment reading "kept in step with
  @wizeworks/modules' ALL_MODULES" — it was not, so **funnels could not be switched
  off for one site** and the per-site toggle silently did nothing for it. Now derived
  from `ALL_MODULES` rather than re-typed, so it cannot drift again.
- `@wizeworks/ui`'s three hue lists (`MODULE_COLOR_KEYS`, the `SparxModule` union,
  `MODULE_SEGMENTS`). The color-key list's own comment already records this happening
  once — "these three were missing while their tokens existed" — and funnels was the
  next one to go the same way.
- `@wizeworks/ui`'s `BTN_COLOR`. This one is `Record<ColorKey, string>`, so the moment
  the union gained `funnels` the compiler said so. Worth noting: it is the only copy
  of the five that could fail loudly, and it is the only one that did.

## The fix

**Campaigns is an app.** In the `web` group at `navOrder: 45`, right after Get Found —
your presence, then being found, then the paths you build for people to follow. A
campaign is landing pages and the steps between them, so it sits beside the site
rather than in Sell: it is as often a sign-up or an enquiry as a sale.

> **Campaigns** — Run a promotion as steps, and see where people stop

`defaultEnabled: false`, like Automations and Connections: off the rail for a new
business, one tap in All apps, never withheld.

**Its glyph is `faArrowProgress`** — the one its surfaces already carry, so the door
and the pane it opens are recognisably one thing. It had been rendering as **Home's
house**, because `appIcon()` falls back to `faHouse` for an unknown id, on purpose:
"visibly wrong beats absent, and it is obvious enough to get fixed." It was, within a
minute of the app existing — but only because somebody was looking at that screen.

**And a guard, `pnpm check:piggles-apps`**, so the next app cannot ship without a door
or a glyph. It asserts every `APPS` id has an icon, and every module identity with a
**visible** surface is claimed by some app — reading `hiddenSurfaces` from the one
list that decides exclusions, so `partner.*` (sparx's reseller programme, excluded
from this brand outright) is correctly not required to have one. Proved red three
ways: the icon removed, the app removed, and the catalog directory moved.

Wiring it up found that **`check:piggles-nav` was never in the pre-push guard at all**
— the vocabulary check written for issue 362 could only ever be run by hand, so the
leak it exists to stop could have shipped again unblocked. Both are in the hook now.

## Still open

- ~~**`@piggles/config` does not typecheck standalone**~~ — **closed 2026-09-01,
  and it was bigger than this line.** Three of the five Piggles packages
  (`config`, `brand`, `auth-handoff`) had **no `typecheck` script at all**, so
  `pnpm -r typecheck` skipped them entirely. All three now have one and all three
  pass; the gate went from 5 Piggles projects to 8. See
  [367](367-she-said-dont-keep-me-signed-in-and-the-console-kept-her-signed-in-for-a-month.md).
