---
title: Color follows functionality
node: design
type: rule
status: active
applies-to: [dashboard]
sources:
  - apps/dashboard/DESIGN.md
  - docs/35-ui-variant-system.md
  - docs/sparx-brand-guide.md
---

Color marks **what a thing is**, not what page you're on. There is **no "one hue per screen" rule** (the old DESIGN.md framing — "the active module's color is the only brand color on screen" — was wrong and is corrected).

- The active route tints the chrome + the page-level primary action.
- Any panel/badge/action surfacing *another* module's functionality wears **that** module's hue via a **nested `<ModuleProvider module="…">`** (a product page's inventory panel is amber, its SEO panel yellow, a linked customer cyan).
- One screen legibly carries several module hues — carried by the *signals* (tinted primary card, primary button, key badges), while the chassis (page bg + non-primary cards) stays neutral.

**Tint discipline:** on a dense cross-module page, tint only the **one "primary" card per module hue** (`<Card variant="module">`); leave the rest `plain`. A **single-module working surface** (create/edit form, wizard, editor) keeps its cards **neutral** entirely — the tint differentiates nothing there; identity rides the chrome + Save button.

**Why:** color is wayfinding. Used as decoration (a second brand hue for flavor, a module wash on the chassis) it becomes noise. The only banned use of color is decoration.

**How to apply:** ask "what functionality is this element?" → its module hue. Then check density → tint one primary card per hue, not a wall.

Related: [[status-is-its-own-axis]], [[console-is-not-marketing]], [[two-design-systems]]
