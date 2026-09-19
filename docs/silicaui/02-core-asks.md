# silicaui (core CSS) — the asks (§1, §3 OPEN; §2 SHIPPED)

**Version:** 1.3.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-18

> The register for **`@wizeworks/silicaui`**, the Tailwind plugin that emits the color and component
> classes. Its sibling [01 — silicaui-builder](01-builder-asks.md) covers the builder editor's host
> APIs and is a different package; asks do not move between them.
>
> Same contract as 01: each § names the specific missing capability, verified against a stated
> version, and states why the sparx side cannot fix it without breaking
> [RULE #1](../../CLAUDE.md) — a call-site override is a deferred fix everyone downstream pays
> interest on, so a gap that can only be closed by painting over the component belongs here.

| §   | Raised     | Verified against             | Status      | Ask                                                                                        |
| --- | ---------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| 1   | 2026-08-02 | `@wizeworks/silicaui@0.41.0` | **OPEN**    | `stack`'s peek is fixed-distance, so it vanishes above ~320px                              |
| 2   | 2026-08-02 | `@wizeworks/silicaui@0.56.0` | **SHIPPED** | `soft` / `outline` ink is the raw accent — 1.66:1 on light hues                            |
| 3   | 2026-09-18 | `@wizeworks/silicaui@0.55.0` | **OPEN**    | a color an app ADDS gets `bg`/`text`/`border` only; `ring-*` and the rest draw the default |

> **[§2 — `soft` and `outline` set their ink to the RAW accent](#2--soft-and-outline-set-their-ink-to-the-raw-accent-so-light-hues-go-unreadable)
> — ANSWERED in `0.56.0` (2026-09-18).** Shipped as shape (b), the computed one, which is the
> half of the ask that mattered: it reaches every registered color by construction, including the
> 27 sparx declares and any a tenant invents at runtime, so nothing has to be hand-authored per
> hue and nothing can be forgotten.
>
> ```js
> // packages/silicaui/src/lib/ink.js
> export const ink = (colorRef) =>
>   `oklch(from color-mix(in oklab, ${colorRef} 50%, var(--color-base-content)) l calc(c * 2) h)`;
> ```
>
> Mixing halfway toward `--color-base-content` moves the hue toward whatever the CURRENT surface
> uses as ink, so the direction is right in every theme rather than in the one that was measured.
> The mix costs about half the chroma and the second step multiplies it back, so the color still
> reads as itself. Reported: **15 of 21 soft/outline/ghost/link pairs below AA in light, now 40 of
> 40 passing in both themes.**
>
> It went further than the ask in two ways worth knowing about:
>
> - **`text-<role>` utilities now paint the ink form, not the fill.** That is 954 call sites
>   across the two consoles (`text-primary` 177, `text-module` 367, `text-warning` 122,
>   `text-success` 108, `text-error` 80, `text-info` 43, `text-secondary` 25, `text-neutral` 19,
>   `text-accent` 13) that get a readable ink without a single edit here. This is exactly the
>   propagation RULE #1 exists for, and the reason none of them was ever patched locally.
> - **`neutral` as ink resolves to `--color-base-content`**, where it measured 1.5:1 in dark.
> - Fifteen rules across twelve components stopped writing a role token straight into a `color:`,
>   and thirteen stopped fading readable text with `opacity` — silica's own move to RULE #3.
>
> **What sparx should now do**, once `0.56.0` is installed: the `/features` page dropped `soft`
> entirely as a workaround and moved its price chips, status chips and selected filter to `solid`.
> Those can go back to `soft`, and the ~19 "In build" / 35 "On the roadmap" markers stop being
> small dark solids. Nothing is broken until they do.
>
> **§1 and §3 are untouched by `0.56.0`** — checked against its changelog, which mentions neither
> `stack`'s peek distance nor the `ring-*` family. Both stay open.

---

## 1 — `stack` stops peeking above ~320px, silently

`.stack` layers its children into a "peeking deck": the front child flush on top, the next two
nudged back and scaled down so their edges show. Above roughly **320px in the peeking dimension the
peek goes negative** and the deck renders as a single card, with no warning and nothing in the
component docs about a size ceiling.

### The evidence

sparx's pricing hero puts fifteen module cards in a `<Stack>` at 480×448. Measured from the live
DOM — every value is the back card's edge relative to the front card's, so a **negative number
means fully occluded**:

| child | above front's top | inside front's left | above front's bottom |
| ----- | ----------------- | ------------------- | -------------------- |
| 2nd   | −6px              | −17px               | −30px                |
| 3rd   | −12px             | −33px               | −60px                |

Nothing peeks in any direction, so the deck reads as one card.

### Why

The nudge is a **fixed rem distance** while the shrink is **proportional**, and with
`place-items: center` the scale pulls every edge inward by `size × (1 − scale) / 2`:

```js
'& > *':              { transform: 'translateY(-1.5rem)  scale(0.85)'  },  // 3rd and beyond
'& > *:nth-child(2)': { transform: 'translateY(-0.75rem) scale(0.925)' },
'& > *:first-child':  { transform: 'translateY(0)        scale(1)'     },
```

A peek exists only while the nudge beats the shrink:

```
2nd card:  12px > h × 0.0375  →  h < 320px
3rd card:  24px > h × 0.075   →  h < 320px
```

Both land on the same ceiling. The component's own demo uses `h-32 w-48` (128×192), comfortably
under it — which is why the geometry looks correct everywhere it is currently exercised and fails
the first time a card is given real content.

Worth noting even below the ceiling: at `w-48` the peek is ~5px on the 2nd card and ~10px on the
3rd. `stack` currently produces a **sliver**, not a fanned deck, at every size it works at.

### Why sparx cannot fix this at the call site

- **No prop covers it.** `StackProps` is `peek` (`top`/`bottom`/`start`/`end`) and `interactive`.
  `peek` picks a direction; there is no distance.
- **It is not a token.** The offsets are literals inside `stack.js`, not custom properties, so
  there is nothing to override from `@sparx/brand/theme.css`.
- **Overriding the transform in feature code is the re-skin RULE #1 exists to stop** — and it would
  have to be re-derived per card size at every future call site, which is the definition of a
  deferred fix.
- **Shrinking the card under 320px is not a fix**, it is abandoning the use case: it forces content
  out of the card to satisfy a geometry constant, and still yields only a ~5px sliver.

### Shape

Make the nudge proportional too. A percentage translate resolves against the element's own
border-box size (`translateY(%)` against height, `translateX(%)` against width), so the same
declaration then peeks identically at any card size:

```js
'& > *': {
  '--stack-peek': '5%',                                                  // overridable per deck
  transform: 'translateY(calc(-7.5% - var(--stack-peek))) scale(0.85)',  // shrink eats 7.5%
},
'& > *:nth-child(2)': {
  transform: 'translateY(calc(-3.75% - var(--stack-peek) / 2)) scale(0.925)',
},
'& > *:first-child': { transform: 'translateY(0) scale(1)' },
```

The `-7.5%` / `-3.75%` terms exactly cancel each card's shrink, so `--stack-peek` is then the
**real, visible** peek rather than a number that has to out-run the scale. `-bottom` is the same
with positive signs; `-start` / `-end` are the same on `translateX`, and need no different figures
because the scale is uniform.

Exposing `--stack-peek` on `.stack` matters as much as the fix: a hero deck and a notification pile
want visibly different fans, and today neither can ask for one.

### If it ships

sparx's pricing hero (`sparx/apps/web/components/marketing/pricing/module-deck.tsx`) needs no change but
a `--stack-peek` of around `4%` — its cards are already at full content height and are simply not
peeking. Until then the deck ships as-is: it still cycles, it is still the right device, it just
reads as one card rather than a deck.

---

## 2 — `soft` and `outline` set their ink to the RAW accent, so light hues go unreadable

**SHIPPED in `0.56.0`, 2026-09-18.** Kept in full below because the measurements are the
evidence the fix was needed and the bar any future regression is read against. What landed is
summarized in the callout above.

`btn-<c> btn-soft` / `badge-<c> badge-soft` fill with a ~15% tint of `--color-<c>` and then set the
foreground to **`--color-<c>` itself**. That only works while the accent is dark. For any mid- or
light-toned hue the label is the same color family as the surface it sits on, and the contrast
collapses — silently, because the class pair looks correct in source and reads as "a tinted chip".

`outline` has the identical problem for the same reason: it paints border AND label in the raw hue.

### The evidence

Measured from the live DOM on sparx's `/features` (light theme, WCAG 2.1 contrast, foreground
against each element's own computed background):

| class                            | contrast | AA normal (4.5) | AA large (3.0) |
| -------------------------------- | -------- | --------------- | -------------- |
| `badge-warning badge-soft`       | **1.66** | ✗               | ✗              |
| `btn-warning btn-soft`           | **1.66** | ✗               | ✗              |
| `badge-module-inventory … -soft` | **1.94** | ✗               | ✗              |
| `badge-module-crm badge-soft`    | **2.15** | ✗               | ✗              |
| `badge-module-cms badge-soft`    | **2.21** | ✗               | ✗              |
| `badge-module-dropship … -soft`  | **2.24** | ✗               | ✗              |
| `badge-module-email badge-soft`  | **2.42** | ✗               | ✗              |
| `badge-module-commerce … -soft`  | **2.43** | ✗               | ✗              |
| `btn-success btn-soft`           | **3.79** | ✗               | ✓              |
| `badge-neutral badge-soft`       | 10.5     | ✓               | ✓              |

Nine of ten fail AA for normal text; eight fail even the 3:1 large-text floor. The one that passes
comfortably is `neutral` — i.e. the only accent dark enough for "the hue as its own ink" to work.

The same hues are fine on `solid`, which uses the designed `--color-<c>` / `--color-<c>-content`
pair: measured across twelve module fills on the same page, `solid` lands between **4.6:1 and
8.0:1**, and the `-content` token correctly flips to dark ink on Commerce orange / CRM cyan and to
white on Builder indigo. **The legible answer already exists in the token set — `soft` just doesn't
reach for it.**

### Why sparx cannot fix this at the call site

- **There is no ink prop.** `soft` is a `variant`; nothing on `Badge`/`Button` overrides its
  foreground.
- **It is not a token we can re-point.** Darkening `--color-warning` in `@sparx/brand/theme.css`
  would fix `soft` and simultaneously ruin `solid`, where amber + `#0c1433` ink is correct today.
  One token cannot be both the fill and the on-tint ink — that is precisely what the `-content`
  pair exists to express, and `soft` is the one variant that ignores it.
- **Writing `text-*` onto the component is the re-skin RULE #1 exists to stop**, and it would have
  to be re-derived per hue at every call site.

sparx's workaround on `/features` was to stop using `soft` entirely — price chips, status chips and
the selected filter are all `solid` now. That is a fine outcome for that page (it reads stronger),
but it is not available everywhere: `soft` is the correct register for a quiet status pill, and
right now the platform cannot have one in any color but `neutral`.

### Shape

Derive the soft/outline foreground from the accent instead of using it verbatim — the same idea as
`-content`, but resolved against the tint rather than the fill. Either:

```css
/* a) a second paired token, authored alongside -content */
.badge-soft {
  color: var(--color-<c>-emphasis, var(--color-<c>));
}

/* b) or computed, so it needs no new authoring per color */
.badge-soft {
  color: color-mix(in oklab, var(--color-<c>) 70%, var(--color-<c>-content));
}
```

(b) is self-maintaining and gets every registered color — including tenant-authored ones — right
by construction, which matters here because sparx registers 27 and none of them can be hand-checked
by silica. Whichever way it lands, the invariant worth stating in the docs is the one `solid`
already keeps and `soft` does not: **a silica variant never emits a fill without emitting an ink
that is legible on it.**

### If it ships

`/features` can move its status pills back to `soft`, and the ~19 "In build" / 35 "On the roadmap"
markers stop being small dark solids. Nothing else on sparx needs to change — but every `soft` badge
across workbench and admin quietly becomes readable, which is the larger win.

---

## 3 — a registered color gets three utilities, and the other nine draw the default

`@plugin '@wizeworks/silicaui' { colors: …; }` registers a color name. The plugin then emits its
component classes (`btn-module`, `badge-module`) and exactly three color utilities:

```css
.bg-module {
  background-color: var(--color-module);
  --u-accent: …;
}
.text-module {
  color: var(--color-module);
  --u-accent: …;
}
.border-module {
  border-color: var(--color-module);
  --u-accent: …;
}
```

silica's OWN default color names are in Tailwind's theme namespace, so `ring-primary` and
`divide-base-300` work. **The names an app adds to the list are not**, and since the `colors:` list
REPLACES the default set rather than extending it, every name an app adds beyond the defaults lands
in the gap. For those names none of these exist:

`ring-*` · `outline-*` · `divide-*` · `caret-*` · `decoration-*` · `from-*` · `via-*` · `to-*`

Compiled against the Piggles console's real stylesheet with `@source inline(...)` forcing every
combination, Tailwind 4.3.0, 2026-09-18:

| family                                                      | `primary` `success` `base-300` | `module` `danger` `chrome` `group-sell` `module-commerce` |
| ----------------------------------------------------------- | :----------------------------: | :-------------------------------------------------------: |
| `bg-` `text-` `border-`                                     |            emitted             |                          emitted                          |
| `ring-` `outline-` `divide-` `caret-` `decoration-` `from-` |            emitted             |                        **no rule**                        |

### Why it is worse than a missing feature

Tailwind cannot warn about a class it cannot build, so it emits no rule and says nothing. The
property keeps its default, which for a ring is `currentColor`. Measured in the Piggles console on
2026-09-18, before the fix:

| class           | emitted rule                        | drawn                        |
| --------------- | ----------------------------------- | ---------------------------- |
| `border-module` | `border-color: var(--color-module)` | `#83b9b7` — correct          |
| `ring-module`   | **none**                            | `rgb(32,38,49)` — near-black |

That split is what makes it invisible: `ring-primary` two files away works perfectly, and
`ring-module` beside it is spelled the same way and draws nothing. It shipped to **fourteen call
sites** across two consoles and a marketing site. Among them: every
"this is the one you picked" marker in the onboarding wizard, each pairing a correct
`border-module` with a near-black `ring-module ring-1` pressed against it, in the first five minutes
a business ever spends on the platform.

### The local workaround, and why it is not a fix

Each app now carries a second list beside the first:

```css
@plugin '@wizeworks/silicaui' {
  colors: primary, module, module-chat, …;
}

@theme inline {
  --color-module: var(--color-module);
  --color-module-content: var(--color-module-content);
  /* …once per registered name… */
}
```

`inline` keeps it honest: Tailwind puts `var(--color-module)` straight into the utility instead of
emitting a `:root` value, so the block adds the missing utilities and decides no colors. A subtree
that repoints `--color-module` (`data-app`, `data-group`, a tenant theme) still wins, so a ring
drawn this way follows the app the pane belongs to, exactly as its background does.

It works, and it is a **second source of truth for the same list**. Seven apps now name their colors
twice — 39 names in the Piggles console alone — and a color added to one list and not the other is
invisible again. `scripts/check-silica-color-utilities.mjs` fails the build on that drift, which is
a guard standing in for a thing the plugin should simply do.

### The ask

When the plugin registers a color, register it in Tailwind's theme namespace too — the way it
already effectively does for its own defaults — so the whole namespaced vocabulary generates from
one list. Then the `@theme inline` blocks and the check that
guards them are deleted from all seven apps and nothing else changes.

### If it ships

`ring-module`, `divide-base-300` and `from-primary` mean what they say everywhere, including on
tenant-authored colors that silica can never hand-check — and the platform stops shipping the
`@theme inline` half of every app's color list.
