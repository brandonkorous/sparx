# sparx Platform — Wizard Layout Pattern

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-20

---

## 1. Purpose

One layout language for every guided, multi-step flow in the platform — onboarding, blueprint installs, the create-wizards (Product, Customer, B2B Account, Document, Content, …), import flows, and any future setup sequence.

It ships in **two presentations of the same journey model**:

1. **The in-app top stepper** — the default for every wizard launched _inside_ the dashboard. A light, module-tinted **horizontal stepper** above a working pane, on the dashboard's normal surface language. It renders **inside the app chrome** (sidebar + header stay put), so "full page" no longer means "escape the app." The same frame backs a full page, a drawer, and a modal.
2. **The immersive rail** — a full-bleed two-pane frame with a flat module-colored **left rail**, owning the whole viewport. Reserved for **first-run onboarding / blueprint install**, where there is no app chrome yet and the branded moment fits.

This doc owns the **layout**. The **flows** inside it (which steps, which fields, validation) are owned by their feature docs — onboarding by [docs/15](15-merchant-onboarding-prd.md), the create-wizards by [docs/68](68-wizards-import-export-bulk.md).

> **v2 change:** earlier versions used the dark left rail for _every_ wizard, forcing the in-dashboard `/new` routes to cover the sidebar/header with a `fixed inset-0` overlay (a second rail beside the app's own nav). That is replaced by the top stepper for all in-app wizards; the rail is kept only for onboarding. See §6.

---

## 2. The in-app top stepper (default)

```
┌─────────────────────────────────────────────────────┐
│  New document                                Cancel  │  ← header: title + footer
├─────────────────────────────────────────────────────┤
│   ①────────②────────③────────④────────⑤            │  ← horizontal stepper
│  Bill to   Lines   Charges  Deposit  Review          │     (module-tinted)
├─────────────────────────────────────────────────────┤
│                                                       │
│     Step headline                                     │
│     Supporting line                                   │
│     ┌───────────────────────────────────────────┐    │  ← working pane (scrolls)
│     │  the step's content                        │    │
│     └───────────────────────────────────────────┘    │
│                                                       │
├─────────────────────────────────────────────────────┤
│  [ Back ]                              [ Continue ]   │  ← action row (pinned)
└─────────────────────────────────────────────────────┘
```

- **Header (top): the constant identity.** The wizard's title (e.g. "New document") on the left; a footer affordance (Cancel / Save & exit) on the right. Omitted when neither is supplied.
- **Stepper (below header): the progress.** A horizontal row of numbered markers with connectors — `done` (filled + check), `current` (filled + ring), `upcoming` (outline). Visited steps are clickable (you can't skip ahead). Connectors fill with the module color up to the current step. It sits on `--color-bg-surface`, tinted with the active module color — **never** a dark rail.
- **Working pane: the variable.** A left-aligned step headline + supporting line, the step body, then the action row. The pane **scrolls internally**; the header, stepper, and action row stay put.
- **Action row (pinned): fixed placement.** Back (ghost, left), primary advance (`color="module"`, right), Skip ("Skip for now") beside the primary when a step is genuinely optional. Pinned to the bottom edge so it never scrolls away.

**Why a top stepper and not the dark rail:** inside the dashboard the colored side-rail competes with the app's own left nav (two rails), which is exactly why the old full-page wizard had to take over the whole viewport. A horizontal stepper on the dashboard's surface language sits _inside_ the chrome, reads as part of the app, and renders identically in a page, a drawer, or a modal — "learn one, know all."

---

## 3. The three in-app variants (same top stepper)

All three render the identical header + stepper + working-pane frame; only the host differs.

| Variant    | Host                                                                            | Used by                                                                  |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `embedded` | In-flow, fills the dashboard **content area** (sidebar + header stay)           | The full-page `/new` create routes — the "full page" option              |
| `inline`   | Fills a **drawer / modal detail panel** that supplies its own close chrome      | The create overlays (the `@detail` slot), picked by `defaultDetailView`  |
| `modal`    | A **self-owned Radix dialog** (centered, `min(680px,88vh)` × `min(920px,94vw)`) | Stand-alone create wizards not wired to the detail panel (e.g. New site) |

### How a create-wizard chooses

Each create-wizard takes a `presentation` prop and renders one frame:

```
variant={presentation === 'overlay' ? 'inline' : 'embedded'}
```

- The `/new` route renders `presentation="page"` → `embedded`.
- The dashboard "New X" button (`EntityCreateButton`) resolves the user's `defaultDetailView` (drawer / modal / full page / new tab). Drawer + modal open the wizard as `inline` inside the `@detail` panel; "full page" navigates to the `/new` route (`embedded`); new tab opens it there in a new tab. See [docs/24](24-dashboard-shell.md) and the detail-view registry.

### Responsive (top-2 rule)

Below ~680px the stepper collapses to a single centered line — **"Step _n_ of _N_ · {label}"** — and the working pane goes full width; two-column step bodies stack. The modal variant becomes a full-screen sheet below ~940px.

---

## 4. The immersive rail — `variant="page"` (onboarding only)

```
┌──────────────┬───────────────────────────────────────┐
│   RAIL       │  Step headline                         │
│  (module     │  Supporting line                       │
│   color)     │                                        │
│  wordmark    │  ┌─────────────────────────────────┐  │
│  lede        │  │   WORKING PANE                    │  │
│  ① done      │  │                                  │  │
│  ② current   │  └─────────────────────────────────┘  │
│  context     │  [ Back ]               [ Continue ]   │
└──────────────┴───────────────────────────────────────┘
```

The full-bleed two-pane frame with a flat module-colored left rail (brand wordmark + a per-step lede + the vertical journey + a context blurb), owning the whole viewport (`340px` rail + `1fr` pane, `100vh`). Reserved for **first-run onboarding / blueprint install** — there's no app chrome to keep, and the branded, immersive moment fits the once-per-tenant setup.

- Rail color follows `<ModuleProvider>` (`--module-active`), a flat solid fill (no gradient). Onboarding is Builder Indigo. The wordmark "x" stays sparx Indigo (brand rule).
- Below ~940px the rail collapses to a slim top bar with dot progress (`RailTopBar`).
- The rail (`RAIL_BG`, `RailWordmark`) shares one source of truth with the auth split-panel via `brand-rail`.

### When to use the rail vs. the top stepper

| Use the **immersive rail** (`page`)            | Use the **top stepper** (`embedded`/`inline`/`modal`) |
| ---------------------------------------------- | ----------------------------------------------------- |
| User is not yet in the app (first-run setup)   | User is already working in the dashboard              |
| Once-per-tenant onboarding / blueprint install | Repeated, on-demand creation of an object             |
| The flow _is_ the destination                  | The flow returns you to where you were                |

---

## 5. Shared rules (both presentations)

- **Progress is always visible.** The stepper (in-app) or the rail journey (onboarding) shows done / current / upcoming on every step. No floating "Step 2 of 4" badge in the pane (except the in-app compact line at the narrow breakpoint, which _is_ the stepper).
- **One headline pattern.** Left-aligned heading + muted supporting line at the top of the pane. No centered hero stacks; no uppercase mono eyebrows (no-eyebrows rule).
- **Action placement is fixed.** Back left, primary right, Skip beside the primary. Primary uses `color="module"`; everything else ghost/soft/outline.
- **Motion:** the working pane content does a small `fadeUp` on step change (~0.3–0.4s); the stepper/rail is static. Respect `prefers-reduced-motion`.
- **State is preserved on Back.** Going back never clears entered data.
- **Tokens only.** Geist; module color via `--module-active` (+ `-tint`, `-content`); neutrals/radii from `@sparx/ui` tokens — no hardcoded colors.

---

## 6. Implementation shape

A single `@sparx/ui` primitive — [`WizardFrame`](../packages/ui/src/components/navigation/wizard-frame.tsx) — backs all presentations so they cannot drift:

```
<WizardFrame variant="embedded" | "inline" | "modal" | "page"
             title | wordmark
             steps={[{ key, label, sublabel }]}
             current
             context={perStepHint}
             lede={perStepLede}          // page variant only
             onStepSelect canSelectStep
             footer={cancelButton}>
   <WizardStep header={{ title, supporting }} actions={{ onBack, onNext, onSkip }}>
     …step body…
   </WizardStep>
</WizardFrame>
```

- `embedded` / `inline` render the top-stepper shell as in-flow content (`h-full`, filling the content area or the host panel). `modal` renders the same shell inside a Radix Dialog. `page` renders the immersive rail grid.
- `WizardStep` adapts to the frame: the top-stepper variants give it a **scrolling body + pinned action row**, both centered on the `width` column; the `page` rail gives it a flowing centered column.
- Module color flows from the surrounding `<ModuleProvider>`; the wrapper carries `h-full` so the frame fills its host.
- **Who mounts what:** onboarding ([docs/15](15-merchant-onboarding-prd.md)) → `page`. The create-wizards (Product, Customer, B2B Account, Document, Content) → `embedded` at `/new`, `inline` in the detail panel. The New-site wizard → `modal`.

---

## 7. Cross-references

- [docs/15](15-merchant-onboarding-prd.md) — onboarding, the canonical immersive-rail instance.
- [docs/68](68-wizards-import-export-bulk.md) — the create-wizard flows.
- [docs/24](24-dashboard-shell.md) — the dashboard shell + the `@detail` drawer/modal create overlays and `defaultDetailView`.
- [docs/34](34-dashboard-working-area-standard.md) — dashboard working-area archetypes (the wizard is the guided-flow archetype).
- [docs/23](23-frontend-component-architecture.md) · [docs/35](35-ui-variant-system.md) — component architecture and the four-axis variant system the chrome is built on.

## 8. Status

**Built.** `WizardFrame` (`@sparx/ui`) ships all four variants. In-app wizards (Product, Customer, B2B Account, Document, Content, New site) use the top stepper; onboarding uses the immersive rail.
