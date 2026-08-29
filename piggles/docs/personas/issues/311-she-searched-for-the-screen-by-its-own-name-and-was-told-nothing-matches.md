# 311 — She searched for the screen by its own name and was told nothing matches

**Status:** fixed, confirmed
**Severity:** minor (a real destination is reachable only from one button on one
other screen, and search denies it exists)
**Found by:** P03 · Juniper Row · while confirming [309]
**Surface:** the console — the search box, and Past moves
**Filed:** 2026-08-28
**Fixed:** 2026-08-28

## What happened

Wanting the list of past imports, typed into the search box the thing it is
called:

    Past moves
    Nothing matches that. Try a different word.
    Nothing in your orders, customers or products matches "Past moves".

Then its own registered keyword:

    past imports
    Nothing matches that. Try a different word.

The pane exists, has a title, an icon, a route (`/move-in/past-moves`) and three
search keywords written for exactly this. The only way to it is a **Past moves**
button in the toolbar of the move-in screen — so a person has to already be
somewhere else, and know it is there.

## Why

The registry entry claimed both things at once:

```ts
key: 'platform.migrate.history',
title: 'Past moves',
singleton: true,
listed: false,
keywords: ['migration history', 'past imports', 'previous moves'],
```

The launcher builds its entries from `listedSurfaces()`, so `listed: false`
removes the surface before its keywords are ever read. They were dead the day
they were written, and nothing says so.

`listed` covers two different questions with one flag — "offer this in the nav
panel" and "let someone find it by name" — and the field's own comment shows the
conflation: _"Off for surfaces only reachable from a parent."_ This one is not
reachable-only-from-a-parent by nature; it was just marked that way. Its
neighbour `platform.migrate.run` carries a comment earning the same flag
honestly — _"always with params. A bare 'Migration run' row in the launcher would
open an empty pane"_ — and Past moves takes no params at all.

## The fix

Listed, and sectionless beside **Move in**, which is where it belongs: the two
are one errand. The comment now says why this entry differs from the run pane
above it, so the next person does not copy the flag down again.

## Confirmed as Devi, 2026-08-28

Typing **Past moves** into the search box now offers _Past moves · Platform_,
and it opens the list. **past imports** and **previous moves** find it too.

## Not repaired, deliberately

Eleven other surfaces carry search keywords the launcher can never read, for the
same reason. All eleven are entity panes that need a record to open
(`email.broadcasts.detail`, `partner.bootcamp.detail`, `platform.settings.domain`
and so on) — a bare row for them in the launcher would open an empty pane, so
`listed: false` is right and only the keywords are wasted. Past moves was the one
parameterless destination among them, and the only one search should have been
finding.
