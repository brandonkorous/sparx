# 119 — silicaui-builder: The Gap Questions (a generic-first evaluation)

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-10

> **Purpose.** [Doc 118](118-builder-silicaui-html-migration.md) chose to **keep sparx's builder engine** and only retarget its rendering — a decision forced by what `@wizeworks/silicaui-builder` (0.8.0) **cannot yet do**. This doc turns those gaps into **open design questions**, framed **generically** — "how should a _domain-blind_ visual builder engine solve X?", with sparx as the _motivating instance_, never the shape of the answer. The goal is to decide whether the better long-term move is **not** re-skinning sparx's editor, but **investing in silicaui-builder** so it becomes the engine any host (sparx first) can adopt — [doc 118's Phase F](118-builder-silicaui-html-migration.md#14-the-destination-adopting-the-engine-later-phase-f-gated), pulled forward.
>
> **Read this first, one line.** Every question here has a **generic answer that keeps the engine reusable** and a **wrong answer that fits sparx and forks the product.** The bar for every proposal below: could a _different_ host — a CMS, an email tool, a static-site generator — implement the same seam and get the same builder? If not, it belongs in the host, not the engine.
>
> **Companion inputs.** [`silicaui/docs/builder-contract.md`](../../silicaui/docs/builder-contract.md) (the aspirational engine/host spec), [`silicaui/docs/blocks-contract.md`](../../silicaui/docs/blocks-contract.md) (the block tier), [silicaui-site-ui-parity-spec.md](silicaui-site-ui-parity-spec.md) §13 (the CSS/component readiness gate). This doc is intended to be **contributed back to the silicaui repo** as the builder engine's roadmap — it is written for silicaui's benefit, not just sparx's.

---

## 0. Why this doc exists — "did we pick the best approach?"

Doc 118's core reasoning was: _silicaui-builder ships no data-binding / collection / conditional renderer and no host seam, so a data-bound site can't render through it — therefore keep sparx's engine._ That is correct **about the shipped 0.8.0**. But it silently accepts a premise worth challenging: **that the engine will stay that way.**

Three things are true at once:

1. **The document + render + apps/site migration is required either way.** Whoever owns the editor, the document must speak silica classes and the storefront must render silica through sparx's binding runtime (silicaui-html resolves no published data). So doc 118's WS-2/3/4/5/6/8/9 are not in question.
2. **The _only_ thing in question is the editor itself** — re-skin sparx's `.bx-*` chrome (doc 118 WS-7, ~1600 lines to polish then maintain forever) **vs.** adopt a silicaui engine that has grown the capabilities below.
3. **WizeWorks owns both sides.** "Invest in the engine" is not a bet on a third party — it is choosing _where_ to spend the same effort: into a reusable product, or into sparx-only chrome.

So the real question is not "sparx or silica builder?" It is: **which of the gaps below can be closed _generically_, and once they are, is adopting the engine cheaper and better than owning a bespoke editor forever?** This doc enumerates the gaps as the questions whose answers decide that.

**The generic-first test (applied to every answer below):**

- _Reusability:_ a non-sparx host implements the same seam and gets the same builder.
- _Domain-blindness:_ `grep` the engine for `product` / `cms` / `order` / `tenant` → zero hits (builder-contract §9).
- _One-shape:_ the thing that loads, edits, extracts, persists, and is authored-as-a-block is the **same node shape** — no translation layer.
- _Preview == production:_ whatever renders the canvas must be the same code path that renders the live site, or fidelity drifts.

---

## Part 1 — The dynamic-content layer (the largest gap)

silicaui-html **declares** binding/repeat/action in its schema and **lowers** them to `data-sui-*` attributes, but **nothing resolves them** — `toHtml`/`renderSite` take no data, and no collection expander exists server- or client-side (only form-field prefill). This is the gap that forced doc 118's "keep sparx's runtime" call.

### Q1 — How does a domain-blind engine resolve a single dynamic value without knowing what it means?

- **Generic problem.** A node should be able to say "my text/image/href comes from data," and the engine must render _something real_ without understanding the data.
- **Contract stance / shipped.** builder-contract §3 proposes `props.bind = { ref }` + `host.resolveBinding(ref, scope) → { value, label }`. **Shipped: neither the marker resolution nor the host hook exists.**
- **Motivating instance (sparx).** `binding.path` (a dotted field path) and `binding.entity` (a pinned record) — both resolve to a value via `resolveBinding`/`resolvePath`.
- **Open questions.** Sync or async resolution (and how does the canvas render before a promise settles)? Does the engine cache resolved values? What renders when _no_ resolver is supplied (static-site case) — the authored placeholder, per contract? Does `label` (the "bound" chip) belong to the engine or the host?
- **Candidate generic direction.** Opaque `ref` + optional `host.resolveBinding`; absent resolver → placeholder renders (so a static builder needs no data at all). The engine never parses `ref`.

### Q2 — How does the engine repeat a subtree once per item in an opaque collection?

- **Generic problem.** "Render these children once per row" is the single most important dynamic primitive and the one silicaui-html most conspicuously lacks.
- **Contract stance / shipped.** builder-contract §3: `props.repeat = { ref }`; the engine asks `host.resolveCollection(ref) → array`, renders `children` per item, passes an **item-scoped token** down so inner binds resolve per item. **Shipped: no expander anywhere.**
- **Motivating instance (sparx).** An array-bound container does `value.map((item,i) => renderChildren({...scope, item, index:i}))`; descendants bind `item.title`. This is a _solved problem_ in `runtime.ts` — the reference implementation of exactly this generic primitive.
- **Open questions.** Who owns repetition — engine (contract says yes) or a sibling runtime? How is the item scope threaded to descendants generically (a structural `DataScope { path: string[] }`)? Nested repeats? Empty-collection rendering in the editor (show one placeholder item)? How does the _published_ site repeat (Q5)?
- **Candidate generic direction.** Engine owns _repetition_; host owns _data_. The scope is an opaque structural token the host interprets. sparx's `runtime.ts` is the proof this generalizes.

### Q3 — Where does published-time data resolution live — engine, a sibling runtime, or the host?

- **Generic problem (the keystone).** The engine `extract()`s a static document; the host publishes it. But a data-bound page must resolve bindings **at request time on the live site**, forever, outside the editor. Who renders that?
- **Contract stance / shipped.** builder-contract implies the host renders extracted documents (§7: "a host may render extracted documents through silicaui-react"). silicaui-html's `renderSite` resolves **no** data. So today the answer is "the host builds its own runtime" — which is exactly what sparx did.
- **Motivating instance (sparx).** `apps/site` walks the tree with `runtime.ts` + `builder-data.ts` (`__pins`/`__sources`) — a full server-side data-resolving renderer.
- **Open questions.** Should the silicaui _family_ ship a **framework-neutral, data-resolving renderer** (a `render(tree, { resolve, resolveCollection })`) that BOTH the editor canvas and a host's published site call — so preview==production is structural, not hoped-for? Or is data-resolution deliberately host territory, and the family only ships the static `toHtml`? This single decision reshapes the whole migration.
- **Candidate generic direction.** A `silicaui-html`-level **resolving projection** (`toHtml`/`toDom` accepting an optional `resolve`/`resolveCollection`) would make the engine's canvas and the host's live site share one renderer — the thing sparx had to hand-build as `renderLeaf` shared across surfaces. This is the highest-leverage generic investment.

### Q4 — How are actions (add-to-cart, submit, navigate) represented and wired?

- **Generic problem.** Some nodes _trigger_ host behavior on interaction; the engine must render them inert-but-present and let the host wire them live.
- **Contract stance / shipped.** builder-contract §3: `props.action = { ref, href? }`, inert in editor, host-wired on the live site. **Shipped: not implemented.**
- **Motivating instance (sparx).** `binding.action` (`add-to-cart|buy-now|link|submit`) → `BuilderActionButton` on the live site.
- **Open questions.** Is `action` purely a marker the host lowers, or does the engine need a notion of "event" for preview? How do actions compose with forms (submit) vs. commerce (add-to-cart) generically?
- **Candidate generic direction.** Opaque `action.ref`; engine renders the trigger element + `data-*` marker; host's runtime binds it. Same three-primitive family as Q1/Q2.

### Q5 — Is conditional visibility / an expression layer in scope, or deliberately out?

- **Generic problem.** Real sites hide a node when data is absent, or format a value ("$" + price/100). The silicaui-html `DataBinding` union is **closed** to value/collection/action — no `if`/`when`/`visible`, no expression language, no formatters.
- **Motivating instance (sparx).** sparx has `conditional_block` as a node type and denormalized display fields; it does not have a general expression language either.
- **Open questions.** Does a domain-blind engine want conditionals at all, or does the host pre-resolve visibility into the data it hands back (a bind that resolves to "hidden")? Formatting: engine-side format hints on a bind, or host-resolved pre-formatted values? An expression language is a large surface with security implications — is it worth it, or an anti-goal?
- **Candidate generic direction.** Keep the engine expression-free; push conditionals/formatting into the host's `resolveBinding` return (the host decides what a `ref` means, including "absent"). Document this as a deliberate boundary, not an omission.

### Q6 — How does an author _attach_ a binding in a domain-blind UI?

- **Generic problem.** The user must pick "bind this to data" and choose _what_ — but the engine doesn't know the data model.
- **Contract stance / shipped.** Not addressed beyond the marker. The host presumably supplies the pickable schema.
- **Motivating instance (sparx).** The `BindingCatalog` (`DataSource[]` with typed `FieldSchema`s) drives the inspector's binding picker; sparx knows `commerce.product.price` is a scalar.
- **Open questions.** Does the engine render a _generic_ binding affordance (a "bind" button on any node) and ask the host for the pickable schema (`host.dataSchema(scope) → fields`)? How does the picker know a node's valid bind types (a text node wants a scalar, a container wants a collection)?
- **Candidate generic direction.** A `host.dataSchema` (or reuse `catalog`) supplies the field tree; the engine renders a generic picker and writes the opaque `ref`. sparx's `BindingCatalog` is the reference shape.

---

## Part 2 — Composition & reuse

### Q7 — How rich is layout↔content composition — one outlet, or nested/named slots?

- **Generic problem.** A page renders _inside_ a shared layout (header/footer/nav). The engine must edit the page within its real chrome.
- **Contract stance / shipped.** builder-contract §2: `DocumentFrame { root, editable }` with **exactly one** `Outlet`. silicaui-html ships `composeFrame` (working) — a single-outlet substitution.
- **Motivating instance (sparx).** The `Outlet` node (pinned) with the layout tree wrapping the page — single slot, matches the contract exactly.
- **Open questions.** Is one outlet enough forever, or do real layouts need **named, multiple** slots (sidebar + main + aside)? Nested layouts (a section layout inside a page layout)? Is the layout itself editable-as-a-document (sparx's two-zone need — Q9)?
- **Candidate generic direction.** Single outlet covers the dominant case and is shipped; named multi-slot is a candidate additive extension. Keep `frame.editable` for studio-vs-locked.

### Q8 — How does the engine handle reusable components — symbols, instances, overrides, and versioning?

- **Generic problem.** A user saves a component and reuses it; editing the master should propagate, but per-instance overrides must survive.
- **Contract stance / shipped.** silicaui-html **has** `SymbolDef` + `instanceOf` + per-instance `overrides` + `flattenSymbols` (working). Versioning is explicitly a _host_ concern (builder-contract §0).
- **Motivating instance (sparx).** `BuilderComponent` + immutable `BuilderComponentVersion` rows (`latestVersion` pointer); `custom:<key>` placements expanded at publish via `expandTreeForPublish`.
- **Open questions.** Where's the line — the engine owns _instance/override semantics_ (symbol edit → instance reflow) but the host owns _version history + storage_? Does "edit master propagates" happen in-editor (symbol) or only at publish (sparx's ref-expansion)? Can a host's versioning coexist with the engine's symbol model without duplication?
- **Candidate generic direction.** Engine owns symbol/instance/override at edit time; host owns the durable version catalog + the "which version does this placement pin" decision. Reconcile sparx's `custom:*` ref-expansion with the engine's `flattenSymbols`.

### Q9 — Can the engine edit more than one document at once (sparx's two-zone studio)?

- **Generic problem.** sparx edits the **layout and the page simultaneously** on one canvas, each with its own autosave router; the contract says the engine "edits **one document at a time**" (§0).
- **Motivating instance (sparx).** `SiteStudio` + `useStudioEditor` — two zones, two save debounces, one live canvas, layout ops (switch/new/rename/activate) orchestrated around it.
- **Open questions.** Is simultaneous multi-zone editing a _generic engine capability_, or is it **host orchestration** — the host mounts the engine on the composed `frame` (editable layout + page at the outlet) and routes edits to the right store by which zone a node belongs to? Can the single-document engine + an editable frame already express this, making the two-zone-ness a host concern?
- **Candidate generic direction.** Likely host orchestration: the engine edits one composed document (frame editable); the host disambiguates layout-node vs page-node edits and persists to the right store. Verify the engine's extract() can partition edits by frame-vs-root. If it can't, that's a real engine gap.

---

## Part 3 — The palette & content model

### Q10 — Where do insertable blocks come from, and how does a host add domain composites?

- **Generic problem.** The Add palette needs a catalog; a host must be able to add its own composites (a "product grid") without the engine knowing what a product is.
- **Contract stance / shipped.** builder-contract §5: `host.catalog() → CatalogEntry[]`, default = the silicaui-blocks index. **Shipped: `<Builder/>` has no `catalog` prop** — the palette is whatever the engine hardcodes.
- **Motivating instance (sparx).** The data-as-code catalog (`catalog/*`) — platform blocks _plus_ commerce/CMS composites that carry bindings; stamped (forked) into the page.
- **Open questions.** Is a domain composite just "a block whose tree already contains `bind`/`repeat` markers" (so it needs no engine awareness)? How does the host curate (hide, reorder, group) the default block index _and_ inject its own? How do blocks declare required colors/behaviors so the host validates before stamping (blocks-contract §8)?
- **Candidate generic direction.** `host.catalog()` merges the silicaui-blocks index (adapted) with host composites; a domain composite is a normal block whose tree carries opaque markers — zero engine domain code. This is the blocks-contract §10 adapter, made real.

### Q11 — Is content-model/schema authoring (sparx's Fields panel) engine or host?

- **Generic problem.** sparx edits a CMS content-type's field schema _inside_ the builder (the Fields tab), so a collection template and its data model evolve together.
- **Motivating instance (sparx).** `FieldsPanel` → `saveContentTypeSchema`; the collection template binds to `recordType`'s fields.
- **Open questions.** Is schema authoring **entirely** a host panel (Q12) — the engine knows nothing about "content types," it just renders a host-contributed inspector panel? Or does the engine need a notion of "the data shape this document binds against" to power the binding picker (Q6)?
- **Candidate generic direction.** Host-contributed inspector panel + `host.dataSchema`. The engine stays schema-blind; the host's Fields panel mutates its own model and refreshes the pickable schema.

---

## Part 4 — The inspector & editing affordances

### Q12 — How does a host contribute domain inspector panels generically?

- **Generic problem.** The engine draws generic panels (class, props, slots, theme); a host needs domain panels (SEO, product-pin, per-module editors) beside them, keyed by node type.
- **Contract stance / shipped.** builder-contract §5: `host.inspectorPanels?(node) → InspectorPanel[]`. **Shipped: not present.**
- **Motivating instance (sparx).** The inspector (5082 lines) mixes generic class/box/style controls with domain-aware panels (binding, SEO, contact-form recipients, commerce).
- **Open questions.** What's the `InspectorPanel` interface (a titled React subtree? a declarative field spec the engine renders?)? How do host panels coexist with the engine's generic ones without layout fights? Can a host _replace_ a generic panel, or only _add_?
- **Candidate generic direction.** `inspectorPanels(node)` returns host-rendered subtrees slotted beside the engine's generic panels; the engine owns the class/props/slots/theme framework, the host owns meaning.

### Q13 — How much of the "design surface" (box model, spacing, color pickers) is generic vs host?

- **Generic problem.** A visual builder needs rich direct-manipulation controls (padding pads, alignment, color swatches, responsive breakpoints) — all expressed as `class` edits.
- **Motivating instance (sparx).** sparx's inspector has bespoke box-model/quad widgets, swatch grids, position pads, per-breakpoint (container-query) controls.
- **Open questions.** Are these _generic_ (any silica document benefits) and therefore the engine's job? Or does each host reinvent them? Container-query-based responsive editing (per-node width, not viewport) — is the engine's device preview keyed off container width (parity-spec §4)?
- **Candidate generic direction.** These are **generic** and belong in the engine — they are the reason to adopt it. sparx's bespoke widgets are the reference for what "good" looks like; contributing them upstream is the payoff.

---

## Part 5 — Governance & safety

### Q14 — How is the class allowlist / security policy supplied and enforced?

- **Generic problem.** Author-typed AND AI-generated class strings must pass a policy before entering the document; the policy is the host's, the enforcement is the engine's.
- **Contract stance / shipped.** builder-contract §5: `host.validateClass(cls) → { ok } | { ok:false, reason }`, called before committing **any** class. **Shipped: no such hook.**
- **Motivating instance (sparx).** `surface-compile/allowlist.ts` — deny `fixed`/`z-[…]`/`content-[…]`/`url()`; tenant may only tighten.
- **Open questions.** Is validation per-class-string or per-node? Does it run on paste/import too? How does an AI-assist path route through the same gate? Is there a default (silica ships a safe baseline) the host tightens?
- **Candidate generic direction.** `validateClass` as a required host hook, enforced by the engine on every class mutation (type, paste, import, AI). sparx's allowlist is the reference policy.

### Q15 — Where does the safe raw-element / attribute whitelist live?

- **Generic problem.** `el:<tag>` nodes render arbitrary HTML; only whitelisted tags + sanitized attrs are safe (no `script`/`style`/`iframe`, strip `on*`, force `rel=noopener`).
- **Motivating instance (sparx).** `element.ts` (`RAW_ELEMENTS`, `safeElementAttrs`) — a solved, styling-independent security boundary.
- **Open questions.** Is the raw-element whitelist the engine's (it renders the tree) or the host's policy (like `validateClass`)? Should silicaui-html own a canonical safe-tag/attr set that all projections share?
- **Candidate generic direction.** silicaui-html owns the canonical safe element/attr set (all projections need it); the host may tighten. sparx's `element.ts` is the reference.

---

## Part 6 — Persistence, lifecycle & scope

### Q16 — Is load/extract symmetry + host-owned persistence sufficient for real lifecycles?

- **Generic problem.** Drafts, explicit-save vs autosave, publish, preview tokens, conflict policy — all lifecycle.
- **Contract stance / shipped.** builder-contract §4: `extract()` is symmetric with load; `host.onChange(document)` fires debounced; the engine never persists. **Shipped: `onChange`/`onPublish` exist** — this part is real.
- **Motivating instance (sparx).** Explicit-save, last-write-wins (autosave/ETag removed platform-wide); publish pipeline with `expandTreeForPublish`/`syncFormDefinitions`; preview tokens.
- **Open questions.** Does `onChange(document)` give the host _enough_ to run its publish transforms (it gets the whole document — yes)? Preview: the host renders the extracted doc through its own runtime (Q3) — engine-agnostic. Is anything about the lifecycle blocked by the engine? (Appears not.)
- **Candidate generic direction.** This seam is adequate as speced; it is one of the few parts _already shipped_. Confirm `onChange` fires on structural + text + theme edits and omits view-only changes.

### Q17 — Import/export (JSON/HTML) and multi-site scoping — engine or host?

- **Generic problem.** sparx supports JSON import/export, one-way HTML import, and per-property scoping.
- **Contract stance.** Multi-site scoping + email projection + `custom:*` are explicitly host concerns (builder-contract §0). Import/export of the _document_ is symmetric with load/extract (engine gives you the document; the host serializes).
- **Open questions.** HTML _import_ (parse arbitrary HTML → node tree) — is that a generic silicaui-html capability (an `fromHtml`) or a host feature? Does the engine need to know about "sites/properties," or does the host just mount N engines / swap documents?
- **Candidate generic direction.** Scoping = host (mount the engine on the active property's document). HTML import = a candidate `silicaui-html` `fromHtml` utility (generic, reusable), not engine core.

---

## Part 7 — Theming

### Q18 — How does the engine edit a theme, and who owns the theme _library_?

- **Generic problem.** A builder edits the `[data-theme]` token set the canvas renders under; a platform also manages _named saved themes_, presets, and per-mode overrides.
- **Contract stance / shipped.** builder-contract §2: `theme` loads/extracts; the theme panel edits `theme.tokens`. silicaui-html has a real `Theme` model (tokens + `dark` deltas + presets). **The engine's theme editing is largely present.**
- **Motivating instance (sparx).** The dashboard authors many named `SiteTheme`s; the site serves one active brand compiled light+dark; the WCAG `-content` derivation is sparx-side (parity-spec §1).
- **Open questions.** Engine edits _one_ theme's tokens; the host owns the _library_ (create/apply/named themes) — is that split clean? Does the engine consume host-injected `-content` tokens (parity-spec §1) rather than computing contrast? Per-mode brand overrides — engine or host?
- **Candidate generic direction.** Engine edits one theme (token map); host owns the named-theme library + the WCAG derivation, injecting `-content` the engine _consumes_. Matches parity-spec §1 exactly.

---

## Part 8 — The rendering-fidelity keystone

### Q19 — Can the family guarantee preview==production with ONE renderer, not two?

- **Generic problem (the most important).** sparx's builder achieves "what you see is what ships" by having the **canvas and the storefront call the same `renderLeaf`**. silicaui splits rendering into the **engine's canvas renderer** and silicaui-html's **static `toHtml`** — _two_ renderers, and neither resolves published data. Two renderers is a standing drift risk and the reason a host must rebuild the live-render path.
- **Open questions.** Should silicaui ship **one** framework-neutral, data-capable renderer (Q3) that the editor canvas AND every host's published surface both invoke — making preview==production _structural_? Is the React projection (silicaui-react) a _third_ renderer to keep in sync, or generated from the same walk? How does the behavior runtime (`data-sui-*`) stay identical across editor-preview (autoplay off) and live?
- **Candidate generic direction.** A single `silicaui-html` renderer (static + optional resolvers) shared by engine-canvas and host-live, with React as a _generated_ projection of the same walk — the design sparx proved with one shared `renderLeaf`. **This is the highest-leverage thing silicaui-builder could adopt from sparx**, and it turns Q1–Q5 from "host rebuilds it" into "the family ships it once."

---

## Part 9 — Concrete defects from the live adoption (2026-07-10)

Unlike Q1–Q19 (design questions), these are **verified defects found while shipping the
storefront on the family**, each with a reproduction and a minimal fix. They are small,
and each one forced sparx to carry a bridge it should not own.

**Status against 0.14.0** (verified against the installed tarballs, not the changelog):
Q20 and Q21 are **resolved**. Q22 is **new**, and it is what still blocks deleting the
Q20 bridge — the binding Q20 asked for shipped, but the resolver cannot use it on the
one node shape it exists for.

### Q20 — A bound value could reach text and `src`, but never an arbitrary ATTRIBUTE — ✅ **shipped in 0.14.0**

- **Generic problem.** `DataBinding` was closed to `value | collection | action`, and
  `fillValue` picked its destination from the node's tag: `img`/`source` → `attrs.src`,
  `input` → `attrs.value` (0.12), everything else → children (text). There was no way to
  say "bind this ref into THIS attribute."
- **Motivating instance (sparx).** A product card must link to its product. Binding an
  `<a>` replaced its children with the URL string and destroyed the card, so
  **a data-driven product grid could not navigate** — the single most basic thing a
  storefront does.
- **Resolution (0.14.0).** `DataBinding` gained `{ kind: 'value', ref, attr? }`, and
  `fillValue(node, value, attr)` writes `attrs[attr]` on an element / `props[attr]` on a
  component, still through `sanitizeElement`'s per-tag allowlist + `isSafeUrl` (confirmed:
  a `javascript:` payload in host data is dropped). Exactly the proposed shape.
- **Two follow-ups, both minor:**
  1. No authoring helper sets it — `bind(node, ref)` still takes no third argument, so a
     host must assign `node.data = { kind: 'value', ref, attr }` by hand. A `bind(node,
ref, { attr })` overload would close it.
  2. An empty value writes an empty attribute: `String(value ?? '')` yields `href=""`, an
     anchor that silently reloads the current page. Consider omitting the attribute when
     the resolved value is `''`/nullish (or an explicit `omitWhenEmpty`).

### Q21 — The `render` prop was unusable from a React Server Component — ✅ **resolved (0.13.0), verified on 0.14.0**

- **Generic problem.** `@wizeworks/silicaui-react` is a `'use client'` module. From a
  Server Component, `render={<Link/>}` is an element crossing the RSC → client boundary;
  React serializes it and the receiving component saw no `.props` during SSR. Button then
  did `mergeProps(ownProps, render.props)` → `TypeError: Cannot read properties of
undefined (reading 'className')`. **It failed at request time only** — `tsc` and `eslint`
  were perfectly happy. (`children` survives the same boundary because React _renders_ it
  rather than introspecting it.)
- **Motivating instance (sparx).** Migrating `apps/site` onto silicaui-react broke five
  server components at once, including the storefront home page, `/products`, and
  `/search` — all HTTP 500, all green in CI.
- **Resolution.** 0.13.0 shipped `mergeProps(ours, theirs = {})`. Verified live on 0.14.0
  from a throwaway server-component route: `<Button render={<Link href="…"/>}>` renders a
  correct `<a class="btn btn-primary btn-lg" href="…">`. `.props` is in fact present; the
  default is a safety net rather than the load-bearing fix.
- **Also shipped (0.14.0).** `buttonClasses` / `badgeClasses` / `clickableCardClasses` are
  now exported from `@wizeworks/silicaui-react/server` with no `'use client'` banner, so a
  Server Component can style a plain element directly:
  `<Link className={buttonClasses({ color, variant, size })}>`. That keeps `<Button>` out
  of the client bundle of a page whose only need was a styled anchor. Sparx uses it in
  `apps/site/components/button-link.tsx`.
- **Residual nit.** The `= {}` default means a future prop-forwarding regression would drop
  the `href` **silently** instead of throwing. A dev-mode warning when `render` is an
  element with no `props` would surface it.

### Q22 — `resolveTree` stops resolving a node's children once it fills that node's binding — 🔴 **open (0.14.0)**

- **Generic problem.** In `resolve.ts`:

  ```js
  if (node.data?.kind === 'value' && host.resolveBinding) {
    const resolved = host.resolveBinding(node.data.ref, scope);
    if (resolved.visible === false) return undefined;
    const filled = fillValue(node, resolved.value, node.data.attr);
    const { data: _data, ...rest } = filled;
    return { ...rest }; // ← returns WITHOUT resolving children
  }
  ```

  Early-returning is **correct for a text binding** — `fillValue` just replaced the
  children with the value, so there is nothing left to walk. It is **wrong for an
  attribute binding**, where `fillValue` deliberately preserves the children. They are
  never resolved.

- **Consequence.** Q20's new `attr` binding is unusable on any node that contains other
  bindings — which is precisely, and only, the shape it was added for. Bind a card's
  `<a href>` and every binding inside it survives to the HTML as a dead `data-sui-bind`
  marker over placeholder text.

- **Reproduction** (against installed 0.14.0; grid repeats, card carries the attr binding):

  ```
  ATTR BINDING:  <a class="card" href="/p/aurora"><h3 data-sui-bind="title">PLACEHOLDER</h3></a>
  CONTROL:       <a class="card"><h3>Aurora Lamp</h3></a>
  ```

- **Candidate generic direction.** Recurse when the binding filled an attribute:

  ```js
  return node.data.attr && rest.children
    ? { ...rest, children: resolveChildren(rest.children, host, scope) }
    : { ...rest };
  ```

- **Sparx's bridge (delete-on-fix).** `@sparx/silica-catalog/src/attr-binding.ts` —
  `bindAttr(el, 'href', 'url')` tucks a bound `<input type="hidden" name="__sui-attr:href">`
  **leaf** inside the element (a leaf has no children to lose), and `hoistAttrBindings`
  lifts the resolved value onto the parent's real attribute and strips the carrier between
  `resolveTree` and `toHtml`. It composes only documented behavior and grants no sanitiser
  bypass. It also, incidentally, gets Q20's follow-up (2) right: an empty value emits no
  attribute at all.

- **Two adjacent sharp edges** found while diagnosing this, worth documenting in the
  engine's own docs:
  - `repeat(node, ref)` **overwrites `node.data`**. Marking the same node as both a
    collection and an attribute binding silently keeps only the collection.
  - `resolveTree` returns the tree **unchanged** when the host implements neither
    `resolveBinding` nor `resolveCollection` — a host that supplies a differently-shaped
    resolver gets a silent no-op rather than an error.

---

## 10. Synthesis — which answers unlock "adopt the engine"

Grouping the 19 questions by _what they decide_:

| Bucket                                                                | Questions                                                                                             | Verdict shape                                                                                                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must ship in the engine/family, generically** (the reason to adopt) | Q1–Q5 (dynamic layer), Q10 (host catalog), Q12 (host panels), Q14 (validateClass), Q19 (one renderer) | These are the **seam** the shipped 0.8.0 lacks. Until they exist, adopting the engine strands sparx (doc 118's finding). Closing them = Phase F becomes viable. |
| **Already shipped / adequate**                                        | Q7 (single outlet), Q8 (symbols/overrides), Q16 (load/extract/onChange), Q18 (theme editing)          | Real today; verify they cover sparx's cases without loss.                                                                                                       |
| **Host-owned by design (keep out of the engine)**                     | Q3-host-half, Q5 (conditionals→host data), Q11 (content model), Q17 (scoping), Q18 (theme library)    | The seam is correct; the answer is "host plug," not "engine feature."                                                                                           |
| **Contribute sparx's proven solution upstream**                       | Q2/Q3 (`runtime.ts`), Q13 (design-surface widgets), Q15 (`element.ts`), Q19 (shared renderer)         | sparx has _reference implementations_ of these. The generic move is to lift them into the family, not keep them sparx-only.                                     |

**The load-bearing five (Q1, Q2, Q3, Q10, Q19).** If silicaui-builder grows an opaque three-primitive data layer resolved through host callbacks (Q1/Q2/Q4), a host-supplied catalog (Q10), a host-supplied class policy + inspector panels (Q14/Q12), and — the keystone — **one data-capable renderer shared by canvas and live site (Q3/Q19)**, then adopting the engine deletes sparx's editor chrome _and_ its bespoke render seam, and the family gains the exact capabilities that make it a real product rather than a demo. That is the strongest version of Phase F.

---

## 11. What this means for the doc-118 approach

Honest re-evaluation, given the questions:

- **Unchanged either way:** the document must go silica-native and the storefront must render silica through a data-resolving runtime. Doc 118's WS-2/3/4/5/6/8/9 stand.
- **What changes if the load-bearing five are answered:** doc 118's WS-7 (re-skin the editor chrome) is **replaced** by Phase F (adopt the engine) — and better yet, the render-seam work (WS-3) could target the **family's shared renderer (Q19)** instead of sparx's `renderLeaf`, so sparx stops owning a bespoke render path _and_ a bespoke editor.
- **The decision this doc enables:** treat the "load-bearing five" as a **joint silicaui-builder roadmap**. If WizeWorks will fund them (WizeWorks owns silicaui), Phase F is the better approach and doc 118 becomes the _migration substrate_ for it — do the document/render/apps-site migration against the family's shared renderer, skip WS-7, and adopt the engine as its host-seam lands. If they will not be funded soon, doc 118 as written (keep + re-skin) is the correct pragmatic path.

So: **we may indeed not have picked the best approach — but only for the editor half.** The generic-first answer is to invest the WS-7 effort into the silicaui-builder host seam (the load-bearing five) instead of into sparx-only chrome, _provided_ we're willing to move silicaui-builder to ~1.0 on this roadmap. This doc is the roadmap's question set; the next step is answering the load-bearing five in the silicaui repo's `builder-contract.md`, then re-deciding doc 118's Phase D vs F.

---

## Definition of done (for _this_ doc's purpose)

- [ ] Every gap in silicaui-builder 0.8.0 vs sparx's needs is captured as a **generic** question (host-reusable answer, not a sparx fit).
- [ ] Each question names its generic problem, the contract's stance, the shipped reality, sparx as the motivating instance, and a candidate generic direction.
- [ ] The **load-bearing five** (Q1, Q2, Q3, Q10, Q19) are identified as the seam that unlocks Phase F.
- [ ] sparx's **reference implementations** to contribute upstream are called out (`runtime.ts`, the design-surface widgets, `element.ts`, the shared renderer).
- [ ] The doc-118 approach is re-evaluated against the answers, with a clear conditional recommendation.
- [ ] Intended to be **contributed to the silicaui repo** as the builder engine's roadmap input.
