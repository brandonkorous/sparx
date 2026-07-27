# silicaui migration — market pilot notes + rollout playbook

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-27

The `apps/market` migration off `@sparx/ui` and onto **silicaui** (`silicaui` CSS
plugin + `silicaui-react`), run as the deliberate first/simplest pilot to surface
the gotchas before the pre-launch big-bang across every surface (web, dashboard,
site, admin, b2b-portal). market was chosen because it imports **only**
`@sparx/ui` — no builder, no tenant theming, no CMS editor — so it isolates the
_plumbing_ of consuming silicaui from the _hard_ theming/builder problems.

Companion docs: [silicaui-site-ui-parity-spec.md](silicaui-site-ui-parity-spec.md)
(can silicaui render every tenant site?), and in the silicaui repo
`silicaui/docs/blocks-contract.md` + `silicaui/docs/builder-contract.md`.

> **Status:** code-complete and type-clean **modulo `pnpm install`**. silicaui +
> silicaui-react are npm deps at `^0.1.0`; until they're installed the only
> typecheck errors are `Cannot find module 'silicaui-react'` and the implicit-any
> cascade on `Input`/`NativeSelect` `onChange` handlers that lose contextual
> typing when the component resolves to `any`. Both clear on install. **Next
> step: run `pnpm install`, then `pnpm --filter @sparx/market typecheck && lint && build`.**

