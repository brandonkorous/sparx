# 04 — Phase 4: The Inspector as a full design surface

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-14

> The product bar is **"full Tailwind-level design control for every element."**
> Today the Inspector reaches ~70–75% of that surface from the UI; the rest is
> raw-class-only or impossible, full skin/state editing is component-builder-only,
> and the raw-class escape hatch doesn't round-trip with the structured controls
> ([evaluation Finding 2, §5](../evaluations/builder-eval-findings-2026-06-14.md)).
> This phase completes the control set, makes the advanced surface reachable on
> **every** surface (per breakpoint and per state), and reconciles the raw-class
> hatch with the structured controls — while keeping the common section simple.
>
> This phase is engine-level: it improves the inspector regardless of shell, so it
> can proceed in parallel with [03](03-unified-builder-shell.md) once
> [02](02-canvas-live-renderer-unification.md) lands (the canvas must render real
> components for hover/state edits to show truthfully).

## 1. The problem

The Inspector is well-architected — a `ClassControl` registry
(`_builder/class-controls.ts`) + cards in `_builder/inspector.tsx`, with a
`ContextSelect` ([inspector.tsx:548](<../../apps/dashboard/app/(dashboard)/builder/_builder/inspector.tsx>))
that re-targets controls per context. But the surface has holes
([evaluation §5](../evaluations/builder-eval-findings-2026-06-14.md)):

**No structured control on any surface (raw-class-only or impossible):**
text-decoration, truncate/line-clamp, whitespace/word-break, color **opacity**,
flex-wrap, flex grow/shrink/basis, order, grid-rows, grid-auto-flow,
justify-items, align-content, independent row/col gap, background **gradient /
image / size / position / repeat**, per-side border width, per-corner radius,
filters (blur/brightness/…), backdrop-filter, ring, mix-blend, shadow color,
transform skew / origin, transition duration / delay.

**Gated to the component builder:** the **Appearance** card — free background/text
color, full per-**state** (hover/focus/active/dark) and per-**breakpoint** _skin_ —
is not shown on the page/site builder (`inspector.tsx:2639`), so a page-builder
power user can't set a hover color or a per-breakpoint background from the UI.

**The escape hatch fights the controls:** the Custom CSS card edits `node.class`
directly with no reconciliation; typing `text-primary` there and then using a
structured color control produces a silent conflict (Finding 10).

## 2. Decisions

**2.1 Fill the control set to 100% of the practical Tailwind surface.** Add the
missing `ClassControl`s, grouped into the existing/added cards. Most are small
enum or length controls. Priority order (impact-first):

