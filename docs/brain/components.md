---
title: Components & Surfaces
type: map
status: active
---

# components

If [[design]] is the *language*, this node is the *library and the layouts*. Appearance lives here so feature code never reinvents it — the partner pages proved that when the library is used right, the surface is mostly right.

## The two rules that prevent most drift

- [[appearance-lives-in-ui]] — feature code composes `@sparx/ui`, never re-skins a control.
- [[four-axis-variants]] — every control is `color × variant × size × shape`, never a flat enum.

## Surfaces — forms, details, pages

- [[surface-frame]] — the ONE layout language for every create/edit/detail surface.
- [[three-registries-footgun]] — the wiring that silently breaks "New" with a green typecheck.
- [[page-archetypes]] — the six working-area archetypes + three content widths.
- [[stat-is-the-metric]] — every prominent number is a `<Stat>`, never hand-typeset.
- [[in-console-document]] — the *missing* pattern the partner pages needed (presentational content inside the console).

## Storefront

- [[builder-catalog]] — the data-driven site-builder catalog (a separate design system — [[two-design-systems]]).

## Sources of truth

`packages/ui/` (the components + `packages/ui/CLAUDE.md`) · `docs/23-frontend-component-architecture.md` (contract) · `docs/35-ui-variant-system.md` (variants) · `docs/86-surface-frame-pattern.md` + the `form-surface` skill (surfaces) · `docs/34-dashboard-working-area-standard.md` (archetypes).

## Migration status

Docs 23 / 35 / 86 / 34 are being absorbed **graduated-per-node**: their durable rules are atomized into the notes above; the docs get slimmed to linked references once this node is verified complete. Tracked in [[tasks]].
