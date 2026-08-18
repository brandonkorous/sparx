# Site Builder Composition Model

**Version:** 1.0.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

> **Node shape superseded by [61](61-utility-authoring-system.md) §4 (2026-06-07).** The composition
> model here — website = recursive tree, typed data binding — still stands and is foundational. But the
> per-node `{ type, box, layout?, props, children? }` shape is **retired**: the freeform `box`/`layout`
> objects are deleted and all styling lives on a `class` string. **Current node shape:**
> `{ id, type, class?, props, binding?, children? }`.

---

## 1. Purpose & relationship to docs 36 / 37 / 38

The Site Builder shipped as a **flat stack of sections** ([docs/37](37-sitebuilder-section-system.md)),
placed inside data-driven page layouts ([docs/36](36-sitebuilder-layering-model.md)), with a path to
user-defined section types ([docs/38](38-sitebuilder-extensible-sections.md)). Building against it
surfaced a deeper truth: the flat-section model is a _special case_ of a more general model, and
treating sections as the primitive — rather than as one role in a recursive tree — is what made the
authoring experience feel disjointed and hard to use for real pages.

This document is the **foundational composition model**: how a customer's entire website is
structured, bound to data, and authored. It is the model docs 36–38 should descend from.

Where this doc and docs 36/37/38 disagree on the **structural model** — what a "section" is, whether
nodes nest, where presentation properties live, how a component binds to data — **this doc wins**, and
the affected doc is amended in the phase that lands the change. Everything else in those docs (the
editor shell, publish/snapshot lifecycle, layout targets and assignment, the `custom:<slug>`
registry) stands. This doc does **not** specify a migration; it specifies the target model.

This is a model doc, not an implementation plan. It locks vocabulary and decisions so we stop
re-deriving them.

---

## 2. The model in one paragraph

A website is a **tree**. A layout owns **zones**; one zone (page content) holds a recursive tree of
**nodes**. A node is either a **container** (arranges children) or a **leaf** (renders something).
Every node shares a **base** of presentation properties (the box base); containers add a layout base;
each node type adds its own props. A node may **bind** to data; the **cardinality** of what it binds
to (scalar / object / array) decides whether it renders once, sets a scope, or iterates. Tenants
do not assemble raw primitives — they compose **data-aware components** (Tier 2) that adapt their
presentation to the shape of the bound data, configured from that data's **typed schema**. The schema
is the keystone: it powers single-vs-iterate, the component's config panel, and the form a module
shows to fill the content.

---

## 3. A website is a tree

### 3.1 Layout → zones → content tree

