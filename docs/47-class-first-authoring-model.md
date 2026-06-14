# 47 — Class-First Authoring: Brand-Governed Components & the Per-Tenant CSS Pipeline

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-06-02

> The composition model ([40](40-sitebuilder-composition-model.md)) makes a website a tree of
> nodes, each carrying a **box base** of presentation props. `@sparx/site-ui`
> ([46](46-site-ui-component-library.md)) already moved leaf _treatment_ into shared,
> token-driven semantic CSS. This doc takes the next step: make **brand-governed component
> classes the primary authoring surface**, so the tree carries a class string instead of a fat
> per-node style blob. The result is sites that are **uniform and robust by default** — the
> system guarantees consistency instead of asking every author to reassemble it — while still
> **enabling power users** through a tiered escape hatch. It is supported by a per-tenant CSS
> compile that runs only when a tenant edits in the brand designer.

---

> **Locked (v1.1, 2026-06-02).** The semantic CSS system is named **Surface**. It ships from the
> (grown) `@sparx/site-ui` package — renamed `@sparx/surface`, a clean move since it has no
> consumers wired yet, **not** a third library. The per-node `box` **loses presentation** (height,
> width, color, padding, surface — already expressible as classes) and **keeps only data** (media
> URLs, `binding`, `href`, embed URLs, counts). Node shape becomes
> `{ type, class, data, binding?, children? }`. Two thin things inherit the box's old jobs: a
> **versioned class-vocabulary contract** (tenant data now stores class names, so archetype/variant
> names are a stable API — rename only with an alias/migration) and a **control registry** (the
> color / size / variant selectors that read & write class groups — the structured inspector the box
> props used to be). The one piece of box "magic" to re-home deliberately: full-bleed background
> with contained content becomes an explicit **Section archetype**.

---

## 1. The problem: the box is the fragility

The Builder shipped with a powerful substrate: every node carries a freeform `box` (and
containers a `layout`) — alignment, surface, padding, height, gap, overlay, tone, all
independently set per node. That substrate is necessary (it's how we recreate an arbitrary
reference page), but **authoring directly against it is the entire authoring surface today**, and
that is the source of three real symptoms:

- **Not uniform.** Two cards that are "the same kind of thing" are two _independent_ freeform
  boxes. Their consistency is coincidental — the author typed the same eight axes twice. There is
  no shared definition to enforce that they match.
- **Fragile.** Change one box by accident and the rhythm breaks, silently, with nothing to catch
  it. The model can express incoherent combinations as easily as good ones.
- **Shopify-grade.** Infinite per-section knobs, where coherence is the author's burden — exactly
  the failure mode we are trying to beat.

Concretely, from the Tesla recreation ([`tesla-model-3.page.json`](../tesla-model-3.page.json)) —
the six "Meet Model 3" cards:

```jsonc
{ "type": "Card", "box": { "surface": "none", "height": "md", "padding": "md",
  "textTone": "light", "overlay": "dark", "backgroundImage": "…" }, … }
// …repeated five more times, the same eight-axis box, by hand.
```

Six instances of one component, and the system has no idea. doc 40 already named this: it defined
**Tier 1 primitives** (the freeform box substrate) and **Tier 2 data-aware components** (the
product). We built Tier 1 and shipped it as the front door. There is no component tier on top, so
every page is reassembled from raw axes.

### 1.1 Today's renderer already emits uncontrolled CSS

The reflex objection to "let authoring touch CSS" is multi-tenant safety. But the site
renderer ([`builder-renderer.tsx`](../apps/site/components/builder-renderer.tsx)) **already
emits arbitrary inline CSS on every node** from its box→CSS compiler:

```html
<!-- today, per node -->
style="position:absolute; top:0; left:0; right:0; z-index:40; width:100%; background:transparent;
display:flex; justify-content:center; align-items:stretch;"
```

That is custom CSS — raw values, per node, unbounded, just authored by our code instead of the
user. What this doc proposes is **strictly more tokenized and themeable** than what we ship now:

```html
<!-- proposed -->
class="navbar bg-base-100 shadow-sm"
```

