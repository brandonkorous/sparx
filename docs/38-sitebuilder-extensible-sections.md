# Site Builder — User-Extensible Sections

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

---

## 1. Purpose & the core constraint

Today a Site Builder section is **code-first and trusted** ([docs/37](37-sitebuilder-section-system.md) §2.1).
Adding one means an engineer touches five places and ships a deploy:

1. **Zod schema** — the config contract ([sections/hero.ts](../packages/sitebuilder-schemas/src/sections/hero.ts) `HeroConfig`)
2. **`SectionField[]`** — the editor form spec (`heroFields`)
3. **Register** in `SECTION_REGISTRY` ([section-registry.ts](../packages/sitebuilder-schemas/src/section-registry.ts))
4. **React renderer** in [apps/storefront/components/sections/](../apps/storefront/components/sections/)
5. **`switch` case** in [section-renderer.tsx](../apps/storefront/components/section-renderer.tsx)

This document specifies how we let **merchants and agencies add their own components without a deploy** — and
just as importantly, where we deliberately stop, because the storefront render path is a multi-tenant server
surface and arbitrary user code on it is a non-starter.

### 1.1 The pivotal observation

Four of those five steps are **already data, or trivial dispatch**:

- The field system ([fields.ts](../packages/sitebuilder-schemas/src/fields.ts)) is a pure descriptor — 14 field
  types including `list` with recursive `itemFields`. The dashboard generates the inspector form _from data_
  already; nothing about it is section-specific code.
- The registry (step 3) and the `switch` (step 5) are lookups. A dynamic registry replaces them mechanically.
- A validator can be **derived from** the field spec, so step 1 need not be hand-written Zod.

**Only step 4 — the renderer — is genuinely hard.** It is arbitrary React executing inside the storefront's
server render (RSC), in a multi-tenant process. Untrusted user code there is an RCE / cross-tenant
exfiltration risk; even client-only it is stored XSS against the tenant's shoppers. So the entire problem
reduces to one question:

> **What do we replace the React renderer with for user-authored sections?**

Every option below is an answer to that question, ordered by how much of the code→data move it makes and,
correspondingly, how much new surface it opens.

### 1.2 Where this fits

This refines [docs/37](37-sitebuilder-section-system.md)'s registry model and slots under
[docs/36](36-sitebuilder-layering-model.md)'s **PageLayout** tier. It is the realization of an intent already
written into the codebase: [page-templates.ts](../packages/sitebuilder-schemas/src/page-templates.ts) states
that "a DB-backed, merchant-extensible catalog is a later, purely-additive step that does NOT change this
model" (doc 36 §10). The marketplace endpoint (Phase D) is the `sparx.market` domain already reserved in
[docs/00-README.md](00-README.md) for the "theme/plugin/connector marketplace."

**Out of scope:** the editor shell/preview transport (doc 30), brand/theme tokens (doc 33), and layout
assignment/resolution (doc 36). Section _composition_ gaps live in doc 37.

---

## 2. As-built: what is already data vs. code

| Step | Artifact        | Status today                                     | What user-extensibility needs                                    |
| ---- | --------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 1    | Config contract | Hand-written Zod per section                     | A validator **compiled from** the field spec                     |
| 2    | Editor form     | `SectionField[]` — **already a data descriptor** | Nothing; the form already generates from data                    |
| 3    | Catalog entry   | Static `SECTION_REGISTRY` (global, code)         | A **tenant-scoped registry layer** merged over the code registry |
| 4    | Renderer        | Arbitrary React, SSR, trusted                    | A **safe, declarative render template** — the hard part          |
| 5    | Dispatch        | `switch (sectionType)`, skips unknown            | "Resolve a tenant definition, _then_ skip"                       |

Two existing behaviors are load-bearing for everything below:

- **`SectionRenderer` skips unknown `sectionType`s** rather than crashing — the forward-compat hook that lets a
  published snapshot carry a type the running build doesn't statically know. Dynamic resolution slots in
  exactly here.
- **Published configs are snapshotted immutably** into `SiteVersion` ([49-sitebuilder.prisma](../packages/db/prisma/schema/49-sitebuilder.prisma)).
  Any user-defined _definition_ must be pinned into (or alongside) that snapshot so a published page stays
  deterministic and rollback is exact.

**Precedents already in the repo** (we are not inventing a new pattern, only extending one):

- `SiteTheme` — a tenant-saved, named, RLS-scoped presentation artifact. Phase B is the same pattern for
  section content.
- `DEFAULT_TEMPLATES` / `PAGE_TEMPLATES` — a code-first catalog instantiated into editable rows, explicitly
  designed to grow a DB-backed merchant catalog additively.

---

## 3. The four phases

Sequenced by leverage and risk, each independently shippable ([[feedback_deploy_early_deploy_small]]).

### Phase A — Compose, don't author _(no new types; in flight)_

