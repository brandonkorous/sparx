---
title: The partner pages drifted from our designs
node: lessons-learned
type: decision
status: active
sources:
  - apps/dashboard/app/(dashboard)/partner/
  - docs/brain/design/console-is-not-marketing.md
---

**The origin story of this brain.**

**What happened:** the partner feature's pages read as "completely detached from our designs."

**What actually drifted (autopsy):** narrow, not total. The components were used correctly — `@sparx/ui`, a real `partner` module hue, `statusTone` badges, `SurfaceFrame` forms. The drift was **composition-level**: marketing idioms in the operator console — an uppercase eyebrow kicker, hand-typeset `text-[2rem]` hero-number strips (instead of `<Stat>`), identical value-prop card grids. The linter can't catch these; it only flags control re-skins.

**Root causes → what each produced:**

1. **No front door.** The design knowledge existed but was spread across ~12 files in 4 scopes with no entry point. → produced this brain and [[README]]'s task-router.
2. **A missing pattern.** Presentational content (pitch / one-pager / proposal) had no named home, so it was improvised with marketing layouts. → produced [[in-console-document]] + [[console-is-not-marketing]].
3. **A missing ADR.** "Partner is a *program* dressed as a *module*" lived only as a code comment. → produced the module / program / platform taxonomy in [[features]].

**How to apply:** start every UI task at [[README]]. For presentational console content, use [[in-console-document]]. Classify any new capability in [[features]] *before* building it.

Related: [[console-is-not-marketing]], [[in-console-document]], [[features]], [[stat-is-the-metric]]
