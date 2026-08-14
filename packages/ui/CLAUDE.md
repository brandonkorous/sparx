# packages/ui — @sparx/ui composition library

Scoped guidance for the platform component library. Loads when working in `@sparx/ui`. See root [CLAUDE.md](../../CLAUDE.md) "Brand & design" for the binding rules that apply everywhere; this file is the build mechanics. Sibling: `@sparx/site-ui` (the legacy tenant site component library, now themed by silica tokens directly).

## What `@sparx/ui` is now (post-silicaui migration)

The dashboard design system runs on **silicaui** (`@wizeworks/silicaui*`). The old hand-rolled styling layer (the `.sx-c-*` role-var recipe + the `--sparx-*` / `--color-bg-*` / `--color-surface-*` tokens) is **gone**.

- **Styled primitives come from `@wizeworks/silicaui-react`.** Feature code in `apps/*` imports `Button`/`Badge`/`Card`/`Input`/`Select`/`Table`/`Tabs`/`Dialog`/`Alert`/… directly from there. The `@wizeworks/silicaui` Tailwind plugin (wired in each app's `globals.css` via `@plugin '@wizeworks/silicaui' { colors: … }`) statically emits every color + component utility (`.btn-*`, `.badge-*`, `.alert-*`, `bg-primary`, `text-base-content/70`, `bg-soft`, `status-*`, `checkbox-*`, …).
- **`@sparx/ui` is now 22 modules and a 32-name export surface.** That is the whole package. It is **not** a component library and must not be grown back into one. What is left: `cn` / `cva`, the `variants.ts` vocabulary, `ModuleProvider`, `useTheme` / `useMediaQuery`, the brand wrappers (`Wordmark` / `SparxMark` / `AppIcon` / `MadeWithSparx`), five kept primitives (`Button`, `Badge`, `Heading`, `Text`, `Spinner`), `Card`, `Stack`, `PageHeader`, `SidebarAppShell`, `Tooltip`, `ConfirmProvider` / `useConfirm`, `toast` / `Toaster`, `TopProgress`, and `Table`. The kept primitives paint nothing — they resolve the sparx four-axis props onto silica's plugin classes.
- **If silicaui ships it, `@sparx/ui` does not.** A sweep on 2026-08-01 deleted 21 duplicates — `Avatar`, `Skeleton`, `ButtonGroup` (→ silica `Join`), `Accordion`, `Divider`, `ScrollArea`, `ContextMenu`, `Popover`, `CommandPalette`, `Tabs`, `Sidebar`, `Breadcrumb`, `Pagination`, `Stepper` (→ silica `Steps`), `NavigationMenu`, `Kbd`, `Alert`, `Stat`, `Timeline`, `AlertDialog`, `Drawer` — all Radix/cmdk re-skins of components silica already shipped, all with zero consumers. The apps had already voted: 176 live `<Alert>` call sites resolve to silica's, none resolved to ours. Before adding anything here, run `list_components` — a name that exists on both sides is drift by construction.
- **The dashboard-era compositions are gone too, and that is the more important deletion.** `SurfaceFrame`/`SurfaceStep`/`SurfaceSummary`, `ListToolbar`, `ListPageShell`, `SelectionList`, `BulkActionBar`, `FilterBar`, `ActionTile`, `BarList`, `Tag`, `StatusDot`, `Pager`, `DataTable`, `ImportDialog`, `ExportButton`, `EmptyState`, `Modal`, `DropdownMenu`, `Grid`, `Container`, `Code`, `AuthFrame`, `BrandRail`, `ProductTour`, `RichTextEditor`, `FormActionBar`, `SchemaFieldRenderer` and the `recharts` wrappers were **not** silica duplicates — they were the `apps/dashboard` design language. At that app's final commit they were load-bearing (`SurfaceFrame` 107 files, `SelectionList` 86, `ListToolbar` 78, `ListPageShell` 70); the workbench cutover orphaned every one, and `apps/workbench` deliberately **rebuilt** each concept in its own idiom (`pane-toolbar`, `list-pagination`, `list-empty-state`, `form-section`, `lib/tour/`) per its "build it, don't port it" rule. Do not resurrect them here — a workbench-shaped need belongs in workbench, and an admin-shaped need belongs in `apps/admin`.
- **Deleting them retired ten dependencies**: `@tanstack/react-table`, all five `@tiptap/*`, `recharts`, `driver.js`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`. `@sparx/ui` now pulls only `@radix-ui/react-slot` + `-tooltip`, `@base-ui-components/react`, silicaui, cva/clsx/tailwind-merge, lucide and `tw-animate-css`.
- **Color source of truth is `@sparx/brand/theme.css`** — `--color-base-100/200/300`, `--color-base-content`, the semantic palette (`--color-primary/secondary/accent/neutral/info/success/warning/error/danger` + each `-content`), and the 18-module palette `--color-module-<name>` (+ `-content`). `packages/ui/src/tokens.css` now holds **only non-color tokens** (type / space / radius / shadow / motion) + the `--chart-*` palette + a little component CSS.

## Emitting silica classes from a kept primitive

The rewritten primitives map the sparx four-axis props onto silica classes rather than building CSS:

- **Plugin-color controls** (Button/Badge/Alert/Tag/StatusDot/Progress): `<Button color variant size>` → `btn btn-<color> btn-<variant> btn-<size>`. Variant vocabulary: `solid` (bare), `soft` (`btn-soft`), `outline` (`btn-outline`), **`dashed` → `btn-dash`** (silica spells it `dash`), `ghost` (`btn-ghost`), `link` (`btn-link`). `buttonClasses({ color, variant, size })` is the exported helper (replaced the old `buttonVariants`).
- **The whole form tier is silicaui's, not ours.** `Input` / `Textarea` / `NativeSelect` / `Select` / `PasswordInput` / `Combobox` / `Calendar` / `DatePicker` / `ColorPicker` / `FileUpload` / `Label` are **NOT exported from `@sparx/ui`** — import them from `@wizeworks/silicaui-react`. Each had a hand-rolled twin here that rebuilt the identical chassis out of utilities — `bg-base-100 flex w-full rounded-md border`, an `h-8`/`h-9`/`h-10` size ramp, a `hover:border-[color-mix(…)]`, a `focus-ring`, and `error`/`success` variants that pinned a border color and a ring color separately. silica's `.input` / `.select` / `.textarea` already carry every one of those, and carry them _better_: one `--input-accent` drives the focused border AND the ring together, so `<Input color="error">` can't half-apply the way two independent classes could. The twins are deleted. **Workbench never used them** — it imports silica's directly, which is why it is the reference implementation for any form surface.
- **Validation is silica's `Field`, not a hand-built error row.** `<Field status="error" statusMessage="…">` resolves the control's accent, its trailing icon, and the message panel from one prop pair; `FieldLabel` (takes `required`) / `FieldDescription` / `FieldStatus` complete the row, and Base UI wires the ids + `aria-describedby` + validity between them. `FieldStatus` takes `attached={false}` for checkbox/switch/radio rows (no bordered control for a flush panel to sit under) and `floating` when the message must not push sibling fields as it appears. The old shadcn-shaped react-hook-form adapter here (`Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`/`useFormField`) reimplemented exactly that wiring, had zero consumers, and is **deleted** — pair RHF's own `<Controller>` with `<Field>` instead. `SchemaFieldRenderer` is the worked example.
- **Never put `focus-ring` on a silica control.** Every silica component rings itself — `.btn`, `.input`, `.select`, `.textarea`, `.checkbox`, `.tabs` and friends all carry `outline: var(--focus-width, 2px) solid var(--<part>-accent, var(--color-primary))` with `outline-offset: var(--focus-offset, 2px)`. The `focus-ring` / `-success` / `-danger` / `-within` utilities in `@sparx/brand/theme.css` exist for the shapes silica does **not** style: a `tabindex="0"` card, a bare `<button>` icon target, a rail link, a contenteditable frame. On anything else it is a redundant second ring.
- **Selection controls are silicaui's too.** `Checkbox` / `Switch` / `RadioGroup` / `Slider` / `Progress` are **NOT exported from `@sparx/ui`** — import them from `@wizeworks/silicaui-react`. They were once hand-rolled here on Radix, because a Radix control couldn't take a plugin color class and so drove its accent off a per-instance `--sx-sel` / `--sx-sel-fg` custom property. silicaui now ships all five with real `checkbox-<color>` / `switch-<color>` / `progress-<color>` classes, which made that whole mechanism — the last parallel token vocabulary in the repo — redundant. It is gone; `colorVars()` with it. Never reintroduce it.
- **`useConfirm` is a composition over silica's imperative alert dialog, not a dialog.** `ConfirmProvider` mounts silica's `ImperativeAlertDialogProvider`; `useConfirm` wraps `useImperativeAlertDialog`. It keeps exactly two sparx decisions and paints nothing. First, **the continuation runs outside the dialog's close commit**: silica resolves the promise synchronously inside a `flushSync`, so a caller that fires `mutate()` or `toast()` next lands that work inside the commit and React rejects it ("flushSync was called from inside a lifecycle method") — awaiting one macrotask makes it legal, and workbench proved the fix first in its own `lib/confirm.ts`. Second, **a confirm defaults to `color: 'danger'`**, because here a confirm guards a destructive action unless it says otherwise. The option is `color` and takes any registered silica color — it replaced a 3-value `tone` enum (`danger`/`warning`/`module`), which is why the confirm button no longer needs `buttonClasses(...)` painted onto it.
- `_recipes/variants.ts` is now pure vocabulary — `COLOR_KEYS`, `MODULE_COLOR_KEYS`, `TREATMENT_KEYS`, the `ColorKey` type, and `pluginColor()` (a slot name → its silicaui plugin color name, i.e. `commerce` → `module-commerce`). The old `colorClass` / `treatmentVariants` / `chipTreatmentVariants` / `colorVars` are deleted.
- **`indeterminate` is a DOM property with no HTML attribute**, so a tri-state checkbox needs a callback ref (workbench's inventory reorder list is the live example). silicaui styles `:checked` but not `:indeterminate` (still true at 0.44; a fix is coming upstream), so such a checkbox paints as UNCHECKED. One rule closes it, in **`@sparx/brand/silica-gaps.css`** — read that file's header before adding anything to it. It lives in `@sparx/brand`, not here, because **workbench imports no `@sparx/ui` CSS at all** and workbench is where it bites; a rule added to `tokens.css` would silently miss the only app that needs it.

### The one patched dependency

`@base-ui-components/react@1.0.0-rc.0` is **patched**
(`patches/@base-ui-components__react@1.0.0-rc.0.patch`, wired through `pnpm.patchedDependencies` in
the root `package.json`). It is the only patched package in the repo, and it exists for one bug:
`ToastRoot.recalculateHeight` wraps its state update in `ReactDOM.flushSync`, and two of its call
sites are layout effects — its own, and `ToastContent`'s. React is already inside the commit phase
there, refuses to flush, and logs _"flushSync was called from inside a lifecycle method"_ **once per
toast, per render**. Three toasts, three errors; a busy surface buries its real errors under them.

The patch adds a depth counter to `ToastRootContext.js` (the one module both files already import,
so nothing gains a dependency edge), marks the two layout-effect paths, and skips the flush while
the counter is set. **The observer paths keep it** — `ResizeObserver` and `MutationObserver` fire
asynchronously after paint, where the flush is what stops the stack visibly jumping. Skipping it in
a layout effect changes nothing observable: React already re-renders a layout-effect `setState`
synchronously before paint, which is the whole thing the flush was buying. Both the `esm/` and CJS
builds are patched; they ship as separate copies and Next resolves the ESM one.

**A patch is invisible until it silently stops applying** — a version bump, a lockfile
regeneration, a merge that drops the `patchedDependencies` block.
`src/components/overlay/toast.test.tsx` is what notices: it asserts nothing logs `flushSync` when a
toast mounts, and it was proved red against the unpatched module before being accepted green. If it
fails, check the patch still applies (`pnpm why @base-ui-components/react` should show a
`_patch_hash=` segment) before touching the test. Delete the patch, the test and this section
together when the fix lands upstream — `rc.0` was the newest published version on 2026-08-13.

### The `cn()` tailwind-merge footgun

`@sparx/ui`'s `cn` uses `extendTailwindMerge` to register `soft` / `bg-soft` / `text-soft` / `border-soft` as their own class groups. Default tailwind-merge classifies them as color utilities and would **strip the preceding `bg-<color>`** from `bg-module bg-soft`, silently dropping the hue. Never swap `cn` back to a bare `twMerge`.

## Tints = the universal `soft` treatment (never a baked value)

A tint is ALWAYS `<color> + soft`, never a hardcoded color. silicaui's `bg-soft` paints `color-mix(in oklab, <current accent> 15%, base)` — theme-aware, computed once, can't drift. Layer it on any color: `bg-module bg-soft`, `bg-success bg-soft`. There are **no baked `-tint` / `-text` tokens** anymore.

## Module color shifting

`<ModuleProvider module="…">` renders **`data-module="…"` and nothing else**. The attribute → `--color-module` + `--color-module-content` mapping lives in `@sparx/brand/theme.css`'s "module bridge" block, so the component knows a module's NAME and never its colour. It is a **Server Component** — it holds no context and needs no client boundary.

It used to carry a 19-entry hex table and push two values onto an inline `style`. That table had drifted to `#ffffff` for sixteen of the nineteen `content` inks, and because an inline style beats any selector it overrode the correct theme.css values on every screen inside a provider: `btn-module` measured **2.80:1** on Commerce orange where `badge-module-commerce`, reaching the real token, measured **5.58:1**. Never reintroduce a colour table here — a second copy of the palette is a second thing to keep in sync, and this is what happens when it isn't.

Everything beneath the attribute re-tints with no props: `color="module"`, `bg-module bg-soft`, `text-module`, `hover:border-module`. Brand provides a `:root` default `--color-module: var(--color-primary)` so those degrade to indigo outside any provider. Per-module hues are **not** registered as named silica colors (only `module` + `danger` are the sparx extras in the plugin `colors` list, by design) — to color for a specific module you wrap in its provider, you don't reach for a `bg-module-<name>` class.

## Surface elevation model

Depth is a **3-level base ramp** plus content: `--color-base-200` (page ground) → `--color-base-100` (the lifted reading surface / cards) → content (module-tinted card, semantic callout, `--color-neutral` inverse panel), with media forward-most. The corner-wrap cascade still applies — each level's rounded corners reveal exactly one level beneath, so stacking reads as physical depth.

Rules:

- **Elevation ≠ intensity.** Inside the content layer, color runs neutral → soft tint (`bg-<color> bg-soft`) → full solid. That saturation axis is **orthogonal** to elevation.
- **Color carries the depth**; reach for a hairline (`border-base-300`) or soft shadow only where a step is too subtle to read.
- Light values get **darker with depth**; dark theme inverts. `--color-base-100` is always the topmost reading surface in both themes.
- The high-contrast inverse accent panel is `--color-neutral` (theme-aware; flips light↔dark).

## Four-axis variant system (color × variant × size × shape)

Every color-bearing component is **four orthogonal axes** — never a flat enum. `primary` / `success` are **colors** (`color=`), not variants; variants are `solid | soft | outline | dashed | ghost | link`. `<Badge color="commerce" variant="soft">` is legal precisely because the axes are independent. Resolution is now silicaui's plugin-emitted classes (see "Emitting silica classes" above), not the old `.sx-c-*` role vars. See [docs/35](../../docs/35-ui-variant-system.md).

## Non-obvious house decisions

- Sparx primitive APIs are unchanged across the migration — this is a mechanism swap, not an API break. `asChild` → Base UI's `render={<a … />}` in the silica primitives.
- `'use client'` is applied **selectively**, only where interactivity needs it.
- `declaration: false` in tsconfig — no `.d.ts` emit; consumers read source types via project references.
- The ESLint rule flags the **fill + foreground fingerprint** (a background fill paired with a foreground text color, or hand-built `hover:`/`focus:`/`disabled:` states) — that's re-skinning a control. It does **not** flag raw layout/spacing utilities. Fix: use the `@wizeworks/silicaui-react` primitive / its variant; add to `@sparx/ui` only for a genuine composition.
- **`<Card variant="module">` = `bg-module bg-soft` inside a `<ModuleProvider>`** — its whole background is the active module's theme-aware soft tint (silica `bg-soft`, ~15% `color-mix` into `--color-base-100`), text/border untouched. There is no top stripe. To color a card, wrap the panel in its `<ModuleProvider module="…">` — the tint follows automatically (and colors the panel's buttons/badges too). The `accent` prop is the **escape hatch** for a one-off color with no surrounding provider — it names a different plugin color (`bg-module-commerce bg-soft`), and so resolves only in an app that registered the full module palette (workbench + web; admin and site register `module` alone).
- **On a dense cross-module page, tint ONE card per module hue** — the section's "primary" card — and leave the rest plain. A whole page of tinted cards is competing washes, not wayfinding. `OverviewCard` exposes a `plain` prop for the neutral opt-out.
- **Single-module working surfaces use neutral cards — NOT the module tint.** Create/edit forms, wizard steps, and editable detail panels are one module by definition, so the tint differentiates nothing there; identity comes from the frame chrome, the `color="module"` Save button, and the faint module-tinted `SurfaceFrame` summary rail. **Exception:** a read-only detail/transaction view (order, quote, invoice, b2b account) may keep ONE tinted KPI/accent card as its lone module cue.
- **Tints are theme-aware because `bg-soft` computes them at render** — never hand-pick a per-module light hex as a raw background/text (it won't adapt to dark mode, the historical bug that broke nav active states and stat chips). Use `bg-module bg-soft` / `text-module`.

## The wordmark

The sparx wordmark renders with the **"x" always in sparx Ember `#e04631`** — the brand primary (`--color-primary`) — never one solid color. Geist 500, tracking `-0.03em`.

This previously read "sparx Indigo `#6366F1`". That is **wrong and out of date**: the wordmark "x" and the Builder module hue SPLIT. Ember is the brand primary; Indigo `#6366f1` is now only `--color-module-builder`. The code is the authority — [packages/brand/src/marks.ts](../brand/src/marks.ts) `BRAND.primary = '#e04631'`, commented "the primary brand color and the wordmark 'x'", with `builder: '#6366f1'` as a separate module entry.

**Never re-inline the art or the "x" hex.** The mark/wordmark/mascot geometry and the `BRAND` constants live in `@sparx/brand` ([marks.ts](../brand/src/marks.ts)); the React components (`Spark`, `AppIcon`, `Wordmark`, `SparkMascot`) come from `@sparx/brand/react`. `@sparx/ui`, market, and the marketing site all re-export from there — change the art in ONE place.

## Two marks, not one

The 2026-07 refresh retired the four-lobed spark glyph. What replaced it is **two** distinct marks that must not be swapped for each other:

- **`<Spark>`** (alias `<SparxMark>`) — the "x" standing alone, one color, on transparency. `SPARK_PATH`. This is the INLINE glyph: a bullet, an avatar, a stand-in wherever the wordmark would fall below 16px. Optically centred in its viewBox, so it needs no caller-side nudging at 20–24px.
- **`<AppIcon>`** — the favicon / install-tile lockup: a full-bleed field of `--color-primary` with the "x" **knocked out** of it, arms running off all four edges. `ICON_FIELD_PATH`. The letterform here is negative space, so this is one filled path, not a framed copy of `<Spark>`. Corners stay hard — every OS applies its own mask, and pre-rounding double-rounds on iOS/macOS.

The knocked-out counter is backed with **sparx ink** (`--color-secondary`) wherever the icon must be opaque, so a tab, an iOS home screen, and an Android tile all read identically. `counter="none"` gives a true knockout for a known surface (one-color press artwork).

**Static icon files are generated, never hand-edited.** [scripts/generate-brand-icons.mjs](../../scripts/generate-brand-icons.mjs) parses the geometry + hexes straight out of `marks.ts` and rewrites every favicon, app icon, PWA tile, and press asset across `apps/web`, `apps/workbench`, `apps/market`, `apps/site`, and `images/new/favicons/`. Change the artwork in `marks.ts`, run `node scripts/generate-brand-icons.mjs`, done — a hand-edit to any of those files is drift waiting to happen.
