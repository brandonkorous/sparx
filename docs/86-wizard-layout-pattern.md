# Sparx Platform — Wizard Layout Pattern

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

---

## 1. Purpose

One layout language for every guided, multi-step flow in the platform — onboarding, blueprint installs, the create-wizards (Product, B2B Account, Email campaign), import flows, and any future setup sequence. It ships in **two variants of the same design**: a **full-page** frame and a **modal** frame. They are visually and structurally the same so a user who learns one knows the other.

This doc owns the **layout**. The **flows** that live inside it (which steps, which fields, validation) are owned by their feature docs — onboarding by [docs/15](15-merchant-onboarding-prd.md), the create-wizards by [docs/68](68-wizards-import-export-bulk.md). docs/68's earlier horizontal-stepper sketch is superseded by this pattern.

---

## 2. The core idea: a persistent two-pane frame

```
┌──────────────┬───────────────────────────────────────┐
│              │  Step headline                         │
│   RAIL       │  Supporting line                       │
│              │                                        │
│  wordmark/   │  ┌─────────────────────────────────┐  │
│  title       │  │                                  │  │
│              │  │   WORKING PANE                    │  │
│  ① ─ done    │  │   (the only thing that changes)   │  │
│  ② ─ current │  │                                  │  │
│  ③ ─ next    │  │                                  │  │
│  ④ ─ next    │  └─────────────────────────────────┘  │
│              │                                        │
│  context     │  [ Back ]               [ Continue ]   │
│  blurb       │                                        │
└──────────────┴───────────────────────────────────────┘
```

- **Rail (left): the constant.** Brand wordmark or wizard title, an **always-visible vertical journey** (every step with done / current / upcoming states), and a one-line **context blurb** that changes per step. The rail never moves between steps — it is the single source of progress and the thing that gives the flow a sense of place.
- **Working pane (right): the variable.** A left-aligned **step headline + supporting line**, then the step's content, then an **action row** (Back / Continue / Skip). Only this pane changes as the user advances.

**Why a frame and not centered steps:** a centered, single-column step floating in empty space is the "deleted-modal" anti-pattern — no composition, no continuity, progress that only appears on some screens. The frame fixes all three at once.

### Rail anatomy

| Slot | Content |
| --- | --- |
| Top | Sparx wordmark (full-page) or the wizard's title (modal), e.g. "New product" |
| Middle | Vertical journey — numbered markers + label + sublabel; a connector line; states: `upcoming` (outline), `current` (filled, ring), `done` (filled + check) |
| Bottom | A context card (icon + one line that reframes the current step) and utility links (Sign out / Need help, or Cancel) |

### Rail color follows the module

The rail adopts the active module color via `<ModuleProvider>` (`--module-active`). Onboarding/first-run uses **Builder Indigo**; a **Product** wizard's rail is **Commerce orange**; a **B2B Account** wizard's is **B2B slate**; and so on. The rail is a **flat solid fill** of the module color (no gradient — Sparx is flat by default); use the module's strong shade (e.g. indigo `#4f46e5`, commerce `#ea580c`). Wordmark "x" stays Sparx Indigo regardless (brand rule).

### Working-pane anatomy

