---
title: Typography
node: design
type: rule
status: active
applies-to: [both]
sources:
  - apps/dashboard/DESIGN.md
  - packages/ui/src/tokens.css
  - docs/sparx-brand-guide.md
---

Geist everywhere, **two weights only — 400 and 500** (never 600/700 in body UI; the wordmark mark is the exception, Geist 700 with the "x" in `#6366F1`).

**Body floors at 16px, platform-wide.** `packages/ui/src/tokens.css` already implements it (`--text-base: 1rem`). Longer-form reading can go up (18px); captions may drop to **14px**; **never 11–13px for body**. Use the shared `--text-*` scale via `<Text>` — never a raw `text-[13px]`.

- **Dashboard:** fixed rem scale, **no `clamp()`**.
- **Storefront:** fluid `clamp()`-based type is allowed (tenant-scaled).

## Resolved — 16px is canonical (was a spec conflict)

Writing this note surfaced a drift: **`apps/dashboard/DESIGN.md §3` and `docs/23 §4` specify 15px body**, while `tokens.css` and the operator's platform-wide guidance both say **16px**.

**Decision (operator, confirmed):** the 16px body floor wins — it is the whole platform's guidance. The 15px in `DESIGN.md §3` / `docs/23 §4` is stale and must be corrected to 16px (the token is already right, so this is a doc-and-audit fix). Tracked in [[tasks]]; logged in [[lessons-learned]] as "a spec drifted from the token that implements it." The 11px *label* scale is a separate open audit — labels aren't body — check it against the 14px caption floor when you touch a surface.

**Why:** type size is the most-reported "this looks cheap" tell; a floor that lives in a token but is contradicted by the spec drifts back in.

**How to apply:** treat 16px as the body floor. If you see 15px body in a spec or component, it's a bug to fix, not a pattern to follow.

Related: [[tokens-are-truth]], [[flat-by-default]], [[voice]], [[lessons-learned]]