`bg-base-100` is a token reference; `navbar` is a brand-governed component. The class output is
safer and more uniform than the inline-style output it replaces. The real safety boundary was
never _classes vs. inline_ — it is **who authors the string, from what vocabulary** (§6).

---

## 2. The model in one paragraph

A node carries a **class string** drawn from a brand-governed vocabulary — named component
archetypes (`navbar`, `hero`, `card-feature`) plus a bounded set of token-mapped utilities
(`bg-base-100`, `shadow-sm`, `gap-6`). The class owns the node's **styling**; the tree continues
to own **structure and data binding**. The freeform `box` becomes the **escape hatch**, not the
default. Component classes ship once in `@sparx/site-ui`; the small per-tenant set of utility
classes a tenant actually used is compiled into a `tenant.css` at publish time (and a `temp.css`
on save for live preview). This collapses "box on everything," makes consistency the system's
guarantee rather than the author's chore, and — because the editor and the site emit the
same classes against the same compiled sheet — makes _preview == production_ fall out for free.

---

## 3. The split: structure vs. styling

The clean line that makes everything else fall into place:

| Concern                                                  | Owner                  | Form                                                   |
| -------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| **Structure** — nesting, parent/child, which node        | the **tree**           | node graph                                             |
| **Data binding** — single / scope / iterate, cardinality | the **tree** (binding) | `binding` ([43](archive/43-builder-binding-schema.md)) |
| **Styling** — surface, rhythm, treatment, color          | the **class string**   | `navbar bg-base-100 shadow-sm`                         |
| **Per-instance data** — image URL, computed value        | **inline / data**      | `style`/`props` set by the engine                      |

A class cannot express "iterate this subtree once per product in a bound array," nor the
parent/child nesting — that stays the tree's job. So we are **not deleting the tree**; we are
putting it on a diet. Each node goes from `{ structure + binding + a heavy box blob }` to
`{ structure + binding + a class string }`. Lighter, less fragile, and the styling is now shared
and brand-governed instead of copied per node.

### 3.1 Before / after

```jsonc
// before — freeform box, copied per instance
{ "type": "Card", "box": { "surface":"none","height":"md","padding":"md",
  "textTone":"light","overlay":"dark","backgroundImage":"https://…/slide-1.png" } }

// after — one brand-governed archetype + the only dynamic bit as data
{ "type": "Card", "class": "card-feature", "props": { "media": "https://…/slide-1.png" } }
```

```jsonc
// before — box + layout fully spelled out
{ "type": "Section", "box": { "surface":"muted","backgroundWidth":"full",
  "contentWidth":"contained","padding":"lg" },
  "layout": { "direction":"row","gap":"md","justify":"between","alignItems":"center" } }

// after — the archetype encodes the flex row + surface + padding
{ "type": "Section", "class": "navbar bg-base-100 shadow-sm" }
```

Restyle the brand → every `card-feature` and every `navbar` moves together. That is the
uniformity guarantee the freeform box cannot give.

---

## 4. Authoring tiers (the escape-hatch ladder)

Because custom CSS and custom utilities are _more_ freeform per-node styling — the sharpest,
least-governed version of the exact fragility we're killing — they are **not peers of the
archetype tier**. They are the lower rungs of a ladder: more power, more danger, more gating, used
less the further down you go. This realizes doc 40 §5.4's "smart defaults, explicit overrides —
never magic without an escape hatch."

| Tier                              | Surface                                                              | Vocabulary                                                                        | Safety                                           | Who                               |
| --------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| **1 — Archetypes** _(default)_    | Pick a brand-governed component ("Hero", "Feature Card", "Stat Row") | Named `site-ui` component classes                                                 | Can't break things — coherent by construction    | All tenants                       |
| **2 — Box axes** _(advanced)_     | The existing box/layout axes                                         | Closed enums, token-backed scales                                                 | Bounded; the engine's inline compiler            | All tenants                       |
| **3 — Token utilities** _(power)_ | A class field on the node                                            | **Safelisted** utilities mapped to `--st-*` (`bg-base-100`, `gap-6`, `shadow-md`) | Allowlisted vocabulary; compiled per tenant (§5) | Power users                       |
| **4 — Raw CSS** _(expert)_        | A scoped CSS block                                                   | Arbitrary CSS                                                                     | **Scoped + sanitized + security-reviewed** (§6)  | Gated to a Code / Enterprise tier |

