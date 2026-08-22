# 099 — The Layers list called her map "site.map"

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Page › Layers
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — the fix is a new hook on the shared studio engine, used by both brands

## What happened

Nia opened her contact page in the builder and read down the Layers list:

> Visit the studio · 214 Bower Street, Suite B · Monday · Closed · Tuesday ·
> 9:00 – 5:30 · … · **site.map**

And on her homepage:

> What we do, and what it costs · **scheduling.services**

Everything else in that list is written the way she would say it. Those two are
the platform's internal keys, printed to a salon owner who has never seen a dotted
identifier in her life.

The palette that offered her those blocks called them **Map on its own** and
**Booking services**. The list she manages them in calls them something else.

## Why it matters

Small, but it lands in the one place the console cannot afford it. The Layers list
is how a non-technical owner finds the thing she wants to change, and two of its
rows are unreadable — so the two live regions on her site, the ones most worth
understanding, are the two she is least likely to click.

Piggles' whole terminology rule is that things are named by what you are doing
with them, never by category and never by our word for them
(piggles/CLAUDE.md RULE #3). `site.map` is our word for it, unedited.

## How to reproduce

Every time.

1. Any page carrying a live region — a map, the booking list, the brand mark, the
   legal links.
2. My Site › Page › **Layers**.

## Where it lives

The engine names an addressable node from its own `label`, falling back to what
the node is. For a `kind: "host"` node that fallback is `node.component` — the
allowlist key. The engine is deliberately catalog-agnostic, so it has no way to
know that `site.map` is called "Map on its own" in a registry it does not import.

`StudioHost` already has the seam this needs, twice over: `renderIcon` lets the
app draw the engine's glyphs in its own set, and `describeBinding` lets the app
say where a bound value comes from **in the app's own words**. There is no
equivalent for a node's name.

## The fix

Not made — it is an addition to `@wizeworks/studio`, which both brands' consoles
render, and that is larger than the surface under test.

The shape that matches what is already there:

```ts
/** What to call this node in the Layers list, in the app's own words. */
describeNode?: (node: AddressableNode) => string | undefined;
```

Piggles would answer it from `HOST_COMPONENTS`, which already carries a `label`
for every core written for exactly this audience — so `site.map` becomes
"Map on its own" and `scheduling.services` becomes "Booking services", with no
list of names living in the console.

**The owner-side workaround exists and is not a fix.** Every node has a
**Name this layer** field, so she can call it "The map". Needing to name a block
before its own list is readable is the defect.

## A second, smaller thing on the same list

A **bound** node is listed by its authored sample rather than its real value: the
address on her contact page reads `Maison Élan 128 Linden Street Suite 2 ·
Portland, OR 97205` in the Layers list while the canvas beside it correctly shows
`214 Bower Street, Suite B`. It is consistent — every bound node behaves this way —
but it means the list shows the demo values for exactly the nodes that are
already right.

## Rating effect

`My Site › Page` is scored in [rating.md](../rating.md).
