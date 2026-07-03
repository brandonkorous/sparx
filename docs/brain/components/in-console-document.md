---
title: In-console document (pattern)
node: components
type: pattern
status: draft
applies-to: [dashboard]
sources:
  - docs/86-surface-frame-pattern.md
  - apps/dashboard/app/(dashboard)/partner/
---

**A proposed, not-yet-formalized pattern — the exact gap the partner pages fell into.**

Some genuinely *presentational* content legitimately lives inside the console: a partner pitch, a printable one-pager, a proposal builder, an ROI/earnings calculator. The design system has **no named pattern** for it, so authors improvise with marketing idioms — and that improvisation is what read as "detached." (See the autopsy in [[lessons-learned]] → [[console-is-not-marketing]].)

**The pattern (draft):** presentational documents render in the **console vocabulary**, not the marketing one —

- Metrics are `<Stat>` ([[stat-is-the-metric]]) — never hand-typeset hero-number strips.
- No uppercase eyebrow kickers ([[no-eyebrows]]); hierarchy via scale/weight/color.
- Flat, tokenized, neutral chassis — no gradient hero art ([[flat-by-default]]).
- A clear **print/export** affordance when the document is meant to be shared or printed.
- If part of it is a *form* (calculator inputs), it stays a form — reuse [[surface-frame]] conventions where they fit.

**Why:** without a named home, "presentational" becomes a license to import landing-page layouts into the operator console.

**How to apply:** building pitch / one-pager / proposal / calculator content? Follow this. **Status: draft** — formalize it into a shared primitive when the next such surface appears, and record that decision in [[lessons-learned]].

Related: [[console-is-not-marketing]], [[stat-is-the-metric]], [[surface-frame]], [[flat-by-default]]
