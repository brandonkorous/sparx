# brain · authoring contract

> How the sparx brain is built and maintained. Read this before adding or editing any note.
> The brain's job is to be the **single front door** to knowledge that already exists — not a second copy of it.

## What the brain is

An interlinked knowledge graph (Obsidian-style) living in-repo at `docs/brain/`. It exists because the design/architecture knowledge for sparx is real and correct but **scattered across ~12 files in 4 scopes with no entry point** — so UI and features get built detached from it. The brain is the entry point and the traversal path.

- **Nodes** (`design`, `components`, …) are **Maps of Content (MOCs)** — hub notes that index a whole domain and route you to the real sources.
- **Notes** are atomic: **one idea per file**. A note explains a single rule, pattern, decision, or entry, then links out.
- **`README.md`** is the Home map — the front door and task-router. Every non-trivial task starts there.

## The prime directive — the brain IS the memory

The brain is the **durable, primary store** of project knowledge — consulted first and most. It is **not** a thin index over the docs; it *contains* the knowledge.

- **Docs are temporary.** A `docs/NN-*.md` exists to work an idea out at length. Once its durable knowledge is distilled into the brain, **the doc is absorbed and then deleted** — the brain replaces it, it does not point at it as a living source. Write every note **self-contained** (assume its origin doc will be gone), and repoint whatever referenced that doc — `CLAUDE.md`, skills, other notes — to the brain.
- **Code is the one thing that stays.** `tokens.css`, the Prisma schema, k8s / Terraform *run*, so they persist and remain the runtime source of truth for *live values*. The brain **materializes** what you build with (values, mechanisms, gotchas) because code is referenced last — as a **mirror** (below).
- **Substance over thinness.** A note is as full as its knowledge requires. `docs/23`'s stale token table drifted because it was an unmaintained *copy with no owner and no re-sync rule* — not because "duplication" is inherently wrong. The cure is a single **living home** per fact: the brain (for absorbed docs) or code + its mirror (for live values).
- **`sources:`** records where a note's knowledge came from. A code source persists (and is re-synced); a doc source is temporary — its link dies when the doc is deleted, which is fine, because by then the knowledge lives here.

### Mirrors of code

Knowledge drawn from code that *stays* (tokens, schema, manifests) lives in the brain as a **mirror** — the values you build with every time (palette, type scale, spacing, radii, module hues, elevation) written out in full ([[dashboard-tokens]] + the [[site-tokens]] companion), because a pointer to `tokens.css` is useless if it's never opened. A mirror carries a *contract*:

- The sheet is marked a **mirror** and names its source file.
- It **must be re-synced in the same change that edits the source** (boy-scout: touch the tokens → update the mirror).
- If the mirror and the source disagree, **the source wins** — and the mismatch is a bug to fix now. That exact drift rotted `docs/23 §4` ([[spec-drifted-from-token]]).

`type: reference` sheets are also exempt from the one-idea-per-file rule — a constants table is one cohesive artifact.

## Note anatomy

Every note is markdown with this frontmatter:

```markdown
---
title: <human title>
node: <parent node slug, e.g. design>   # omit for node hubs themselves
type: rule | pattern | decision | entry | reference | map
status: active | draft | superseded
applies-to: [dashboard] | [site] | [both] | [n/a]   # design/component notes MUST set this
sources:
  - <path or docs/NN §X — the source of truth>
---

<the single idea, stated plainly.>

**Why:** <the reason it exists — the failure it prevents.>
**How to apply:** <what you concretely do at build time.>

Related: [[other-note]], [[another-node]]
```

- **`applies-to` is mandatory on anything design- or component-related.** The #1 latent error is conflating the two design systems: dashboard (`--color-*` / `@wizeworks/ui` / `ModuleProvider`) vs site (`--st-*` / `@sparx/site-ui` / `surface-compile`). A note that doesn't declare which one it governs is a trap.
- Link **liberally** with `[[slug]]`. A link to a note that doesn't exist yet is fine — it marks a note worth writing, not an error.

## File naming

- Node hubs: the slug, e.g. `design.md`, `components.md`.
- Notes: kebab-case slug of the idea, e.g. `color-follows-functionality.md`, `no-eyebrows.md`, `stripe.md`.
- Sub-areas of a big node get a folder: `design/`, `integrations/`. A node hub may live at `<node>.md` next to its `<node>/` folder, or as `<node>/README.md` — pick one per node and stay consistent.

## Staleness & quarantine

Never silently delete a superseded idea — a cached summary or a teammate may still carry it. Instead:

- Set `status: superseded` and add `Superseded by: [[new-note]]` at the top.
- Node hubs carry a **Quarantine** section listing sources that look authoritative but are stale, with the reason. Current quarantine (from the design audit): `docs/18-frontend-architecture.md` (HSL blue tokens, Inter, pre-CVA) and `docs/sparx-design-tokens.css` (diverged token file — the root doc-map even points at it by mistake).

## Adding a node or an entry

- **New node:** add the hub file, register it in `README.md`'s node table and task-router, and give it a Quarantine + Sources section.
- **New integration/tool** (we adopt Stripe-connect, a new queue, a new vendor): add a note under `integrations/`, state what it's for, where it's wired, and active/planned; link it to the node where its runtime lives. Record **rejections** too (why we did *not* pick X).
- **New rule/pattern discovered while building:** write the atomic note in the owning node, link it from the node hub, and — if it's a build-time gotcha — cross-link the relevant skill (`form-surface`, `surface-review`).

## Relationship to the other knowledge stores

- **This brain** = shared, in-repo, version-controlled project knowledge for *anyone* working the codebase.
- **`.claude` memory** = the operator's personal working-preferences vault (loads per turn). It should *point at* this brain, not duplicate it.
- **`CLAUDE.md` files** = binding, always-loaded instructions. The brain indexes them; it does not replace them.
- **`docs/NN-*.md`** = the long-form specs. The brain is the map over them.
