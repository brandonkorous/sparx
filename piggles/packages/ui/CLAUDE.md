# CLAUDE.md — @piggles/ui

Piggles-specific compositions over silicaui. Binding for anything under
`piggles/packages/ui/`; where it is silent, [piggles/CLAUDE.md](../../CLAUDE.md)
and the root file still apply.

## This is NOT a component library

Reach for `@wizeworks/silicaui-react` first, always. If silicaui ships it —
Card, Button, Badge, Input, Select, Tabs, Dialog, Alert — it does not belong
here, at any size, for any reason.

`@wizeworks/ui` is the cautionary precedent: it grew into a component library, and
undoing that meant deleting most of it. The root file now carries an explicit
"must not be grown back into one". Same rule here, from day one.

## The admission test

**Does it contain a sentence a marketer would rewrite?** If yes, it is app
content and it stays in `apps/<app>/components/`.

| Belongs here                                   | Belongs in the app                         |
| ---------------------------------------------- | ------------------------------------------ |
| `Section` — four padding values and a radius   | `TheDay`, `InsteadOf`, `CloseBand`'s words |
| Chrome shared by two or more of the three apps | Anything with a headline in it             |

A second condition: it is used by more than one app, or copy-pasted more than
twice inside one. `Section` qualified on the second — five hand-rolled copies of
the same panel chrome across `sparx/apps/web`.

## Two footguns, both silent

**1. Tailwind does not scan this package.** It scans the app. Every consuming
app needs a line in its own `globals.css`:

```css
@source '../../../sparx/packages/ui/src/**/*.{ts,tsx}';
```

Three `../` reaches `piggles/packages`; four reaches the repo-root `packages`.
The wrong depth generates nothing, reports nothing, and the component renders
with no layout — the same trap that shipped the Piggles logo at the size of the
viewport.

**2. `rounded-section` needs a bridge.** `--radius-section` is declared inside
`[data-theme]`, which `@theme` cannot read, so each app re-declares it:

```css
@theme {
  --radius-section: var(--radius-section);
}
```

Without it the utility does not exist and every panel ships square.

Any new component that ships className strings inherits footgun 1. Anything that
reaches for a token declared inside `[data-theme]` inherits footgun 2.

## Shape

No build step. The package exports raw TypeScript from `src/` and Next
transpiles it, exactly as `@piggles/brand` and `@piggles/config` do. There is no
`dist`, nothing to version, and `private: true` means nothing to publish.
