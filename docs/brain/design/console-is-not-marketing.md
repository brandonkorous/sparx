---
title: The console is not a marketing site
node: design
type: rule
status: active
applies-to: [dashboard]
sources:
  - apps/dashboard/DESIGN.md
  - docs/86-surface-frame-pattern.md
---

**This is the note the partner pages needed.** The operator console and the marketing site are different surfaces with different idioms. Marketing idioms leaking into the console is what reads as "completely detached from our designs" — and the linter can't catch it, because every offending element is built from correct primitives.

**Banned in the console (all seen on the partner pages):**

- **Uppercase mono "eyebrow" kickers** above headings. Carry hierarchy with scale/weight/color instead. (See [[no-eyebrows]] in [[conventions]].)
- **Hand-typeset hero-number strips** (`text-[2rem]` spans for big figures). **Every prominent metric is a `<Stat>`** — no exceptions, on any surface. The partner overview used `<Stat>` correctly two functions away from where it hand-rolled the numbers.
- **Identical icon + heading + text value-prop card grids.** If a screen could be guessed from the word "dashboard" alone, it is wrong.
- **Gradient washes / decorative hero art.** See [[flat-by-default]].

**Genuinely presentational content *does* sometimes live in the console** — a pitch, a printable one-pager, a proposal builder. That is a real, currently-**unnamed** surface. Don't improvise it with marketing idioms — use the named [[in-console-document]] pattern (in [[components]]).

**Why:** the console's job is operating a business, not selling one. Its density, restraint, and `<Stat>`/`SurfaceFrame` vocabulary are the brand *here*.

**How to apply:** building a dashboard surface? Run the ban list above before you ship. Presentational content? Reach for [[in-console-document]], not a landing-page layout.

Related: [[color-follows-functionality]], [[flat-by-default]], [[voice]], [[components]]