Richer generic primitives plus a slot/container section, so merchants assemble novel layouts from **safe
building blocks they already have**. This is the road doc 37 is already on — `panels`, `media-text`, the
shared `MediaBlock`, `ctas[]`.

- **For:** non-technical merchants.
- **Render path:** unchanged (code renderers).
- **New surface:** none. Highest ROI, zero new security surface. It dissolves most of the demand for "I need a
  new component" before we ever build an authoring system.
- **Exit:** a merchant can build the majority of observed landing layouts from stock sections (doc 37 §3.1
  archetype cross-check passes).

### Phase B — Saved blocks _(a tenant pattern library; pure data)_

Let a merchant configure a section — or a group of sections — and **save it as a named, reusable block**
("my product feature card"). It is `config` JSON (and an ordered section list) over **existing** types.

- **For:** any merchant; the cheapest thing that literally answers "users add components they reuse."
- **Data/DB:** new `tenant_section_presets` (tenant-scoped, ENABLE+FORCE RLS) — `{ name, kind: section|group,
payload: JSON }`. Mirrors `SiteTheme`.
- **Render path:** unchanged — a block expands to ordinary `SiteSection` rows on insert.
- **Editor:** a "Save as block" action and an "Insert block" picker beside the section library.
- **Snapshot:** none needed — once inserted, a block is just sections; the saved preset is authoring-time only.
- **API/MCP:** CRUD on presets; "insert preset into layout."
- **Exit:** a merchant saves a configured section and re-inserts it on another page/layout.

### Phase C — Declarative custom section types _(the strategic unlock)_

Let a technical merchant/agency define a **brand-new section type as data** — fields + a safe render template —
with no deploy. This is the phase that genuinely answers the title question; §4 specs it.

- **For:** technical merchants, agencies, and (via API/MCP) AI authoring.
- **Data/DB:** `tenant_section_definitions` (tenant-scoped RLS) — `{ slug, label, icon, fieldSpec: JSON,
template: JSON, version }`.
- **Render path:** **new** — a sandboxed template interpreter; no user JS executes.
- **Editor:** the form auto-generates from `fieldSpec` (reusing today's `FieldControl`); a "section studio"
  authors the field list + template.
- **Snapshot:** publish **pins the definition** (or its version) into the version so render is deterministic.
- **API/MCP:** define / update / version a section type.
- **Exit:** a merchant defines a new section type, places it, publishes, and it renders on the storefront —
  with no engineer involvement and no deploy.

### Phase D — Marketplace / partner sections _(vetted, platform-level)_

For genuinely arbitrary UI beyond what a declarative template expresses, **vetted partners publish section
packages** that pass review and are baked into the platform image (or a plugin runtime), surfaced via the
`sparx.market` marketplace.

- **For:** the ecosystem; cross-tenant distribution.
- **Render path:** real code, but **reviewed and platform-owned**, never per-tenant arbitrary React in SSR.
- **Guard:** per-tenant arbitrary React on the storefront server is explicitly **out of scope** without
  isolate-level sandboxing — the multi-tenant blast radius is too large. Phase D is gated behind review and
  distribution, not self-serve code execution.
- **Exit:** a third party publishes a section other tenants can install from the marketplace.

---

## 4. Phase C in depth — the declarative section system

Phase C is four sub-systems. Three already mostly exist; the fourth (the template) is the real design work.

### 4.1 Field spec — _reuse, don't rebuild_

A custom section's editable settings are a `SectionField[]` ([fields.ts](../packages/sitebuilder-schemas/src/fields.ts)),
the **same descriptor** stock sections use. The dashboard already renders these recursively, so a custom
section's inspector form is free. Field types stay the curated allowlist (text, select, media, list, range,
…) — a user picks from them, they do not invent field types.

### 4.2 Derived validator — _replace hand-written Zod_

Today each section hand-writes a Zod schema. For custom sections we **compile a validator from the field
spec** (`fieldSpec → Zod`), so `parseSectionConfig` still validates + defaults config at the boundary exactly
as it does for code sections. The registry's `parse`/`defaults` contract is unchanged; only the schema's
_origin_ differs (derived vs. authored).

### 4.3 The safe render template — _the core decision_

The renderer becomes an **interpreted, declarative template**, never user JS. A template is a JSON tree of
**allowlisted layout primitives** whose props bind to field values, the bound item (for product/collection
scope), and theme tokens:

- **Primitives:** `Stack`, `Grid`, `Box`, `Text`, `Heading`, `Image`, `Button`, `Repeater` (iterates a `list`
  field), `Link`. A closed set — additive only by platform.
- **Bindings:** props reference `{{ field.heading }}`, `{{ item.title }}`, `{{ index }}` — a restricted
  expression surface with **no function calls, no arbitrary JS, no network**.
- **Styling:** props map **only to `--sf-*` tokens** (e.g. `tone="muted"`, `pad="lg"`), never raw hex or free
  CSS — the same brand rule that binds code sections (doc 37 §6, [[feedback_sparx_ui_decisions]]). The
  template literally cannot express an off-token color.