- **Step header:** left-aligned `Heading` (~28–30px full-page, ~22–24px modal) + a muted supporting line. Never an uppercase mono eyebrow (no-eyebrows rule).
- **Content:** the step's body. A step should fit without scrolling where possible; long content scrolls *inside the pane*, never the frame.
- **Action row:** Back (ghost, left) and the primary advance (right). Skip, when a step is genuinely optional, sits next to the primary as "Skip for now." The plan/summary panels that some steps need (e.g. the pricing switchboard's plan card) live inside the pane, not the rail.

---

## 3. Variant A — Full-page

The default for **first-run and high-stakes setup**: signup, onboarding, blueprint install, large guided configuration. It owns the whole viewport (a route outside the dashboard shell — no sidebar, no topbar).

- **Grid:** `340px` rail + `1fr` working pane, `100vh`, each pane scrolls independently.
- **Working pane** is centered with a generous `max-width` (≈ 880–960px) and large padding (≈ 52–56px).
- **Header strip** is optional — the rail already carries the brand; a thin top bar may hold a sign-out / exit affordance.
- **Canonical instance:** onboarding (docs/15). Mockup: `mockups/onboarding.html`.

### When to use

Signup · onboarding · blueprint install · first-run setup · any flow long or important enough to deserve the whole screen.

---

## 4. Variant B — Modal

The same frame, **contained in a dialog**, for **in-app create-wizards** where the user is already in the dashboard and shouldn't lose their place: New Product, New B2B Account, New Email campaign (docs/68), Import flows.

- **Dialog:** centered, `max-width ≈ 920px`, `height ≈ min(680px, 88vh)`, `radius-2xl`, elevated shadow, over a scrim.
- **Same two panes inside:** a **compact rail** (≈ 240–260px; the title replaces the wordmark; the journey + context blurb are identical, just tighter) + the working pane.
- **Action row is pinned** to the bottom edge of the dialog (sticky), so Back/Continue stay visible as pane content scrolls.
- **Dismissal:** an explicit close (✕) in the rail or top-right. **Backdrop click does not dismiss** once the user has entered data — guard with the destructive-action confirm ("Discard this <object>?") so progress is never lost silently. `Esc` follows the same guard.
- **Canonical instance:** the create-wizards in docs/68. Mockup: `mockups/wizard-modal.html`.

### When to use

In-dashboard creation of a complex object (Product, B2B Account, Email campaign) · import flows · any guided sequence that should overlay the current context rather than replace it.

### Full-page vs. modal — pick by context

| Use **full-page** | Use **modal** |
| --- | --- |
| User is not yet in the app (signup/onboarding) | User is already working in the dashboard |
| First-run / once-per-tenant setup | Repeated, on-demand creation |
| The flow *is* the destination | The flow returns you to where you were |
| Long or high-stakes (install, billing setup) | Bounded (3–5 steps, one object) |

---

## 5. Shared rules (both variants)

- **Progress lives in the rail, on every step.** Never show progress on some steps and not others. No separate "Step 2 of 4" badge floating in the pane — the rail is the indicator.
- **One headline pattern.** Left-aligned heading + muted line at the top of the pane. No centered hero stacks; no uppercase mono eyebrows.
- **Action placement is fixed.** Back left, primary right, Skip ("Skip for now") beside the primary. Primary uses `color="module"`; everything else is ghost/soft/outline.
- **Motion:** the working pane content does a small `fadeUp` on step change (≈ 0.4s); the rail is static. Respect `prefers-reduced-motion`.
- **Responsive (top-2 rule):** below ~940px the rail **collapses to a slim top bar** in the module color with a compact dot/segment progress; the working pane goes full width; two-column step bodies stack to one column. The modal becomes a **full-screen sheet** at that breakpoint.
- **State is preserved on Back.** Going back never clears entered data.
- **Tokens only.** Geist; module color via `--module-active`; neutrals and radii from `@sparx/ui` tokens — no hardcoded colors.

---

## 6. Implementation shape

A single `@sparx/ui` layout primitive backs both variants so they cannot drift:

```
<WizardFrame variant="page" | "modal"
             title | wordmark
             steps={[{ key, label, sublabel }]}
             current
             context={perStepBlurb}
             onCancel>
   <WizardStep header={{ title, supporting }} actions={{ onBack, onNext, onSkip }}>
     …step body…
   </WizardStep>
</WizardFrame>
```

- `variant="page"` renders the full-bleed grid; `variant="modal"` renders the dialog (Radix Dialog) with the same internal grid and a pinned action row.
- The rail (journey + context) and the step-header/action-row chrome are shared; only the outer container differs.
- Module color flows from the surrounding `<ModuleProvider>`.
- Per docs/68, the create-wizards mount `variant="modal"`; onboarding (docs/15) mounts `variant="page"`.

---

## 7. Cross-references

- [docs/15](15-merchant-onboarding-prd.md) — onboarding, the canonical full-page instance.
- [docs/68](68-wizards-import-export-bulk.md) — the create-wizard flows that adopt the modal variant (supersedes its horizontal-stepper sketch).
- [docs/34](34-dashboard-working-area-standard.md) — dashboard working-area archetypes (the wizard is the guided-flow archetype).
- [docs/23](23-frontend-component-architecture.md) · [docs/35](35-ui-variant-system.md) — component architecture and the four-axis variant system the chrome is built on.

## 8. Status

Design-complete; **not yet built**. Mockups: `mockups/onboarding.html` (full-page) and `mockups/wizard-modal.html` (modal). The shared `WizardFrame` primitive is greenfield.
