# Builder Component Library — Consistency & Coverage Audit

**Version:** 1.2.1
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-07-22

> **Drift note (2026-07-22):** The library/coverage audit below is still valid, but the bespoke `_builder` registry + inspector it references as the _editor_ has since been REPLACED — sparx now HOSTS silicaui's `<Builder>` engine (studio at `apps/workbench/surfaces/builder/studio/studio-surface.tsx`), which owns the palette, canvas, and inspector. See **docs/118-builder-silicaui-html-migration.md**.

> **Purpose.** Answer one question before any building: is the builder's common-component story actually done, and if not, where exactly is the gap? This doc is the audit result + the architecture decision to sign off. **Finding in one line:** the daisyUI-grade component _library_ already exists and exceeds daisyUI's breadth (`@sparx/site-ui`, ~85 components), but the _builder_ only leverages a fraction of it — the registry exposes ~15 of those 85 as droppable atoms, so ~60% of catalog entries hand-roll primitives that already have a real `st-*` class.

---

## 0. Status (v1.2 — Tracks A/B/C shipped; overlays closed)

- **Track A — DONE** (merged to `main`, PR #67). The other ~47 site-ui components are registered as droppable atoms: defs in the former `_builder/registry-atoms.ts` (removed — the droppable-atom catalog is now silica-owned: `@sparx/silica-catalog`), rendered by the shared `renderSiteUiAtom` map in [site-atoms.tsx](../packages/builder-render/src/site-atoms.tsx) (render-leaf delegates to it; new types join `CLASS_ON_LEAF`). `recipeFromClass` bridges site-ui's prop-based recipe to the builder's class-token recipe, so the inspector's Color/Emphasis controls drive every atom (`defaults.class` = axis tokens only; the component emits its own `st-<base>`). Covered by `site-atoms.test.tsx`.
- **Track B — DONE** across 8 of 9 catalog files. Re-authored onto atoms: `feedback`, `data-input` (#67), then `mockup`/`data-display`/`navigation` and `layout`/`interactive`/`marketing`. `actions.ts` is left as-is on purpose — it is already Button-atom-based, and its segmented join would reorder icons (the Button atom renders icon-after-label) while its dropdown is interactive.
- **Track C — interactive shipped + overlays closed.** Palette coverage was already closed by Track A (the ~20 components are droppable atoms). New interactive catalog entries (`interactive.ts`): **drawer** (sanctioned `st-fixed-right` rail) and **popover** (`absolute`), both composing the existing closed `menu` behavior — no new runtime code. Behavior parts (`data-sx-*`) are RAW `el('button')`/`el('div')`, because only the raw-element render path emits them; the named atom render does not. The **overlay/floating trio** is now registered as droppable atoms too:
  - **Modal / dialog** — the one atom a catalog composition CAN'T express (a dimmed full-viewport backdrop needs raw `fixed inset-0`, which the allowlist denies). Shipped as the **`BuilderDialog`** client island (render-leaf case): live = the platform-authored site-ui **`Dialog` (`st-dialog`, Radix)** — focus-trap, scroll-lock, ESC/overlay close, portal; canvas = the trigger + the panel shown inline-open via the new **`.st-dialog--static`** modifier (no portal, so children stay selectable in the scoped canvas). The node's recipe (`st-c-*`/`st-v-*`) styles the TRIGGER button; the panel body is the dropped children.
  - **Toast** + **FAB** — presentational site-atoms (their `position: fixed` lives in platform `st-*` CSS, so it bypasses the Tailwind clickjacking guard). Toast stacks dropped notifications by horizontal × vertical anchor; FAB is a recipe-colored floating button (icon + a11y label + placement + optional href).

### Open follow-ups

1. **§8 live-browser acceptance** — drop an Alert/Input from the palette and drive its color via the inspector; stamp a re-authored catalog entry; exercise the drawer/popover behavior + the modal live. (Note: the canvas `st-dialog--static`/`st-fab`/`st-toast` CSS ships in the `@layer components` bundle, so `styles.canvas.css` must be rebuilt — `pnpm --filter @sparx/site-ui build` / turbo handles it before the dashboard.)
2. _Optional / low value:_ the `actions.ts` segmented groups; FAB speed-dial actions (the bare floating button is the canonical FAB); `avatar_group`/`chat_thread` still use explicit-initials circles (the Avatar atom derives initials from a name).

---

## 1. The three inventories

- **A — `@sparx/site-ui` (the site component library):** ~85 component families, each with its own CSS (`src/styles/*.css`), a React component, and tests. `st-btn` (+ the four-axis `st-c-<color>` / `st-v-<variant>` / `st--sz-<size>`), `st-card`, `st-alert`, `st-input`, `st-table`, `st-rating`, `st-avatar`, `st-menu`, `st-tabs`, `st-steps`, `st-dialog`, `st-drawer`, `st-popover`, the `st-mockup*` family, … Loaded on **both** surfaces: the live site ([apps/site/app/layout.tsx](apps/site/app/layout.tsx) — `styles.css`) and the builder canvas (`styles.canvas.css`).
- **B — the catalog (the Add palette):** ~80 entries across 8 categories in [packages/builder-schemas/src/catalog/](packages/builder-schemas/src/catalog/) (data-as-code). Each entry's `tree` composes `el(tag, classString)` raw elements and `atom(type, …)` named components.
- **C — daisyUI (the breadth reference):** ~55 components across 7 categories.

## 2. What we found

### 2.1 Breadth vs daisyUI — COMPLETE ✅

`site-ui` (A) covers **every** daisyUI component (C) — button, dropdown, modal (`st-dialog`), swap, accordion, avatar, badge, card, carousel, chat, collapse, countdown, diff, kbd, list, stat, status, table, timeline, breadcrumb, dock, menu, navbar, pagination, steps, tab, alert, loading, progress, radial, skeleton, toast, tooltip, calendar, checkbox, fieldset, file-input, filter, label, radio, range, rating, select, input, textarea, toggle (`st-switch`), validator, divider, drawer, footer, hero, indicator, join, mask, stack, browser, code, phone, window — **plus extras daisyUI lacks** (callout, editorial-section, embed-frame, price-tag, signup, social-links, logo, wordmark, top-progress, text-rotate, hover-3d-card, hover-gallery). **There is no breadth gap to close.** The library you intuited "we should build with daisyUI as the reference" already exists and is broader than daisyUI.

### 2.2 Consistency — ~60% of catalog entries hand-roll a primitive that has an `st-*` class ⚠️

The catalog has a clear, systemic pattern: **leaf content atoms are used correctly; structural/control primitives are hand-rolled with raw utilities.** Every `atom('Button' | 'Heading' | 'Text' | 'Image' | 'Icon' | 'Badge' | 'Stat')` is correct — but cards, inputs, alerts, tables, ratings, avatars, menus, tabs, steps, mockup frames, etc. are rebuilt from `bg-… text-… px-… rounded-…` utilities even though the `st-*` class for each exists.

| File              | Entries | Hand-roll a primitive | Worst offenders                                                                                                                |
| ----------------- | ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `data-input.ts`   | 13      | **13**                | all controls route through hand-rolled `FIELD_SHELL`/`CONTROL`/`choiceRow` helpers + bespoke switch/range/textarea/select/file |
| `mockup.ts`       | 5       | **5**                 | every frame hand-rolls chrome; the entire `st-mockup*` family is unused                                                        |
| `data-display.ts` | 15      | 10                    | `card`, `card_horizontal`, `accordion`, `data_table`, `timeline`, `chat_thread`, `kbd`, `rating`, `avatar_group`, `collapse`   |
| `feedback.ts`     | 13      | 10                    | shared `alert` helper (4 alerts) + `toast`, `progress`, `radial`, `skeleton`, `spinner`, `tooltip`                             |
| `actions.ts`      | 10      | 6                     | `dropdown`, `button_group`, `split_button`, `button_toolbar`, `icon_button_row`, `fab_button`                                  |
| `marketing.ts`    | 13      | 6                     | avatars, ratings, `newsletter_signup` input, `faq_accordion`, `comparison_table`                                               |
| `navigation.ts`   | 7       | 5                     | `menu_vertical`, `tabs`, `steps`, `pagination`, `navbar_brand` mobile sheet                                                    |
| `layout.ts`       | 11      | 2–3                   | `indicator_badge`, `join_group` (+ `divider_label`)                                                                            |
| `interactive.ts`  | 7       | 2                     | `testimonial_carousel` rating, `logo_marquee` chip                                                                             |

**~50 of ~80 entries** hand-roll at least one primitive. Highest-leverage targets are the **shared helpers** — fixing `FIELD_SHELL`/`CONTROL`/`choiceRow` (data-input), the `alert` helper (feedback), and `pill`/`avatarCircle`/`star`/`keycap` (data-display) cleans whole files at once.

### 2.3 Root cause — the registry atom vocabulary is far narrower than the library 🎯

The builder registry exposes only **~15** types as `atom()`-droppable components: Button, Badge, Image, Icon, Heading, Text, Stat, FAQ, PriceTag, Signup, Logo, Wordmark, Card, Carousel, Divider. There is **no** `atom('Input' | 'Alert' | 'Table' | 'Rating' | 'Avatar' | 'Menu' | 'Tabs' | 'Steps' | 'Mockup' | 'Dialog' | 'Drawer' | 'Popover' | …)`. So when an author needed those, there was **no atom to call** — they hand-rolled with utilities. **The hand-rolling is a symptom; the narrow registry is the disease.**

### 2.4 Palette coverage — ~20 site-ui components have no Add-palette entry ⚠️

A tenant cannot add: **modal/dialog, drawer, mobile menu (`collapsible-nav`), popover** (the interactive essentials — these also need behavior-runtime wiring), plus calendar, countdown, diff, dock, filter, mask, status, social-links, hover-gallery, hover-3d-card, text-rotate, top-progress, standalone tag/list/label/link/validator.

## 3. The architecture decision (for sign-off)

### 3.1 Two-layer model — CONFIRMED

- **Layer 1 — semantic `st-*` classes / atoms for the atomic primitives** (button, badge, card, alert, input, table, rating, avatar, menu, tabs, steps, navbar, …). This is the right model: central theming, tiny class strings, real component identity, and — decisively in our builder — it is what powers the inspector's `color × variant × size` controls (`st-c-*`/`st-v-*`/`st--sz-*` map 1:1 to the UI). A hand-rolled-as-15-utilities button **cannot** be driven by those controls. The audit shows the catalog currently **violates Layer 1**.
- **Layer 2 — utility composition for the compositions** (heroes, footers, marketing sections, bento). These stay utility-composed (atoms wearing `st-*` inside, arranged with `flex`/`grid`/`gap`/`p-`). Correct as-is; not a finding.

### 3.2 CSS home — RESOLVED (with one cleanup)

`site-ui`'s compiled stylesheet declares `@layer theme, base, components, utilities` and puts every `st-*` rule in `@layer components`. Tenant/author utilities compile into a **later** layer, so **they reliably override `st-*` base styles** — the property the navbar relies on holds for the whole library. **Decision:** keep `st-*` CSS in `site-ui`'s stylesheet (static, fast, themed via `--st-*` vars); **reconcile the navbar's duplicate definition** in `surface-compile/theme.ts` (it predates the layered build). _Verify once:_ a tenant utility set in the inspector on a catalog `st-btn` actually wins in the compiled `tenant.css` cascade (expected, given the layer order).

## 4. The work (three tracks, each independently shippable)

- **Track A — Expand the registry atom vocabulary (the root-cause fix).** Register the rest of the `site-ui` set as builder atoms so the catalog _and tenants_ can drop a real Input / Alert / Table / Rating / Avatar / Menu / Tabs / Steps / Mockup / Dialog / Drawer / Popover instead of hand-rolling. Each: a registry entry + the existing `site-ui` React component as its renderer (the components already exist — this is wiring, not new UI).
- **Track B — Re-author the catalog onto Layer 1 (the consistency fix).** Replace hand-rolled primitives with atoms / `st-*` classes, starting with the shared helpers (highest fan-out). Compositions keep their Layer-2 utility layout.
- **Track C — Close palette coverage.** Add Add-palette entries for the ~20 uncovered components; wire the interactive ones (modal, drawer, mobile menu, popover) to the `data-sx-*` behavior runtime.

**Sequence:** A → B (B depends on A's atoms) → C. Track A unblocks everything and is itself a tenant-facing win (more droppable components) the day it ships.

## 5. Acceptance

- A tenant can drop a real **Input / Alert / Table / Rating / Avatar / Modal / Drawer / Mobile-menu** from the palette, and drive its look through the inspector's color/variant/size controls.
- No catalog entry hand-rolls a primitive that has an `st-*` class (compositions excepted); a lint/grep guard flags the fill+foreground+padding fingerprint inside catalog data.
- The navbar's CSS has a single home; a tenant utility override on any `st-*` component wins in the compiled cascade.

## 6. Out of scope

Rebuilding the `site-ui` components themselves (they exist and exceed daisyUI breadth — this is _wiring + re-authoring_, not new component CSS); per-component visual fidelity passes against daisyUI (a separate polish sweep); the email surface (inline-styled, no `st-*`, by design).
