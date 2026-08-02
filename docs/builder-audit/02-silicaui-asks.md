# Builder audit — Wave 3, the upstream asks

Version: 2.0.0
Author: Brandon Korous
Last Updated: 2026-07-27

> **The register is [docs/silicaui/01](../silicaui/01-builder-asks.md), not this page.** The audit found
> eight things sparx cannot fix from the host seam; they are filed there, each naming the specific
> missing API, verified against `@wizeworks/silicaui-builder@0.35.0`. This page exists only to
> connect the audit's evidence to that register — it deliberately does not restate the asks, so
> there is one place they can drift from.
>
> ([Doc 119](../119-silicaui-builder-gap-questions.md), the previous register, is superseded — it
> was written against 0.8.0 and its framing decision has since been executed.)

---

## What went upstream, and why it had to

| # in 139 | Ask                                       | Why the host can't do it                                                                                                             |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Per-breakpoint authoring                  | Inspector chips write unprefixed classes; `setToken`/`activeIn` are private; `setClass` takes a whole string. No interception point. |
| 2        | Canvas fidelity for viewport variants     | The device toggle is `style.maxWidth` on a plain div, not an iframe — `md:` resolves against the window.                             |
| 3        | Multi-select                              | `Editor.selection` is `string \| undefined` and every mutation is single-id.                                                         |
| 4        | Alignment guides, nudge, select-parent    | No canvas geometry seam; `useEditorShortcuts` has no arrow keys.                                                                     |
| 5        | Per-page frame selection                  | `Site.frame` is singular; a chrome-off landing page is unrepresentable.                                                              |
| 6        | Richer image node (`srcset`, focal point) | `toHtml` emits `src` only; emission must live in the shared projector or canvas and storefront diverge.                              |
| 7        | Q22 / Q26 carried forward from 119        | Q26 re-verified open at 0.35.0; Q22 not re-checked.                                                                                  |
| 8        | The `eyebrow` part in two shipped blocks  | Ships into tenant sites by default via the standard Insert palette; conflicts with RULE #2.                                          |

## What this changes about the sparx-side plan

Nothing blocks on it. Every slice in Waves 1, 2 and 4 of [01-roadmap.md](01-roadmap.md) is
host-side and independently shippable. Two couplings are worth holding in mind:

- **Roadmap slice 6 (one responsive vocabulary) is ours and lands first.** Sweeping the catalog
  onto container queries makes the device toggle honest for sparx's own content without waiting for
  ask 1 or 2 — and when ask 1 does land, the breakpoint UI has one axis to author against instead
  of two.
- **Roadmap slice 20 (image pipeline) is half ours.** sparx generates the width variants; ask 6 is
  what makes them reach the page. The generation work is worth doing first regardless — the assets
  are useful the moment the emission exists.

Related: [00-README.md](00-README.md) · [01-roadmap.md](01-roadmap.md) · [docs/silicaui/01 — the register](../silicaui/01-builder-asks.md)
