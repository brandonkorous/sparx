# brain · authoring contract

> How the sparx brain is built and maintained. Read this before adding or editing any note.
> The brain's job is to be the **single front door** to knowledge that already exists — not a second copy of it.

## What the brain is

An interlinked knowledge graph (Obsidian-style) living in-repo at `docs/brain/`. It exists because the design/architecture knowledge for sparx is real and correct but **scattered across ~12 files in 4 scopes with no entry point** — so UI and features get built detached from it. The brain is the entry point and the traversal path.

- **Nodes** (`design`, `components`, …) are **Maps of Content (MOCs)** — hub notes that index a whole domain and route you to the real sources.
- **Notes** are atomic: **one idea per file**. A note explains a single rule, pattern, decision, or entry, then links out.
- **`README.md`** is the Home map — the front door and task-router. Every non-trivial task starts there.

## The prime directive — index, don't duplicate

The existing docs already drifted (`docs/23`'s token table claims to "mirror `tokens.css` exactly" and no longer does). **Do not repeat that mistake here.**

- Every note names its **source of truth** (a file, a doc section, or the code) and **links to it**.
- Summaries are **thin** — just enough to know the rule and where to act. If you're tempted to paste a token table or a full spec, link it instead.
- When the source changes, update the **link and one-line summary**, never fork a second authoritative copy into the brain.
- If a note *is* the only home for a fact (a decision, an ADR, a "why we rejected X"), say so explicitly: `Source of truth: this note.`

## Note anatomy

Every note is markdown with this frontmatter:

```markdown
---
title: <human title>
node: <parent node slug, e.g. design>   # omit for node hubs themselves
type: rule | pattern | decision | entry | reference | map
status: active | draft | superseded
applies-to: [dashboard] | [storefront] | [both] | [n/a]   # design/component notes MUST set this
sources:
  - <path or docs/NN §X — the source of truth>
---

<the single idea, stated plainly.>

**Why:** <the reason it exists — the failure it prevents.>
**How to apply:** <what you concretely do at build time.>

Related: [[other-note]], [[another-node]]
```

- **`applies-to` is mandatory on anything design- or component-related.** The #1 latent error is conflating the two design systems: dashboard (`--color-*` / `@sparx/ui` / `ModuleProvider`) vs storefront (`--st-*` / `@sparx/site-ui` / `surface-compile`). A note that doesn't declare which one it governs is a trap.
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