> **⚠️ Turbopack + pnpm gotcha (workspace prerequisite — applies to EVERY app).**
> Turbopack resolves CSS `@plugin`/`@source` from the **workspace root**, not the
> CSS file's package. With `shamefully-hoist=false`, an app-level pnpm dep is
> symlinked only into `apps/<x>/node_modules`, so `@plugin "silicaui"` throws
> `Can't resolve 'silicaui'` in `next dev --turbopack` even though the package is
> installed and `silicaui-react` (a JS import, resolved via Turbopack's JS graph)
> works fine. **This is NOT a silicaui defect** — node's resolver and plain
> `@tailwindcss/postcss` both resolve it; it's a pnpm-layout × Turbopack-CSS-
> resolution quirk. Fix lives in the root [`.npmrc`](../.npmrc):
> `public-hoist-pattern[]=silicaui*` (surgical, keeps `shamefully-hoist` off).
> **Requires a `pnpm install` to apply the hoist, then a dev restart.**

---

## 1. End-state architecture (what a silicaui-consuming app looks like)

Four moving parts, replacing the single `@sparx/ui` dependency:

1. **`silicaui`** (npm) — the Tailwind v4 CSS plugin. Loaded in the app's Tailwind
   entry with `@plugin "silicaui" { colors: … }`. Emits every component class
   (`.btn`, `.badge`, `.alert`, …) + design tokens via `addBase`.
2. **`silicaui-react`** (npm) — thin React components over those classes
   (`Button`, `Badge`, `Alert`, `Input`, …). Imported by feature code.
3. **The sparx theme** — [`apps/market/app/sparx-theme.css`](../apps/market/app/sparx-theme.css):
   a **named** silicaui theme `[data-theme="sparx"]` (+ `sparx-dark`) holding the
   standard `--color-{name}` / `--color-{name}-content` palette silicaui reads,
   plus derived `mx-*` chrome aliases. `<html data-theme="sparx">`.
4. **App-local glue** — the sparx-specific bits that were never design-library:
   [`sparx-brand.tsx`](../apps/market/components/sparx-brand.tsx) (Wordmark +
   SparxMark), a local copy of the chunk-reload guard, and
   [`lib/status.ts`](../apps/market/lib/status.ts) (statusTone/statusLabel).

   The chunk guard has since moved to [`@sparx/app-kit`](../packages/app-kit/) —
   see §5, and the cost of having kept it app-local, below.

`@sparx/ui` is fully severed — no import, no `transpilePackages` entry, no
Dockerfile COPY.

## 2. The reusable playbook (every app repeats these)

1. **Deps:** drop `@sparx/ui`; add `"silicaui": "^0.1.0"`, `"silicaui-react": "^0.1.0"`.
2. **CSS entry:** replace `@import '@sparx/ui/tokens.css'` + the `@source` of
   `@sparx/ui` src + the `@theme` color mapping with `@import './sparx-theme.css'`
   - `@plugin "silicaui" { colors: … }`. **No `@source` for silicaui-react.**
3. **Theme:** import the shared sparx theme (see §5 — extract to `@sparx/brand`).
4. **`<html data-theme="sparx">`** (was `data-theme="light"`).
5. **Cascade layers:** silicaui lands in `@layer base` (via `addBase`), NOT
   `components`. Register app chrome above it; keep the theme block + `html,body`
   paint UNLAYERED so they win (see §4).
6. **Components:** swap imports `@sparx/ui` → `silicaui-react`; apply the API
   deltas (§3).
7. **Glue:** relocate the non-design residue app-local (→ `@sparx/app-kit` in §5).
8. **Build wiring:** `transpilePackages: ['silicaui-react']`; remove the
   `@sparx/ui` Dockerfile COPY lines (silicaui is an npm dep, not a workspace
   COPY).

## 3. Component API deltas (`@sparx/ui` → `silicaui-react`)

| `@sparx/ui`                         | `silicaui-react`                                                                              | Notes                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Button asChild><Link/></Button>`  | `<Button render={<Link/>}>text</Button>`                                                      | Base-UI `render` composition, not Radix `Slot`. Children move onto the Button; the link's own children go away. **Most-repeated edit (~16 sites).**                                                  |
| conditional `asChild={cond}`        | `{...(cond ? { render: <Link/> } : {})}`                                                      | Spread the `render` prop only when polymorphic; otherwise a plain disabled `<button>`.                                                                                                               |
| `leftIcon` / `rightIcon`            | `iconStart` / `iconEnd`                                                                       |                                                                                                                                                                                                      |
| `color="danger"`                    | `color="danger"` (register the color)                                                         | silicaui ships `error`, not `danger`; sparx `statusTone()` emits `danger`. Register `danger` in the `@plugin colors:` list + pair `--color-danger`/`-content` in the theme. **No call-site change.** |
| `<Alert title="…">children</Alert>` | `<Alert><AlertContent><AlertTitle/><AlertDescription/></AlertContent><AlertActions/></Alert>` | Alert is compositional (like Card); no `title` prop.                                                                                                                                                 |
| `<Stepper steps={…} current={n}/>`  | `<Steps>{labels.map((l,i)=><Step color={i<=n?'primary':undefined}>{l}</Step>)}</Steps>`       | Data-driven → composition.                                                                                                                                                                           |
| `<Text variant="muted" size="md">`  | `<Text style={{color:'var(--color-text-secondary)'}}>`                                        | silicaui `Text` variants are `body`/`lead`/`caption` only (no `muted`/`size`).                                                                                                                       |

Straight import-only swaps (identical API): `Badge`, `Input`, `NativeSelect`,
`Heading` (`level`/`size`), `Text` (body).

**Not design-library — do NOT look for these in silicaui; relocate them:**
`Wordmark`/`SparxMark` (brand), `ChunkReloadGuard` (framework glue),
`statusTone`/`statusLabel` (domain logic).

## 4. Token-model + cascade discoveries

- **silicaui's token vocabulary is leaner than sparx's.** silicaui = `base-100/200/300`
  - `base-content` + 8 named colors (text hierarchy via opacity, daisyUI-style).
    sparx's chrome wants `--color-text-secondary/tertiary`, `--color-border-default/strong`,
    `--color-bg-subtle` — no 1:1 silicaui token. Resolution: the sparx theme defines
    the **standard silicaui palette as source of truth**, then re-expresses the old
    chrome names as a thin **derived alias layer** (`--color-text-primary: var(--color-base-content)`,
    secondary/tertiary via `color-mix` off `base-content`, etc.). No `mx-*` rewrite;
    silicaui owns the values; a `--color-primary` edit cascades into the chrome; dark
    mode adapts for free. A later pass can inline the aliases.
- **Standard `--color-{name}`/`-content` naming is the point** (not sparx's old
  off-standard names). Every colored silicaui object is generated from a
  `{name}`+`{name}-content` pair, so **adding a color = adding a pair + listing the
  name**. `danger` is the first instance. **Rollout:** the per-module colors
  (`commerce`, `cms`, `crm`, …) each become a **named silicaui color** in the
  `colors:` list — `.badge-commerce` generated dynamically, replacing the
  `sx-c-*` recipe classes in `packages/ui/src/tokens.css`.
- **Custom brand = a NAMED theme, not an override.** `[data-theme="sparx"]` sits
  alongside silicaui's built-in `light`/`dark`; no specificity war. Nested
  `[data-theme]` islands still work (relevant for the builder canvas later).
- **silicaui emits into `@layer base`** (via `addBase`, deliberately — so the
  Tailwind scanner can't tree-shake dynamically-built `btn-${color}` classes).
  So app chrome must register above `base`, and Tailwind utilities (top layer)
  still win. UNLAYERED rules beat any layer: the theme block + the `html,body`
  paint are unlayered, so sparx tokens and the `#fafafa` page canvas win over
  silicaui's base-layer `:root`/`[data-theme]` defaults.
- **No `@source` for silicaui-react** — its components emit only plugin-provided
  semantic classes, never internal Tailwind utilities, so there's nothing extra
  to scan (unlike `@sparx/ui`, whose CVA source had to be scanned).

## 5. Rollout — extract the shared packages FIRST

The pilot kept the theme + glue app-local to learn cheaply. Before the next app,
extract them so the brand is defined once:

- **`@sparx/brand`** — the `sparx-theme.css` (standard palette + module colors as
  named silicaui colors + derived chrome aliases, light + dark). Every app imports
  it; tenant sites override the same standard token names per-tenant (the
  `[data-theme]` island model the parity spec relies on).
- **`@sparx/app-kit`** — the framework/brand glue: `Wordmark`/`SparxMark`,
  `ChunkReloadGuard`, `statusTone`/`statusLabel`. This is the residue that proves
  `@sparx/ui` doesn't fully dissolve into silicaui — every app has a little of it.

**Outcome (2026-07-27).** Both landed, but split differently and — for app-kit —
a release too late. `@sparx/brand` absorbed the theme AND `Wordmark`/`SparxMark`
(brand marks belong with the brand, not with framework glue); `statusTone`/
`statusLabel` stayed in `@sparx/ui`, being design vocabulary rather than glue.
That left [`@sparx/app-kit`](../packages/app-kit/) holding the chunk-load guard
alone, extracted only after the delay had cost something real: the copies drifted
into four apps, the Next 16 upgrade moved the default bundler to Turbopack, and
the shared detector — written against webpack's wording — stopped matching. Every
app's stale-build recovery was dead in production for the whole of that window,
and each release dropped operators on a generic crash screen instead of the
"a new version is ready" reload it was built to show.

The lesson is narrower than "extract earlier". **Glue that duplicates is glue
whose failure is silent.** `Wordmark` drifting is visible on sight; a chunk-error
regex that no longer matches fails by doing nothing at all, in four places, only
on the deploys nobody is watching. Rank the extraction backlog by whether a stale
copy would announce itself — not by how much code it saves.

Then proceed to the harder surfaces (dashboard, site, the builder) where tenant
theming, the `[data-theme]` canvas islands, and the persisted `BuilderNode.class`
data all live — none of which market exercised. **A green market de-risks the
mechanics, not the hard half.**
