---
name: surface-review
description: Evaluate a dashboard surface (a detail/edit/create page or overlay) on BOTH UI fidelity and UX quality, score it 1–10 on each axis with an explicit "gap to 10", and log it. Use during the page-by-page commerce (and beyond) walk-through — when confirming or fixing a page, before/after a focused change, or any time someone asks "is this page actually good?". Dispatches a READ-ONLY audit agent to do the legwork (map tabs/panels, what data each loads, cross-module color, duplication), then the findings drive a human-verified fix. It only inspects and reports — it never edits.

The point: a UI rubric catches "is it on-system and well-composed"; the UX heuristics catch "does this surface actually serve the user's job" — related data loaded, each concern in one home, cross-module wayfinding by color, no dead ends. A bare 1–10 is noise; the value is the deductions, because they ARE the worklist.
---

# Surface review — score a page on UI + UX, then fix what the score exposes

Companion to the `form-surface` skill: that one is *how to build/wire* a surface; this one is *how to judge whether it's any good* and turn the judgment into focused work. Design spec for the UI side is [docs/86](<../../../docs/86-surface-frame-pattern.md>); the census + per-page log live in [docs/105](<../../../docs/105-form-modal-surface-inventory.md>).

## The loop (one page at a time, eyes on screen)

`/surface-review <route or page name>` runs:

1. **Dispatch a read-only audit agent** (below) → it returns a structured findings report + draft UI/UX scores. It CANNOT edit (read-only tools) — that firewall is deliberate; blind autonomous fixing is what produced the `WizardFrame` mess.
2. **Review the findings with the user**, on screen in Playwright (open every presentation the surface has). Confirm or overrule each finding against ground truth — the agent maps the code; the screen is the truth.
3. **Fix together**, focused — apply the design system, don't re-skin. Prefer fixing a shared cause in the primitive over per-page patches.
4. **Verify on screen** in every presentation (typecheck + lint are necessary, not sufficient).
5. **Log to docs/105** in the format below: UI score · UX score · gap-to-10. Update the score after the fix, not just before.

Scale the depth to the surface: a one-form detail (category) is a quick pass; a tabbed detail with many panels (product) earns a thorough agent sweep.

## The read-only audit agent — dispatch prompt

Use the **Explore** agent type (read-only by tool restriction — it physically cannot Edit/Write). Prompt template:

> READ-ONLY audit. Do NOT edit anything. Read `.claude/skills/surface-review/SKILL.md` and apply its UI rubric + UX heuristics to the surface at **<route>**, whose code is under **<dir>** (start at `_content.tsx` / `page.tsx` / the `*-form`/`*-editor` components, and follow imports). Map it, don't skim:
> - Enumerate every tab / panel / section, and for EACH: what data it loads (and what related data it conspicuously does NOT load that the task needs), which module it conceptually belongs to vs. which `<ModuleProvider>` accent it actually wears, and any concern that also appears elsewhere (duplication).
> - Walk the UI rubric (5 axes) and the UX heuristics (4) below; for each, cite specific file:line evidence.
> Return structured findings: per-axis notes with evidence, a **draft UI score (1–10)** and **draft UX score (1–10)** each with a one-line justification, and a **ranked "gap to 10" list** (each item: what's wrong · where · proposed fix · rough effort). No prose preamble — just the report.

The agent returns the report to the main thread; the human review + fix happen here, not in the agent.

## UI rubric — 5 axes → one composite 1–10

1. **System fidelity** — tokens/variants only (no hardcoded color, no re-skinned controls — docs/23 §1/§15, docs/35). Components from `@sparx/ui`. Module accent via `--module-active`. **Status pills carry a semantic color** via `statusTone()` (docs/35 §9) — a neutral/outline pill where a tone applies (active/draft/paid/failed…) is a deduction; so is a hand-rolled `<span>` pill or `className="text-xs"` instead of `size`.
2. **Layout & hierarchy** — the right shell (SurfaceFrame F-layout for forms; no double header, no in-card footer toolbar, no dead side gutters, no vertical void). One heading hierarchy, **no eyebrows**. A complex **tabbed record** (product, customer, B2B) carries a full-height **context rail** beside the tabs — a non-editable summary of its vitals (docs/86 §5.2) — that **fills its column edge-to-edge, not floats as a card**; the body renders full-bleed so the two-pane fills and Save **floors** below the scroll (a footer overlapping the form, or a summary that doesn't fill its column, is a deduction).
3. **Interaction clarity & safety** — primary action obvious (`color="module"`); **Cancel is the leftmost toolbar anchor**, same place every surface; destructive action in the toolbar's `destructive` slot (after Cancel, danger-styled, never beside the primary, never in the summary aside); loading/disabled/error states present. **Lifecycle controls (status badge + Publish/Archive/Preview/…) live in the frame header** via `DetailHeaderSlot` (docs/86 §5.1), never a bespoke in-body "Status" card — and in the header secondary actions are **icon-only with a tooltip**, only the status badge + primary action keep text.
4. **Responsive** — the container-query collapse works (two-col → one-col stack); usable on mobile; no viewport media-query hacks fighting the frame.
5. **Content & microcopy** — labels/help/empty-states are clear, specific, and in the sparx voice; no lorem, no dev-speak.

## UX heuristics — 4 checks → one composite 1–10

These need domain judgment, not a screenshot diff:

1. **Task completeness / related data** — does the surface load what the user needs to *do the job here*, or force a hunt elsewhere? Flag missing linked records, counts, statuses, or a thin summary that wastes the column (e.g. a category edit could surface its child categories / recent products). A **complex tabbed record** with no context rail — or one whose rail is a stub — is a gap: the rollup (price, variant/media counts, inventory totals, reach) is what keeps the parts coherent while you work one tab (docs/86 §5.2).
2. **Single home / no duplication** — each concern lives in exactly ONE place. If SEO fields sit on the Overview tab *and* there's a dedicated SEO tab, that's two homes — consolidate. Flag any field/section that appears twice. **Entity identity** (name/title + slug) appears ONCE as the editable field — never also as a read-only heading atop the body (read-only/transaction details, which have no name field, keep their heading). **SEO title/description** use the reusable `<SeoMetaFields>` (`components/seo/seo-meta-fields.tsx`): inherited value as placeholder + per-field "Use name/description" buttons — never a bare title/desc pair, and never a blunt "copy" that clobbers a custom value (docs/50).
3. **Cross-module wayfinding** — a tab/panel that conceptually belongs to another module wears THAT module's accent. A product's Inventory tab → inventory amber, its SEO tab → SEO's color: **wrap that panel in its own `<ModuleProvider module="…">`** — that re-tints its buttons/badges AND its `<Card variant="module">` top stripe automatically (the stripe reads `--module-active`; don't hand-pass `accent` when a provider already wraps it). Color is a navigation signal; a commerce-orange Inventory tab is a missed cue. A `module` card showing the active route's color where the panel belongs to another module is a deduction — usually a missing provider wrap.
4. **Flow & dead ends** — sensible defaults; no lost work (dirty-state guard before discarding edits on Cancel/close); success leads somewhere useful; errors are recoverable; the next step is obvious.

## Scoring discipline

- Score **UI and UX separately**, each 1–10, across the relevant presentations (drawer / modal / full-page / tab).
- **10 is rare** — it means nothing left to improve. Be willing to write a 6 and own the gap. "Production-quality with a couple of real gaps" is an 8, not a 10.
- The **gap-to-10 list is mandatory** — a number without deductions is not a review. Each gap is a candidate work item.
- A gap that recurs across pages (e.g. no dirty-state guard) is a **platform fix on the primitive**, logged once and fixed centrally — not patched page by page.

## docs/105 logging format

In the walk-through table add a `Score (UI/UX)` cell. Then append the detail to the **`## Surface review log`** section:

```
### <page> — UI <n>/10 · UX <n>/10 (<date>)
- ✅ Strong: <one line>
- Gap to 10 (UI): <item — where — fix>
- Gap to 10 (UX): <item — where — fix>
- Platform gaps surfaced: <item → primitive>   ← if any
- Post-fix: UI <n> · UX <n> (<what changed>)
```

Keep entries terse — they're a punch-list, not an essay. Re-score after the fix lands.