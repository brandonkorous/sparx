---
target: apps/dashboard/commerce/categories/[id]
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-06-24T01-35-47Z
slug: pps-dashboard-app-dashboard-commerce-categories-id
---

# Critique — Category detail/edit (apps/dashboard/app/(dashboard)/commerce/categories/[id])

Surface: CategoryEditForm on SurfaceFrame (F layout: form column + live "Category" summary aside), ModuleProvider=commerce, single-step, pinned Cancel/Delete/Save toolbar, unsaved-changes guard, destructive-confirm delete. Renders identically as full-page (embedded) and overlay (inline).

## Design Health Score — 28/40 (Good, bottom of band)

| #   | Heuristic                   | Score | Key issue                                                                        |
| --- | --------------------------- | ----- | -------------------------------------------------------------------------------- |
| 1   | Visibility of System Status | 2     | Save success = quiet muted "Saved 3:42 PM"; goes stale after next edit           |
| 2   | Match System/Real World     | 3     | "Position" as a bare integer; otherwise natural language                         |
| 3   | User Control & Freedom      | 4     | Unsaved guard + Cancel-leftmost + discard confirm across all leave paths         |
| 4   | Consistency & Standards     | 3     | Strong DS use; but create sibling uses raw checkbox; Input error variant unused  |
| 5   | Error Prevention            | 3     | Delete confirm + unsaved guard excellent; handle→URL change under-guarded        |
| 6   | Recognition vs Recall       | 3     | Summary aside surfaces path/tree/counts; position still needs recall             |
| 7   | Flexibility & Efficiency    | 2     | No <form>/Enter-to-submit; no Cmd+S; Save always enabled (dirty unused)          |
| 8   | Aesthetic & Minimalist      | 3     | Clean module-tinted single card + summary; minor density                         |
| 9   | Error Recovery              | 2     | Field errors are red text only — no aria-invalid/aria-describedby, no red border |
| 10  | Help & Documentation        | 3     | Per-field supporting copy is genuinely helpful                                   |

## Anti-Patterns Verdict

LLM: NOT AI slop. Disciplined design-system-native form — module-tinted card + summary aside, destructive handling, no cream bg / eyebrows / identical card grids / gradient text. Earned familiarity, appropriate for a product edit surface.
Deterministic: detect.mjs returned [] (clean). HTML/CSS detector over TSX = partial signal.
Visual overlay: skipped — dynamic server route, dev stack owned by user.

## What's Working

1. Control & freedom is genuinely excellent — one unsaved-changes guard wired across Cancel + overlay close/switch/backdrop; Cancel is the consistent leftmost anchor; Delete seated away from Save.
2. Destructive delete confirm names the target AND explains the soft-delete/archive consequence.
3. Live summary aside (path, nested-under, subcategories, product count, timestamps) = recognition over recall with no extra fetch; create/edit symmetry via one SurfaceFrame.

## Priority Issues

[P1] Field errors not programmatically associated. Inputs lack aria-invalid + aria-describedby and don't switch to the DS `error` variant (red border) — only small red text. Screen readers can't tie "Name is required" to the field. Fix: wire fieldErrors -> Input variant="error" + aria-invalid + aria-describedby; give error Text an id. Command: /impeccable harden.
[P2] Handle change silently rewrites the public storefront URL. One muted line for an action that 404s inbound links / breaks SEO. Fix: inline warning at the Handle field when changed (old->new URL), offer a redirect or require confirm. Command: /impeccable clarify.
[P2] Save success too quiet + goes stale. Muted "Saved {time}" is the only confirmation of a consequential edit and lingers after you start editing again. Fix: stronger success affordance (toast/inline row) that clears when the form goes dirty. Command: /impeccable harden.
[P2] No <form>/Enter-to-submit; Save always enabled. Fields aren't in a <form> (no Enter-save, no native semantics); Save fires even with no changes though `dirty` is already computed. Fix: wrap in <form onSubmit>, Save type=submit, disable when !dirty. Command: /impeccable harden.
[P2] Position is a bare integer — weakest reorder affordance. Asks recall of sibling order; create omits it (tree owns reorder). Fix: drop position from edit (match create) or show sibling context. Command: /impeccable layout.

## Persona Red Flags

Alex (power user): no Enter-to-submit, no Cmd+S, mouse-to-Save every time; position forces integer thinking vs dragging the tree.
Sam (accessibility): per-field errors not announced/associated (aria gap); otherwise labels + focus rings + motion-reduce + role=alert present.
Morgan (multi-vertical tenant operator): renames a handle without realizing it breaks live storefront URLs/SEO — warning is one muted line.

## Minor Observations

- Create sibling uses raw <input type="checkbox" className="h-4 w-4"> while edit uses <Checkbox color="module"> — breaks create/edit symmetry AND re-skins a native control (DESIGN.md "Don't re-skin"). Fix in create form.
- "Saved {time}" never clears until next submit — stale beside a now-dirty form.

## Questions to Consider

- Should position editing live here at all, or belong solely to the tree reorder on the list page?
- What's the confident version of a URL-changing rename — a redirect offer baked in?