1. **Typography:** text-decoration, truncate/line-clamp, whitespace, color-opacity.
2. **Layout:** flex-wrap, grid-rows, grid-auto-flow, justify-items, align-content,
   independent row/col gap; (child-level grow/shrink/basis/order via a "Child
   layout" affordance when a flex/grid child is selected).
3. **Backgrounds → new "Background" subgroup:** gradient (direction + stops),
   image, size/position/repeat. (Image respects the existing security allowlist —
   reference a media asset, not an arbitrary URL.)
4. **Effects → new "Effects" subgroup:** filters (blur/brightness/contrast/…),
   backdrop-filter, ring, mix-blend, shadow color.
5. **Borders:** per-side width, per-corner radius.
6. **Transforms / transitions:** skew, transform-origin, duration, delay.

**2.2 The advanced surface is reachable on every surface.** Add an **Advanced**
disclosure to the page/site builder's Style that exposes the same
`SKIN_CONTEXTS`-driven controls (free color/type, per-state, per-breakpoint _skin_)
that the component builder has. The common recipe (Color/Emphasis axes) stays the
**default**; Advanced is the _escape from the ceiling_, not the default. This
directly satisfies "the common surface is never the ceiling."

**2.3 Per-breakpoint and per-state work everywhere via `ContextSelect`.** The
mechanism already exists (`ARRANGEMENT_CONTEXTS` for layout, `SKIN_CONTEXTS` for
skin; container-query breakpoints `@sm`/`@md`/…, [61](../61-utility-authoring-system.md)).
Phase 4 _exposes_ it on every card that takes responsive/state input, not just
Layout and component-Appearance. Keep container-queries (node-width based) as the
model — it's the right call for a component-composed builder; just make sure the
UI labels read clearly ("when this block is ≤ medium").

**2.4 Reconcile the raw-class hatch with the structured controls.** The Custom CSS
card stays (the ultimate hatch), but:

- On read, **parse** `node.class` and reflect recognized tokens back into the
  structured controls (so the hatch and the controls show the same truth).
- On a structured edit, rewrite only that token group, preserving unrecognized
  raw classes.
- Detect tokens in the raw field that **conflict** with a structured group and
  warn inline.
  This turns the hatch from a one-way trapdoor into a round-tripping power tool.

**2.5 The two-tier split is explicit and consistent.** Common (open by default):
Content, Style recipe (Color/Emphasis), Layout essentials, Motion. Advanced
(disclosure): Size/Spacing/Position/Typography/Borders detail, the Effects/
Background subgroups, per-state/per-breakpoint skin, Custom CSS. The split is the
same on page/site/component surfaces (component adds nothing the page can't reach).

**2.6 Arbitrary values stay first-class.** Length/value fields keep their
"Custom…" arbitrary mode (`[…]`), and it round-trips through the value-group
storage. New controls that take a value (filters intensity, ring width, gradient
stops) follow the same `LengthField`/value-group pattern so arbitrary works
uniformly.

## 3. Work breakdown

| Step | Area                           | Change                                                                                                                                                  |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `class-controls.ts`            | Add the missing `ClassControl`s (2.1), grouped; reuse the enum + `LengthField` patterns; arbitrary-value support where relevant.                        |
| 2    | `inspector.tsx`                | New **Background** + **Effects** subgroups; per-side border / per-corner radius; wire each new control into the right card.                             |
| 3    | `inspector.tsx`                | **Advanced** disclosure on page/site Style exposing `SKIN_CONTEXTS` controls (free color/type, per-state, per-breakpoint skin).                         |
| 4    | `inspector.tsx`                | Surface `ContextSelect` on every responsive/state-capable card; clarify breakpoint labels.                                                              |
| 5    | `class-controls.ts` / new util | Raw-class **parser + reconciler** (2.4): read-back into controls, conflict detection, preserve-unknown on write.                                        |
| 6    | Custom CSS card                | Inline conflict warning + optional "pull into controls".                                                                                                |
| 7    | (verify)                       | For Section/Grid/Stack, a text leaf, an image, a button, and a data-aware node, confirm each Tailwind group in §5's table is now reachable from the UI. |

## 4. Acceptance criteria

- The §5 reachability table from the eval flips: every listed group is reachable
  from the UI (common or advanced), on page/site/email surfaces — not raw-class-only.
- A page-builder user can set a **hover** background and a **per-breakpoint** column
  count and a **gradient** from the UI, with no node selected in the component
  builder.
- Editing a property via a structured control updates the raw class; editing the
  raw class reflects back into the structured control; conflicts are flagged.
- The common section for a typical node is unchanged in weight — advanced controls
  are behind a disclosure, not crowding the default view.
- Arbitrary `[…]` values work in the new value controls and round-trip.

## 5. Risks & notes

- **Don't drown the common user.** The win is _reachability without clutter_. Keep
  Advanced collapsed; resist promoting niche controls into the default view.
- **Compile/allowlist coverage.** New utilities must be in the per-tenant
  compile's allowlist ([61](../61-utility-authoring-system.md)); gradients/filters/
  arbitrary values especially — a control that emits a class the compiler drops is
  worse than no control. Verify each new token compiles.
- **Security: background-image + arbitrary.** Background image must reference a
  media asset (existing allowlist), not an arbitrary `url()`; keep the
  arbitrary-value guard (e.g. z-index/`url()` restrictions) intact.
- **The reconciler (2.4) is the subtle part.** A lossy parser that silently drops a
  raw class on round-trip is a data-loss bug; "preserve unknown" must be exact.
  Test with hand-written class strings.
