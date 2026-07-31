---
title: Typography
node: design
type: rule
status: active
applies-to: [both]
sources:
  - DESIGN.md
  - packages/ui/src/tokens.css
  - docs/sparx-brand-guide.md
---

Geist everywhere, **two weights only — 400 and 500** (never 600/700 in body UI; the wordmark mark is the exception, Geist 700 with the "x" in `#6366F1`).

**Body floors at 16px, platform-wide.** `packages/ui/src/tokens.css` already implements it (`--text-base: 1rem`). Longer-form reading can go up (18px); captions may drop to **14px**; **never 11–13px for body**. Use the shared `--text-*` scale via `<Text>` — never a raw `text-[13px]`.

- **Dashboard:** fixed rem scale, **no `clamp()`**.
- **Site:** fluid `clamp()`-based type is allowed (tenant-scaled).

## Resolved — 16px is canonical (was a spec conflict)

Writing this note surfaced a drift: **`apps/dashboard/DESIGN.md §3` and `docs/23 §4` specify 15px body**, while `tokens.css` and the operator's platform-wide guidance both say **16px**.

**Decision (operator, confirmed):** the 16px body floor wins — it is the whole platform's guidance. **Done 2026-07-03:** `DESIGN.md` (front-matter `body`, the §3 Body/Input lines, the "16px-body scale" note) and the `docs/23 §4` token mirror were corrected to 16px; the token was already right. Logged in [[lessons-learned]] as "a spec drifted from the token that implements it." **Still open:** `DESIGN.md`'s 11px *label* / 13px *mono* don't match `tokens.css` (xs 12 / sm 14) — a separate design call ([[open-punch-list]]); labels aren't body, so weigh them against the 14px caption floor when you touch a surface.

**Why:** type size is the most-reported "this looks cheap" tell; a floor that lives in a token but is contradicted by the spec drifts back in.

**How to apply:** treat 16px as the body floor. If you see 15px body in a spec or component, it's a bug to fix, not a pattern to follow.

Related: [[tokens-are-truth]], [[flat-by-default]], [[voice]], [[lessons-learned]]