- A site is a **tree of nested layouts** (the framework's layout segments). Layouts **persist** across
  navigation; the page swaps. That persistence is why shared chrome belongs to a layout.
- A layout owns **zones** (a.k.a. regions): header, footer, sidebar, ad rail, and the **page-content
  outlet**. The split that matters:
  - **Chrome zones** — header / footer / sidebar — are layout-owned, shared across many pages,
    persistent. (These map onto the framework's named layout slots.)
  - **The content outlet** — the one zone that swaps per route. This is where the composition tree
    lives.
- **Page content** is a recursive **node tree**, not a flat list.

### 3.2 Roles, not levels

"Section," "column," and "component" are **roles a node plays**, not fixed levels in a hierarchy. The
moment a section can contain a section (and it can), section/column/component collapse into **one
recursive primitive** with two kinds:

- **Container** — arranges children with a layout (stack / row / grid / N columns). "Section," "row,"
  and "column" are all containers with different defaults and chrome.
- **Leaf** — renders content (text, image, video, price, buy-button, …).

Modeling them as one recursive node type is what makes nesting fall out for free instead of being a
bolted-on special case.

---

## 4. Two tiers: primitives vs. components

The single most important reframing in this doc.

| Tier                               | What it is                                                                  | Who authors it                                             | Example                                                |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| **Tier 1 — primitives**            | The raw node tree: containers + leaf elements, bind-a-leaf-to-a-path        | sparx (and advanced users) build _components_ out of these | `Stack` / `Box` / `Image` / `Text` nodes               |
| **Tier 2 — data-aware components** | Opinionated, data-aware building blocks tenants point at data and configure | **Tenants**                                                | `ImageDisplay`, `BuyBox`, `PriceTag`, `CollectionList` |

**Tenants compose Tier 2.** They never hand-wire `<img src="product.image">`; they say _"show me
`product.images`, nicely"_ and the component does the rest. Tier 1 is the **substrate** components are
built from — not the tenant authoring surface.

> The existing custom-section template AST (Stack/Grid/Box/Image/Text/Repeater nodes, bind each leaf)
> is **Tier 1**. It is correct as a substrate; the gap was exposing it directly as the authoring
> experience. Tier 2 is the product.

The principle that governs Tier 2: **opinionated composites and raw atoms live in the same palette.**
Drop the composite (e.g. `BuyBox`) when you want correct behavior for free; decompose into atoms when
you want a custom arrangement. Composites exist for the behaviorally-coupled, easy-to-get-wrong parts.

---

## 5. The node shape

Every node — container or leaf, Tier 1 or Tier 2 — serializes the **same shape**:

```
{ type, box, layout?, props, children? }
```

- `box` — the **universal base** (every node has it).
- `layout` — the **container base** (containers only).
- `props` — **component-specific** config.
- `children` — child nodes (containers only).

This single consistent shape is the cure for the "disjointed" feeling: presentation consistency
becomes structural instead of something each component re-invents.

### 5.1 Box base — every node

The universal spine. Candidate properties (final set locked in build):

- **Alignment** — self/horizontal alignment within the parent.
- **Sizing** — width (auto / full / constrained / fixed) and height where meaningful (see §5.5).
- **Spacing** — outer (margin) and inner (padding), on a token scale.
- **Surface** — background tone, radius, border (token-driven).
- **Visibility** — responsive show/hide; optional bind-to-condition.
- **Identity** — id/anchor; a power-user `customClass` escape.

### 5.2 Layout base — containers only

Properties that only mean something when a node has multiple children, so they are **not** in the
universal base (keeping the base a spine, not a junk drawer): **direction, gap, wrap, justify,
align-items, columns.**

### 5.3 Component props — per node type

The unique knobs: carousel `autoplay/interval/dots`, image `focalPoint/ratio/fit`, button
`variant/url`. These are the only place a node's config is bespoke.

### 5.4 Token scales, with a power-user override

Base properties are **named, token-backed scales**, never freeform values — e.g. a height scale of
`sm / md / lg / full` mapping to viewport fractions, a spacing scale, an alignment enum. This keeps
output themeable, multi-tenant-safe, and on-brand. The **power-user escape hatch** is an explicit
raw-value override (a custom vh/px/%), surfaced as "advanced." **Smart defaults, explicit overrides —
never magic without an escape hatch.**

### 5.5 Shared vocabulary, opt-in per component

The base is a **vocabulary**; each component declares which base props are **meaningful** for it. This
avoids two failure modes:

- Forcing a meaningless prop (a button should not offer a `25/50/75vh` height).
- The same prop name silently meaning two different things ("height" as a viewport fraction on a band
  vs. control-height on a button) — which is disjointedness wearing a uniform.

Rule: scope a prop to the node-family where it is coherent (viewport-height belongs to bands/
containers), or define an abstract axis ("size") that each family maps to its own concrete scale.

### 5.6 Responsive is an axis on top

Base props are settable **per breakpoint** (e.g. `height = lg` on desktop, `md` on mobile). N-column
containers **must** declare how they collapse on small screens; nesting makes this the hardest part of
the model and it is not optional.

> **Naming guard:** the _size scale_ (`sm/md/lg/full`) and _breakpoints_ (`sm/md/lg`) are different
> namespaces. Do not let them collide in the schema or the UI.

### 5.7 Cascade stance

Default to **explicit per-node base + sensible defaults**, with **minimal implicit inheritance** —
predictability matters more than cleverness for non-developer authors. Surface/theme tokens may
cascade; layout props do not. This is a deliberate decision, revisited only on purpose.

---

## 6. Binding

### 6.1 Binding is per-node, not per-page

Each node declares its own data source. A hero may be locally authored on one page and bound to
`product.title` on another; a lead-gen form is generic everywhere; a middle section is type-specific.
**A page is not globally "a product" or "an article" — the page's "type" is the _sum_ of what its
nodes bind to.**

A **leaf** is therefore one of:

- **static / local content** — a literal value authored in place (this page's heading, this image), or
- **a bound field-atom** — "render field X of the bound record here." `product.price`, `product.images`,
  `article.author`, `article.publishedAt` are all peers, freely placeable.

### 6.2 Cardinality drives behavior

The cardinality of the bound path decides what a node does:

| Bound to                        | Behavior                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ |
| **scalar** (`product.title`)    | render once; value resolves directly                                           |
| **object** (`product`, `image`) | render once; descendants can reach the object's fields (sets scope, no repeat) |
| **array** (`product.images`)    | **iterate**; descendants resolve against `item.*`                              |

This collapses the explicit "repeater" into "a node bound to a list." For this to work the system
must know each field's **cardinality and type** — see §7.

### 6.3 Two flavors of atom

- **Display atoms** — `price`, `images`, `author`, `body`. Zero coupling; place anywhere.
- **Behavioral atoms** — `variant-picker`, `add-to-cart`, `quantity`. Freely _placeable_, but they
  share interactive **state** (selecting a variant changes the price shown _and_ the add-to-cart
  payload). They may be scattered across sections, but the renderer must wire them into one shared
  **form context**. This is the one genuine coupling in the model, and it is why behavioral clusters
  ship as composite components (§4).

### 6.4 Each component owns its cardinality → presentation behavior

There is **no universal "array ⇒ carousel" law.** Each component defines its own behavior:

- `ImageDisplay`: scalar → one image; array → carousel (its native default); empty → empty state.
- A `Section` (container): array → repeat the **author-defined** per-item subtree (the author controls
  what each item looks like).

A component _may_ expose more than one "many" mode (carousel / grid / stack) as configurable richness,
but that is per-component, not a platform rule.

### 6.5 Iteration is one mechanism; chrome is the difference

A repeating section, a grid, and a carousel are the **same** underlying iteration — _array binding →
repeat subtree with an `item` scope_ — differing only in the **arrangement / behavior** wrapped around
it. Section = bare iteration. Grid = iteration + grid layout. Carousel = iteration + slides /
transitions. "Arrangement" is a property of the iterating container.

Two iteration altitudes, ranked:

1. **Primary — data-aware component** (`ImageDisplay → product.images`): owns iteration + behavior, you
   configure it; you do not hand-author each item. A component may also expose a **per-item slot** (an
   author-defined item subtree) — the most powerful version.
2. **Escape hatch — repeating container**: _you_ author the per-item subtree, stamped N times. Full
   control, more work.

Use the component first; drop to the container only when its options aren't enough.

Guards on any iteration: **bounded cardinality** (cap / paginate large lists; never render an unbounded
collection inline) and a **defined empty behavior** (§10).

---

## 7. The schema keystone & content contract

### 7.1 A typed, introspectable schema

Everything above rests on one thing: for any bindable path, the system knows its **type, cardinality,
and shape** — `product.title : string`, `product.images : Image[]` where `Image = { url, alt,
description, focalPoint }`. This metadata powers:

- single-vs-iterate (§6.2),
- the **palette** (which atoms a bound type offers),
- the component's **config panel** (generated from the bound type's properties — "show the
  description? overlaid or below?"),
- the **form** a module shows to fill the content (§8).

**Data-model requirement surfaced by this model:** structured fields must be _rich enough to be worth
binding_. In particular, a product image is a structured object `{ url, alt, description, … }` with a
first-class, editable **description** — not a bare URL. (An image without a description is "a photo of
metal.") Images associate to variants / option-values; "Color" is an **option**, each combination a
**variant**.

### 7.2 Schema ownership differs per module

The layout emits a **content contract** — the set of fields it references for a given type. _Who
defines those fields_ differs, and conflating this is a trap:

| Module       | Who owns the field schema                                          | The layout's relationship                                                                                            |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **CMS**      | The **layout** can define slots (content is shape-flexible)        | Defines the fields; the CMS renders a form for them                                                                  |
| **Commerce** | The **domain** owns the schema (title, price, variants, inventory) | **Binds to / references** existing fields; never invents them. The fill UI is the normal product editor              |
| **Email**    | Mixed                                                              | Defines content **regions** + declares the dynamic **merge data** it expects; the triggering event supplies the data |

Atoms are **equal at placement** (a product field and a blog field are peers on the canvas); they
differ **upstream** in who decides the field exists.

### 7.3 Structured-content layer (metaobjects)

Some lists worth repeating over are **not** native domain fields — "fabric care steps," "size-chart
rows," "what's-in-the-box." These need an **author-defined, typed, repeatable content shape**
(metafields / metaobjects) attached to a record, filled in a form, bound by a repeating node.

A **rich native model reduces but does not eliminate** the need: images-carrying-descriptions covers a
color showcase natively; metaobjects cover everything the domain doesn't model. Both exist.

---

## 8. Two fill surfaces, one schema

The contract is filled in one of two places depending on the _kind_ of content:

- **Structured / bound / repeatable** data (a product, a collection, an article) → a **module form**.
  One layout, thousands of records.
- **Local / bespoke** content (the literal copy and image for _this_ landing page) → **inline / visual
  editing with live preview**. Forcing this into a divorced form recreates "editing blind."

The strongest version: the layout emits **one schema**, rendered as **two views over the same
contract** — a module form _and_ an inline visual editor — chosen by what's being filled. Same source
of truth, different surface.

---

## 9. Page types, templates, and the spectrum

- **Template per content type** (recommended): a "Product page" layout and a "Blog post" layout that
  **share reusable blocks** (the same hero + lead-gen) and differ only where they're type-specific. You
  reuse the shell; you don't pour either a product or an article into one universal slot.
- **Singleton page** (home, about): the content _is_ the page — authored inline, no separate record.
- **Type-templated page** (product, collection, article): per-record data comes from the module; the
  template arranges it.
- **One polymorphic template** whose middle switches on bound type is _possible_ but threads two
  editing/rendering paths through one template — more power, more complexity, rarely worth it.

**sparx's stance on the freeform ↔ curated spectrum:** lean **curated, with escape hatches.** A bounded
catalog of data-aware components and limited, deliberate nesting — so a non-designer can't easily make
a broken, off-brand, non-responsive mess — with Tier-1 decomposition available to power users. Smart
defaults; explicit overrides.

---

## 10. The data-aware component contract (Tier 2)

Every Tier-2 component declares:

1. **Accepted data shape(s) & cardinality** — e.g. `Image | Image[] | null`.
2. **Presentation modes per cardinality**, each with a default — single → image; many → carousel
   (default) / grid / stack; etc.
3. **Config derived from the bound type's schema** — the inspector for the component is _generated_
   from the bound type's properties (§7.1).
4. **Empty-state behavior** — hide / placeholder / fallback, defaulting to **hide on the live site,
   placeholder in the editor**.

Pin this contract down and the entire Tier-2 authoring experience falls out of it.

---

## 11. Rendering & safety invariants

Independent of authoring, every node must:

- **Server-render** (the site reads a published snapshot; bound data resolves at render: route →
  record → fields).
- Emit **tokenized, themeable output** — no arbitrary colors/classes/styles; values resolve to `--st-*`
  tokens; variant selection is a closed enum (the Tier-1 substrate already enforces this).
- Be **multi-tenant safe** — no path from authored data to executable strings.
- **Collapse responsively** — every N-column container defines its small-screen behavior.
- **Bound cardinality** — large collections cap or paginate.

---

## 12. Relationship to the current implementation

| Built today                                                                                         | Role in this model                                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Custom-section template AST (`section-template.ts`: Stack/Grid/Box/Image/Text/Repeater + `$bind`)   | **Tier 1 substrate.** Correct primitives; not the tenant surface                           |
| `validateTemplate`, `field-spec-to-zod`, the shared `@wizeworks/section-template-react` interpreter | The rendering + validation engine Tier-2 components compile to                             |
| Section Studio (field spec + visual/JSON tree)                                                      | A **Tier-1 authoring tool** — right for building components, wrong as the only tenant path |
| PageLayout + data-driven targets + product/collection bindings (doc 36)                             | The page-template + binding spine this model extends                                       |
| Flat section stack + registry (doc 37)                                                              | The **special case**: a one-level tree of containers. Generalizes to §3                    |
| `custom:<slug>` definitions (doc 38)                                                                | One way to register a Tier-2 component; the registry stays                                 |

**Net:** keep the substrate and the engine; reframe the section as a node-role; build the Tier-2
component layer and the typed schema on top; make the tenant surface Tier 2.

---

## 13. Open questions / deferred

- **Schema source of truth** — where the typed, introspectable schema for each bindable type lives, and
  how a module publishes it to the builder palette.
- **Metaobject authoring** — defining/attaching a structured content type to a record, and its form.
- **Per-item slots** — the exact contract for a component that owns iteration but exposes an
  author-defined item subtree.
- **Behavioral form context** — how scattered behavioral atoms (variant picker / buy button across
  sections) discover and share one product-form context at render.
- **Migration** — how today's flat snapshots become node trees (additive; not specified here).
- **Zone authoring** — editing chrome zones (header/footer) as part of this same tree (doc 36 §8
  SiteLayout regions).

---

## 14. Glossary

- **Layout** — a persistent wrapper that owns zones and renders the page outlet.
- **Zone / region** — a slot in a layout (header, footer, sidebar, content outlet). Chrome zones are
  shared; the content outlet swaps per page.
- **Node** — any element in the content tree. A **container** (has children) or a **leaf** (renders
  content).
- **Section / column** — roles a container plays; not distinct types.
- **Atom** — a leaf bound to a single field (display or behavioral).
- **Component (Tier 2)** — an opinionated, data-aware building block tenants compose.
- **Primitive (Tier 1)** — a raw node used to _build_ components.
- **Box base / layout base / props** — the three property layers every node serializes.
- **Binding** — the data path a node resolves; its **cardinality** (scalar/object/array) drives
  behavior.
- **Content contract** — the set of fields a layout references for a type; surfaced as a form.
- **Metaobject** — author-defined, typed, repeatable structured content attached to a record.
