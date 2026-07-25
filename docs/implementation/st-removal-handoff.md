# Handoff: remove ALL `st-*` classes from the storefront (`apps/site`)

**Mission.** The tenant storefront (`apps/site`) currently renders through **two** design systems:

1. **Silica** — the builder-authored pages + the site chrome frame use silica plugin classes
   (`btn btn-primary`, `bg-base-100`, `text-base-content`, `card`, `badge`, …), themed per-tenant
   through the silica theme tokens (`--color-*`). This is the platform standard (root `CLAUDE.md`
   RULE #1).
2. **`@sparx/site-ui` (`st-*`)** — the React code-route components (product detail, cart, account,
   checkout, booking, search, chrome fallback, section renderers, …) use a **parallel** system:
   `st-btn`/`st-card`/`st-input`/`st-container`/`st-h1`/`st-muted`/… plus a `color × variant`
   recipe (`st-c-*` / `st-v-*`) themed through `--st-*` tokens.

**Goal: eliminate the `st-*` system entirely.** Every storefront surface must render on silica —
the same classes and `@wizeworks/silicaui-react` components the builder pages already use. When done,
`rg "st-[a-z]" apps/site` returns **zero** hits, and the storefront looks and themes identically
(both token sets are populated from the tenant theme today, so silica classes are already fully
tenant-themeable — see `packages/site-themes/src/tokens.ts`).

**Scale.** ~796 `st-*` occurrences across ~114 files. This is a re-platforming, not a cleanup — do
it **surface by surface**, verify each, commit each. Do not attempt one giant find-replace.

---

## Hard rules (root `CLAUDE.md` — do not violate)

- **RULE #1 — silica + Tailwind only.** Use `@wizeworks/silicaui-react` components and silica plugin
  classes (`btn`, `card`, `input`, `badge`, `alert`, `table`, `tabs`, `link`, …) + Tailwind layout
  utilities. Nothing else. Verify any class name you're unsure of with the **silicaui MCP**
  (`list_classes`, `list_components`, `get_component`) — never guess.
- **RULE #2 — no eyebrows / editorial formatting.** Don't introduce kicker labels, badges-as-labels,
  step numerals-as-decoration, uppercase micro-caps, dividers-as-decoration.
- **RULE #3 — `soft`/`muted`/`/opacity` is a deliberate signal, not a default.** Readable text gets a
  real ink (`text-base-content`). Never carry a faded ink on prose/labels a person must read. In
  particular, **`st-muted` on readable text → `text-base-content`**, NOT a faded silica token.
- **No inline `style` that paints a control. No hardcoded hex.** Colors come from silica tokens.
- **No shadows** as a visual device (`shadow-*`/`box-shadow`); separate surfaces with edges / base-tone
  shifts / radius. **No gradients.** Focus rings + silica internals excepted.
- **Preserve behavior exactly.** This is a STYLING migration. Do NOT change component logic, data
  fetching, state, props, event handlers, or copy. Markup/classes only. (One exception: the width
  fix below, which is the whole point of `st-container` → a real max-width.)

---

## The mapping (`st-*` → silica)

### A. Component swaps (import change)

`@sparx/site-ui` exports typed components; `@wizeworks/silicaui-react` exports the silica twins.
Swap the import and keep the same `color`/`variant`/`size` props where they exist (verify prop names
with the silicaui MCP `get_component`).

| `@sparx/site-ui`                                    | →   | `@wizeworks/silicaui-react`                           |
| --------------------------------------------------- | --- | ----------------------------------------------------- |
| `Button`                                            | →   | `Button` (`color` `variant` `size`)                   |
| `Input` / `Textarea` / `NativeSelect` / `FileInput` | →   | `Input` / `Textarea` / `Select` / `FileInput`         |
| `Label`                                             | →   | `Label`                                               |
| `Card` (+ parts)                                    | →   | `Card` / `CardBody` / `CardTitle` (or `card` classes) |
| `Badge`                                             | →   | `Badge`                                               |
| `Alert`                                             | →   | `Alert`                                               |
| `Table` / `Tabs` / `Checkbox` / `Radio` / `Switch`  | →   | same names                                            |

`booking-widget.tsx` already imports `Button/Input/Label/Alert` from `@wizeworks/silicaui-react` — use
it as the reference for the target style.

### B. Raw class map (when a plain element carries `st-*`, not a component)

| `st-*` class                                                       | →   | silica                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `st-btn` + `st-c-{color}` + `st-v-{variant}` + `st-btn--sz-{size}` | →   | `btn btn-{color} btn-{variant} btn-{size}`                                                                                                                                                          |
| `st-input`                                                         | →   | `input`                                                                                                                                                                                             |
| `st-textarea` / `st-select` / `st-checkbox` / `st-radio`           | →   | `textarea` / `select` / `checkbox` / `radio`                                                                                                                                                        |
| `st-card`                                                          | →   | `card` (body content in a `card-body`)                                                                                                                                                              |
| `st-card__title`                                                   | →   | `card-title`                                                                                                                                                                                        |
| `st-badge` (+ `st-c-{c}`)                                          | →   | `badge badge-{c}`                                                                                                                                                                                   |
| `st-alert` (+ `st-c-{c}`)                                          | →   | `alert alert-{c}`                                                                                                                                                                                   |
| `st-link`                                                          | →   | `link` (+ `link-primary` / `link-hover`)                                                                                                                                                            |
| `st-table` / `st-tabs`                                             | →   | `table` / `tabs`                                                                                                                                                                                    |
| `st-h1` / `st-h2` / `st-h3` / `st-h4`                              | →   | `text-4xl` / `text-3xl` / `text-2xl` / `text-xl` + `font-semibold text-base-content` (match the sizes the silica builder pages use)                                                                 |
| `st-muted` / `st-text-muted` (on **readable** text)                | →   | `text-base-content` (RULE #3)                                                                                                                                                                       |
| `st-text` / `st-text-secondary`                                    | →   | `text-base-content`                                                                                                                                                                                 |
| `st-container`                                                     | →   | `mx-auto w-full max-w-6xl px-6` — **this is the width fix**: match the builder pages' `max-w-6xl`, NOT the old 80rem `--st-container`. The site chrome (header/footer) must land on the same width. |
| `st-section`                                                       | →   | Tailwind section utilities (`py-16` etc.) matching the builder sections                                                                                                                             |
| `st-cta-row`                                                       | →   | `flex flex-wrap items-center gap-3`                                                                                                                                                                 |

### C. Variant / color name deltas (IMPORTANT)

- silica danger color is **`error`**, not `danger`: `st-c-danger` → `btn-error` / `text-error` /
  `alert-error` / `badge-error`.
- silica dashed button is **`btn-dash`**, not `btn-dashed`.
- Confirmed silica names via MCP: `btn btn-{primary|secondary|accent|neutral|info|success|warning|error}`,
  `btn-{soft|outline|dash|ghost|link}`, `btn-{xs|sm|md|lg|xl}`; `card card-body card-title card-actions`.

### D. CSS custom properties (any inline var / CSS you must touch)

`--st-primary` → `--color-primary`, `--st-base-100` → `--color-base-100`,
`--st-base-content` → `--color-base-content`, `--st-primary-content` → `--color-primary-content`, etc.
(1:1 rename; both are set from the tenant theme today.)

### E. App-specific composites (the hard part)

`apps/site/app/site.css` defines bespoke composites: `st-booking__*`, `st-pdp*`, `st-card__media`,
`st-hero`, `st-sb-*`, `st-cta-row`, etc. For each: read its current CSS rule, then reproduce the same
layout with **Tailwind utilities + silica classes inline** on the component, and **delete the rule
from `site.css`**. The end state is that `apps/site/app/site.css`'s `st-*` blocks are gone. Keep any
truly non-`st` app CSS (if any) intact.

---

## Scope & sequence (commit per surface)

Work in this order — highest-traffic + already-touched first. Verify + commit each before the next.

1. **Booking** — `components/booking/*` (booking-services, booking-widget, class-booking-widget,
   booking-service-detail, booking-deposit-step, add-to-calendar) + `app/book/**`.
2. **Product** — `components/product-detail.tsx`, `product-card.tsx`, `product-grid.tsx`,
   `components/sections/product-*`, `app/products/**`.
3. **Cart & checkout** — `components/cart-*`, `mini-cart`, `components/checkout/*`, `app/cart`, `app/checkout`.
4. **Chrome** — `site-header`, `site-footer`, `mobile-nav`, `breadcrumbs`, `empty-state`,
   `silica-chrome`, `app/layout.tsx`.
5. **Search / category / collections** — `components/search*`, `search/*`, `category/*`,
   `collections/*`, `facet-panel`, `sort-select`, `pagination`, related `app/**`.
6. **Account & B2B** — `components/account/*`, `auth-panel`, `app/account/**` (incl. `(authed)/**`,
   b2b, orders, invoices, quotes, estimates, addresses, wishlist, bookings).
7. **Sections & misc** — remaining `components/sections/*`, `review-form`, `question-form`,
   `rating-stars`, `quantity-stepper`, `fitment-table`, `cms/article-body`, `consent/*`, etc.
8. **Final** — delete every `st-*` rule from `apps/site/app/site.css`; if `@sparx/site-ui` is now
   unused by `apps/site`, drop the dependency + any import. Confirm `rg "st-[a-z]" apps/site` = 0 hits.

---

## Verification (every surface, before commit)

- `pnpm --filter @sparx/site run typecheck` — clean.
- `pnpm --filter @sparx/site run lint` (or `npx eslint <files>`) — clean.
- `npx prettier --write <changed files>`.
- **Visual parity**: the surface must look the same or better and stay tenant-themeable. Spot-check
  against the live site (`https://template.wizeworks.sparx.zone`) — especially that buttons, cards,
  inputs, badges, and width all render (no unstyled elements = a class that didn't map).
- **Do not** run `prisma generate`/migrate, start/restart dev, or `git push`. Leave changes in the
  working tree; the owner commits. Stage only files you changed (another agent may be in `apps/site`).

## Coordination

- Ideally run on a **fresh checkout / worktree** — a parallel agent is editing `apps/site`, and this
  touches ~114 files. Rebase onto their committed work; never overwrite another agent's dirty files.
- If you hit a component with no clear silica equivalent, check the silicaui MCP (`list_components`,
  `get_component`, `get_block`) and the existing silica builder catalog before inventing anything. If
  still unclear, leave it, note it, and move on — don't hand-roll a replacement control.