Tiers 1–2 are the "easy, safe, default" path and serve >95% of authoring. Tier 3 is the
power-user lever for the bespoke layout. Tier 4 is the nuclear option, gated and constrained. A
node never _needs_ to descend; it descends only when the tier above can't express the intent.

### 4.1 Prefer value-overrides over free-text where possible

For "I need more control than the scale" (a one-off `vh`/`px`/color), the cheapest safe answer is
**not** a free-text class field — it is an _advanced value-override panel_ that writes a scoped
`--st-*` override or an inline `style`. This is what the box→CSS engine already does. It
**sidesteps the compile pipeline entirely** (you set a value, you don't generate a class) and is
safe by construction. Reserve Tier 3/4 free-text for users who specifically want utility/CSS
muscle memory.

---

## 5. The per-tenant CSS compile

Tier 3 utilities are author-typed at runtime (stored in the tree). Tailwind is a build-time JIT
compiler — it only generates CSS for classes it can **see in scanned source at build time**, so a
class typed by an author produces _no_ CSS unless we generate it. The fix is to **treat the
tenant's tree as the content source** and compile on the events that already exist.

### 5.1 Three layers, not one

| Layer                                                       | What                                         | When built                                                                 | Scope                                  |
| ----------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| **Token theme** (`--st-*`)                                  | One stylesheet, runtime CSS vars             | per request (compiled by `@sparx/site-themes`, [33](33-token-model-v2.md)) | themes infinite tenants from one sheet |
| **Component library** (`site-ui` semantic CSS + archetypes) | `navbar`, `hero`, `card-feature`, the recipe | once, at **platform** build                                                | shipped to every tenant                |
| **Per-tenant utility delta** (`tenant.css`)                 | Only the utilities a tenant actually typed   | on **save** (`temp.css`) and **publish** (`tenant.css`)                    | small static diff, one tenant          |

The per-tenant delta is the _only_ new artifact, and it is small — it is the utilities **beyond**
the shipped archetype/recipe CSS, generated from that one tenant's pages.

### 5.2 The pipeline

1. **Tree-shake.** Collect every literal class string from every node in the tenant's tree (and
   chrome). This works precisely because authored classes are **literals** (`bg-base-100`), never
   runtime concatenations (`bg-${x}`), so they are statically extractable. Arbitrary values
   (`top-[37px]`) extract and compile through this too — no safelist needed for them.
2. **Compile** that class set with a **tenant-flavored Tailwind theme** whose color utilities
   (`bg-base-100`, `text-base-content`, `bg-primary`) resolve to `--st-*`, isolated from the
   dashboard's Tailwind (which maps the same utility names to the _admin_ `--color-*` palette).
   This is what keeps us from contradicting doc 46 §3.1's rejection of Tailwind for the library:
   the **library** stays hand-authored semantic CSS; only the **per-tenant author delta** is
   compiled, and it never enters the platform's Tailwind content.
3. **On save** → emit `temp.css`, inject into the editor canvas so preview reflects the new class
   immediately (debounced; compiling a few hundred classes is milliseconds).
4. **On publish** → emit a **content-hashed** `tenant.css`. Make publish **atomic**: write the
   hashed sheet, _then_ flip the published pointer, so a page never paints before its CSS exists
   (no FOUC). This slots into the existing publish flow — enqueue it off the publish event
   (Pub/Sub) or run it inline at publish.

This is event-driven and runs **only when the brand designer is used** — never per request, never
in the hot path.

### 5.3 Authoring the library: `@apply` over a tenant-flavored theme

Surface components are **not** hand-authored raw CSS. Each semantic class is composed from Tailwind
utilities with `@apply`, against a **Surface Tailwind theme** whose tokens map to `--st-*` — so
`rounded` / `border` / `shadow` / spacing / color utilities all resolve to tenant-themeable vars,
never baked values:

```css
@layer components {
  .card {
    @apply rounded border shadow-sm; /* static utilities → --st-* vars via the Surface theme */
    border-color: var(--c-bg); /* color axis: role var (or @apply border-[color:var(--c-bg)]) */
  }
}
```

Two rules make this work:

1. **`@apply` is resolved at _Surface's own_ build.** The shipped `styles.css` is plain CSS —
   consumers never scan Surface into their Tailwind `content`, and the dashboard's Tailwind never
   touches Surface classes. The build coupling doc 46 §3.1 rejected does not occur.
2. **The color × variant axis is a role var, not an interpolated class.** You cannot
   `@apply border-{color}` — Tailwind needs concrete utility names, and a class-per-color is the
   cartesian explosion the recipe exists to avoid. So fixed styling → `@apply`; the dynamic color
   flows through `var(--c-*)`, set by the `.st-c-{color}` class the color selector writes. One
   component rule serves every color.

Components live in `@layer components`; utilities win over them in the cascade — exactly the override
the tier ladder (§4) needs (a Tier-3 utility beats an archetype's `@apply`'d property).

> **Amends doc 46 §3.1**, which rejected Tailwind for `site-ui` on the premise it meant _shipping
> unresolved utilities_. `@apply`-at-build ships plain CSS, so that premise no longer holds; Surface
> gains a Tailwind build step with the tenant-flavored theme. The chosen _output_ (plain token-driven
> CSS) is unchanged — only the _authoring source_ becomes Tailwind `@apply`.

---

## 6. Multi-tenant safety

doc 40 §11's rendering invariant stands: **emit tokenized, themeable output; no path from
authored data to executable strings.** The tiers respect it:

- **Tiers 1–2** emit only library classes and closed-enum values — inherently safe and tokenized.
- **Tier 3** is bounded by an **allowlist** of utilities. The allowlist exists to block
  weaponizable utilities even though they're "just classes": `fixed inset-0 z-[9999]`
  (clickjacking overlay), arbitrary-`url()` values (exfiltration / external loads). Layout,
  spacing, radius, shadow, and `--st-*`-mapped color utilities are allowed; positioning,
  z-index escalation, and external-URL arbitrary values are not.
- **Tier 4** raw CSS is the only surface that needs real machinery: every selector **scoped** to
  the node (selector-prefix compile, `@scope`, or a shadow boundary so it can't reach global
  chrome or sibling nodes) and **sanitized** (`@import` stripped, `url()` host-allowlisted,
  `position: fixed` blocked). This is a security-reviewed subsystem and a deliberate, gated tier —
  not a passthrough, and not "easy."

The key correction this doc records: the safety boundary is **controlled-vocabulary-emitted-by-our-controls
vs. arbitrary-human-free-text**, not classes vs. inline. When our brand-governed controls emit the
class, it is safe and it is the better architecture. Only the free-text rungs (3, 4) carry a
guardrail, and each guardrail is bolted onto one optional input.

---

## 7. The brand designer governs the vocabulary

The class vocabulary is not a free-for-all — it is **owned by the tenant's brand**, extending
Token Model v2's "brand owns identity + shape + rhythm" ([33](33-token-model-v2.md)) one rung up:
the brand now also governs **component archetypes**.

- **Tokens** (existing) — color palette, radius, spacing, type. The `--st-*` layer.
- **Archetypes** (new) — what `card-feature`, `hero`, `navbar` _look like_ for this tenant, set
  once. Changing the archetype restyles every instance across every page.
- **Utility allowlist** (new) — which Tier-3 utilities are exposed, mapped to the token scale.

This is the mechanism that delivers the headline: **consistent sites that enable power users.**
Consistency comes from archetypes + tokens being brand-level decisions made once; power comes from
the lower tiers being available when needed.

---

## 8. Preview == production, for free

Both the editor canvas and the site emit the **same class strings** and load the **same
compiled `tenant.css`** (the canvas via `temp.css`, the site via the published
`tenant.css`). They cannot drift, because the styling is the same artifact rather than two
re-implementations — finishing the parity goal `@sparx/site-ui` ([46](46-site-ui-component-library.md))
started for leaves, now extended to box/section archetypes.