- **Output:** server-rendered to sanitized HTML; any embed/iframe primitive is **host-allowlist-validated**,
  reusing the allowlist doc 37 §9 already requires for the Embed section.

This keeps custom sections on the storefront's own CSS surface (it does not consume `@sparx/ui`) and inside
the flat-stack model — a custom section is one block, not a nesting mechanism.

The template language is specified in full — node set, value-expression grammar, the `sf-tpl-*` CSS contract,
the derived validator, snapshot pinning, and a worked `custom:icon-grid` example — in the handoff spec
[docs/handoffs/sitebuilder-custom-section-template-spec.md](handoffs/sitebuilder-custom-section-template-spec.md),
which resolves open question #1 below in favor of a **typed JSON component AST** (not a string grammar).

### 4.4 Tenant registry + dispatch

`getSectionDefinition` / `sectionsForTarget` gain a **merge layer**: the static `SECTION_REGISTRY` overlaid
with the tenant's `tenant_section_definitions`. Collision rule: a tenant slug may not shadow a code type
(namespacing, e.g. `custom:<slug>`). `SectionRenderer`'s "skip unknown" becomes "resolve a tenant definition →
interpret its template → _then_ skip if still unresolved." Bound (product/collection) custom sections obey the
same target/binding gate as code sections.

### 4.5 Snapshot pinning

Publishing must capture the definition the page depends on. Either embed the resolved definition into
`sectionsSnapshot`, or store a `definitionVersion` ref and snapshot the definition rows immutably alongside the
`SiteVersion`. Requirement: **a published page renders identically forever, and rollback is exact**, even if
the merchant later edits or deletes the live definition. The "unknown type degrades gracefully" property is
preserved as the final fallback.

---

## 5. Guardrails (binding on every phase)

1. **No untrusted code on the storefront server.** Templates are interpreted; output is sanitized. Arbitrary
   per-tenant React in SSR is out of scope (Phase D is reviewed, platform-owned code).
2. **Token-only theming.** Custom sections express style solely through `--sf-*` tokens — no raw hex, no free
   CSS. The brand rule is enforced by the template's prop surface, not by review.
3. **Tenant isolation via RLS** on every new definition/preset table, consistent with the rest of
   `sitebuilder_*` ([[feedback_sparx_db_rls_pattern]]).
4. **Deterministic snapshots.** A published page must not change when its source definition changes; pin or
   embed the definition at publish.
5. **Embed/iframe host allowlist + CSP** `frame-src` parity (doc 37 §9) for any embed primitive.
6. **API-first / MCP-native.** Definitions, presets, and blocks are authored through the API and MCP layer,
   not only the dashboard (doc 00 principles 4–5).
7. **Responsive + mobile authoring.** The section studio and any new editor surface collapse to one stacked
   column on small screens ([[feedback_responsive_builder_mobile]]).

---

## 6. Open questions

1. **Template language: build vs. adopt.** ~~A bespoke JSON primitive tree vs. a restricted templating
   grammar.~~ **Resolved** → typed JSON component AST, interpreted server-side, compiling to a closed
   `sf-tpl-*` class family. See [handoff spec](handoffs/sitebuilder-custom-section-template-spec.md).
2. **Definition versioning & migration.** When a merchant edits a definition that live + published pages
   reference, what migrates and what stays pinned? (Ties to §4.5.)
3. **Where the interpreter lives.** A new runtime package vs. extending `@sparx/sitebuilder-schemas` (which is
   deliberately zod-only and React-free). Likely a separate `@sparx/section-runtime` so backends never pull
   React ([[feedback_dockerfile_package_wiring]]).
4. **Cross-tenant sharing / export** — the bridge from Phase B/C (tenant-private) to Phase D (marketplace
   distribution). Export format = the same definition JSON?
5. **Performance.** Interpreting templates at SSR vs. precompiling a definition to a cached render function at
   publish. Measure before optimizing.
6. **Section studio UX.** How a non-React author composes a template tree (visual primitive builder vs. a
   guided form). This is its own design slice, deferred to the Phase C build.

---

## 7. Phasing summary

| Phase | Ships                            | Render path              | New data                     | Deploy to add a component?         |
| ----- | -------------------------------- | ------------------------ | ---------------------------- | ---------------------------------- |
| **A** | Richer primitives + container    | Code (unchanged)         | —                            | Yes (engineer) — but rarely needed |
| **B** | Saved blocks / pattern library   | Code (unchanged)         | `tenant_section_presets`     | No (reuses existing types)         |
| **C** | Declarative custom section types | **Interpreted template** | `tenant_section_definitions` | **No**                             |
| **D** | Marketplace / partner sections   | Reviewed platform code   | marketplace catalog          | No (install from market)           |

A → B are low-risk and near-term; **C is the architectural centerpiece** and the true answer to "let users add
components," with the field system already covering half of it; D is deferred behind a review/distribution
gate.
