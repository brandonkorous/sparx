# 644 — The marker that says "this is the one you picked" was drawn in black

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 222 (while building the row marker for [643](643-i-could-not-change-a-saved-reply-only-delete-it-and-type-it-again.md))
**Surface:** both consoles and the Piggles marketing site — 14 places, including every step of the onboarding wizard
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** compiled with Tailwind 4.3.0 against the real stylesheet, with and without the fix

## What happened

I needed to ring the row whose words were in the boxes above it, so I wrote the
class the console writes everywhere else for the active app's color:

```tsx
editing ? 'ring-module ring-2 ring-inset' : '';
```

It drew a **near-black** ring. Measured on the live element:

| class             | rule Tailwind emitted                   | drawn                            |
| ----------------- | --------------------------------------- | -------------------------------- |
| `border-module`   | `border-color: var(--color-module)`     | `#83b9b7` — the Messages teal    |
| `bg-module`       | `background-color: var(--color-module)` | `#83b9b7` — correct              |
| `text-module`     | `color: var(--color-module)`            | `#83b9b7` — correct              |
| **`ring-module`** | **none at all**                         | **`rgb(32,38,49)` — near-black** |

`ring-module` is not a class. It has never been a class.

## Why nothing said so

A color is named **twice**, and has to be:

```css
@plugin '@wizeworks/silicaui' { colors: primary, module, module-chat, …; }
@theme inline { --color-module: var(--color-module); … }
```

The first is silicaui's registration. Its plugin emits the component classes
(`btn-module`, `badge-module`) and exactly **three** color utilities: `bg-*`,
`text-*`, `border-*`.

The second is Tailwind's theme namespace, and every OTHER namespaced color
utility is built by Tailwind from it: `ring-*`, `outline-*`, `divide-*`,
`caret-*`, `decoration-*`, `from-*`, `via-*`, `to-*`.

**silicaui's own default colors are already in that namespace. The ones an app
registers on top of them are not** — and an app's list REPLACES the defaults, so
every name it adds beyond them lands in the gap. Compiled against the console's
real stylesheet, before and after:

| utility family                                              | `primary` `success` `base-300` (silica's) | `module` `danger` `chrome` `group-sell` `module-commerce` (this app's) |
| ----------------------------------------------------------- | :---------------------------------------: | :--------------------------------------------------------------------: |
| `bg-` `text-` `border-`                                     |                   works                   |                                 works                                  |
| `ring-` `outline-` `divide-` `caret-` `decoration-` `from-` |                   works                   |                          **no rule emitted**                           |

So the failure is invisible twice over. `ring-primary` two files away works
perfectly, and `ring-module` beside it is spelled the same way and draws nothing
— and **Tailwind cannot warn about a class it cannot build.** It emits no rule
and says nothing. The property keeps its default, which for a ring is the
inherited text color.

A near-black ring on a white card reads as a border somebody meant.
[[feedback_absent_behaves_like_fine]]

## Where it shipped

**14 call sites**, before the two I added writing
[643](643-i-could-not-change-a-saved-reply-only-delete-it-and-type-it-again.md).
Ranked by who sees them:

| where                                     | what it marks                                                 |
| ----------------------------------------- | ------------------------------------------------------------- |
| **Onboarding › Pick a starting point** ×2 | the blueprint card you chose, and "start from a blank canvas" |
| **Onboarding › Your web address** ×2      | the address you picked, and the recommended one               |
| **Onboarding › You are live**             | the summary panel                                             |
| Content › the media picker                | the image you selected                                        |
| Piggles marketing › the day-in-the-life   | the beat currently playing                                    |

Five of the six console ones are in the **first five minutes a business ever
spends here**. Each pairs a correct module-colored border with a near-black halo
pressed right against it, which does not read as a choice at all; it reads as a
rendering fault.

The marketing site had a second one of the same shape:
`divide-module-content/25` on the three assurance lines, so the rules between
them drew in the default rather than the band's own ink.

## The neighbour that solved this months ago

`wizeworks/apps/site` hit this and wrote the reason down, in the header of
`packages/silica-catalog/src/base-theme.css`:

> registration and value are two different jobs … Tailwind's namespaced color
> utilities — `ring-primary`, `ring-offset-base-100`, `from-primary`,
> `divide-base-300` — only generate for colors declared in `@theme`.

and again in its own `globals.css`:

> **silicaui's `@plugin` emits its own `bg-`/`text-`/`border-` classes … but
> registers nothing in Tailwind's theme namespace, so those namespaced utilities
> need this.**

The tenant site declares its keys and everything works there. The consoles never
got the second half. [[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

An `@theme inline` block in each app's `globals.css`, immediately below the
`@plugin` list it mirrors — one line per registered name.

`inline` is what makes the self-reference honest: Tailwind puts
`var(--color-module)` straight into the utility instead of deciding a value, so
the block **adds the missing utilities and contributes no color**. The brand's
palette stays the only place a color is chosen, and a subtree that repoints
`--color-module` (`data-app`, `data-group`, `data-module`) still wins — so a ring
drawn this way follows whichever app the pane belongs to, exactly as its
background already does. The same file already uses that shape for
`--font-sans: var(--font-sans)`.

Seven apps now carry the block. `wizeworks/apps/site` was left alone: it already
declares its keys through `base-theme.css`.

**Not one call site changed.** `ring-module` was the right thing to write; it
simply had nothing behind it.

## Confirming it

The dev server caches its compiled stylesheet, so this was proved by compiling
the real `globals.css` with the same Tailwind the app runs (4.3.0):

```
WITHOUT the @theme block: .ring-module rules = 0
WITH    the @theme block: .ring-module rules = 1
                          .ring-module { --tw-ring-color: var(--color-module); }
```

and on the live page, before the dev cache went stale:

```
ring drawn: rgb(131, 185, 183)     --color-module: #83b9b7
```

`bg-module` still carries silica's `--u-accent` and `--u-accent-content`, so no
component lost its ink.

**The running dev server still serves the old stylesheet.** A restart picks it
up; nothing else is needed.

## Guard

`scripts/check-silica-color-utilities.mjs`, wired into `pnpm check:silica-colors`
and the pre-push hook.

It does not look at class names at all, which would only ever catch the spellings
somebody has already written. It reads **both lists out of each app's own CSS**
and fails on any name in one and not the other — so every utility family is
covered at once, including the ones nobody has reached for yet.

It also refuses to run blind: a missing `globals.css`, a missing named import, or
a `@plugin` block whose shape has changed exits 1 rather than quietly scanning
less than it claims. [[feedback_structural_checks_go_blind]]

Proved red by deleting one line from one block:

```
check:silica-colors FAILED — colors registered but not declared.
  piggles/apps/workbench/app/globals.css  (1 of 39)
    add to its @theme inline block:  --color-module: var(--color-module);
```

## Upstream

This is a silicaui gap, not ours: when its plugin registers a color it should
register it in Tailwind's theme namespace too, and then all seven `@theme inline`
blocks and the check guarding them are deleted. Filed as **§3** in
`docs/silicaui/02-core-asks.md` against `@wizeworks/silicaui@0.55.0`.