---

## 9. Relationship to existing docs

- **Descends from [40](40-sitebuilder-composition-model.md).** This is Tier 2 (data-aware,
  brand-governed components) made real, with the box demoted to Tier-1 escape hatch. Where 40's
  structural model and this doc agree, this doc specifies the _authoring surface_ 40 left open.
- **Extends [46](46-site-ui-component-library.md).** 46 chose semantic CSS keyed on `--st-*` and
  set the "treatment → class, data → inline" division. 47 makes the class the _primary_ surface,
  adds **box/section archetypes** to the library (not just leaves), and adds the per-tenant
  compile. 46 §3.1's rejection of Tailwind-for-the-library is preserved (§5.2).
- **Extends [35](35-ui-variant-system.md) / [33](33-token-model-v2.md).** The archetypes compose
  on the same role-var recipe and `--st-*` palette; the brand designer gains archetype governance.
- **Feeds [38](38-sitebuilder-extensible-sections.md).** Tenant-defined component types become a
  natural extension of the archetype vocabulary + the per-tenant compile.
- **Touches [44](archive/44-builder-site-render.md) / [45](45-builder-site-layout.md).** Both
  renderers emit the class string and load the compiled sheet; the box→CSS engine remains for
  Tier-2 and for per-instance data.

---

## 10. Non-goals & deferred

- **Not deleting the box engine.** It remains as Tier-2 and as the inline path for per-instance
  data (image URLs, computed heights, binding-driven structure).
- **Not compiling the whole design system per tenant.** Only the small author-typed utility delta
  is per-tenant; the library and the token theme are shared.
- **Tier 4 (raw CSS)** ships last, gated to a paid Code/Enterprise tier, behind its scoping +
  sanitization subsystem.
- **Archetype taxonomy** (the starting set of named sections/cards) is decided in Phase B below;
  this doc locks the _model_, not the catalog.

---

## 11. Build order

**Phase 0 — Surface foundation.** Name the system **Surface**; rename `@sparx/site-ui` →
`@sparx/surface` (no consumers wired yet, so the rename is clean). Lock the role-var recipe across
**five axes** — size · modifier · behavior · style (treatment) · color — composed through `--c-*`
role vars (no cartesian product), plus **parts** (named sub-elements: `card` → `card-body`,
`card-title`). Stand up the two build outputs: the static library stylesheet (platform build) and
the per-tenant compile scaffolding (§5).

**Phase A — Node model.** Add `class` + the slim `data` slot to the node base; drop presentation
from `box`. Both renderers apply the class. Non-destructive bridge — legacy box still renders during
migration.

**Phase B — Surface library.**

- **B1 Layout archetypes (non-Radix):** Section, Grid, Container — including the full-bleed /
  contained Section archetype that re-homes the old outer/inner box pattern.
- **B2 Controls & primitives:** Button, Badge, etc. on the five-axis recipe + parts.
- **B3 Radix components on semantic classes:** Dialog, Dropdown, Tabs, Accordion, Tooltip, Select —
  Radix behavior, `st-` classes (not utilities).

**Phase C — Control registry + editor.** The color / size / variant **selectors** (each owns a
mutually-exclusive class group, e.g. `btn-{color}`) — the structured inspector that replaces the
box's editing role. "Add component" presents archetypes; the freeform box drops to an "Advanced"
affordance; the value-override panel (§4.1) handles one-offs.

**Phase D — Per-tenant compile.** Tree-shake → `temp.css` (save) + atomic content-hashed
`tenant.css` (publish), tenant-flavored Tailwind theme → `--st-*`; wire into the publish/Pub-Sub flow.

**Phase E — Free-text tiers.** Tier-3 allowlisted utility input; then Tier-4 scoped + sanitized raw
CSS, gated to a Code/Enterprise tier.

**Phase F — Brand governance + migration.** Brand designer edits archetypes + the utility allowlist;
publish the class vocabulary as a versioned contract; migrate existing templates (Tesla, product PDP)
off fat boxes onto archetypes.

Phase 0 + A are the foundation and the smallest first steps; A unblocks everything downstream.
