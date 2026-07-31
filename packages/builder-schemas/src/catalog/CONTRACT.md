# Catalog authoring contract (read before writing any category file)

You are authoring ONE category file of the platform component catalog (docs/98 §5).
Each file exports a `const <NAME>_CATALOG: PlatformCatalogEntry[]` of composed,
daisyUI-grade components rebuilt in OUR token system. daisyUI is a breadth/naming
reference ONLY — never name it (or any competitor) in the output; describe in our
own words.

**Read first:** `_kit.ts` (the helpers + entry shape) and `navigation.ts` (the
reference — match its quality, structure, and comment style exactly).

## Imports (always)

```ts
import { el, atom, bound, behave, part, entry, type PlatformCatalogEntry } from './_kit';
// commerce / content composites that bind the spine also import:
import { repeat, act } from './_kit';
```

## Helpers

- `el(tag, classes, { text?, attrs?, children? })` → a raw HTML element node
  `type: 'el:<tag>'`. Attrs go on `props` (see attr rules); inline text on
  `props.text`. THE workhorse — use for all structural containers + styled text.
- `atom(type, classes, props?, children?)` → a named registry atom that "wears its
  own class": `Heading` (props `{level:'h1'|'h2'|'h3', text}`), `Text`
  (`{variant:'body'|'meta', text}`), `Button` (`{label}`, give it a recipe class —
  `st-btn st-c-<color> st-v-<treatment> st-btn--sz-<sz>`), `Badge` (`{label}`),
  `Image`/`ImageDisplay` (`{ratio:'wide'|'square'|'portrait', alt}`), `Icon`
  (`{name}` lucide), `Divider`, `PriceTag`, `Stat` (`{value,label}`).
- `bound(node, 'path')` → attach a data binding (e.g. `bound(atom('Wordmark',''),'site.identity')`,
  `bound(atom('Heading','',{level:'h2'}),'product.title')`). Use only where a real
  data field fits; otherwise author static placeholder text.
- `repeat(node, { from, id?, limit? })` → mark a container a COLLECTION REPEATER
  (commerce). `from: 'all'` iterates the catalog; the tenant re-points it to a
  collection/category after dropping. Each item scopes its subtree to a product.
- `act(node, action, href?)` → attach an ACTION to a trigger: `'add-to-cart'` /
  `'buy-now'` (resolve the product in scope), `'link'` (to `href`), `'submit'`.
- `behave(node, { type, ...params })` → mark a node a behavior ROOT (Pillar 5). See
  the interactivity section below.
- `part(node, role)` → mark a node a structural PART of its enclosing behavior.
- `entry({...})` → wraps each catalog entry (pins the type).

## Entry shape

```ts
entry({
  key: 'unique_snake_key', // ^[a-z][a-z0-9_]*$, unique across WHOLE catalog — prefix with category where helpful
  name: 'Human Name',
  category: '<your category>', // exactly your file's category
  kind: 'common', // or 'comprehensive' for large composites
  icon: 'lucide-name', // a real lucide icon name
  description: 'One clear sentence.',
  surfaces: ['page', 'site'], // mockups/marketing: ['page','site']
  tags: ['search', 'terms'],
  tree: el(/* … */), // a SINGLE root node
});
```

## Binding the spine (commerce + content composites — docs/98 Pillar 7)

A composite that SELLS or DISPLAYS A RECORD binds the v2 spine, not just field paths.
The rule that makes a template reusable: **never bake a concrete record id into catalog
data.** A template is authored inert-but-rich — `item.*` bindings with believable static
placeholder copy — and gets its scope one of two ways:

- **Tenant-pinned (standalone).** The composite's ROOT container is the pin target. The
  tenant drops it, then pins a product / collection / category / content entry via the
  Data panel ("A record"); that writes `{ entity, id }` onto the root and scopes the
  subtree. Until pinned, the static placeholders show and any add-to-cart is inert — the
  correct unbound-canvas state.
- **Repeated.** Wrap the card in `repeat(container, { from:'all', limit:N })` (commerce)
  or `bound(container, 'cms.<type>')` (content arrays — the `source` schema is
  commerce-only). Each item scopes its subtree, so the same card renders per record.

Inside a scoped subtree, bind leaves to `item.*`: a product card → `item.image` /
`item.title` / `item.price` + `act(atom('Button',…,{label:'Add to cart'}),'add-to-cart')`;
a content card → `item.featuredImage` / `item.title` / `item.body`. An `add-to-cart` /
`buy-now` button only resolves a product when a product scope (a product pin, or any
`repeat`) is an ancestor — place it accordingly.

## Email surface (`surfaces: ['email']`) — a different medium

Email blocks (`email.ts`) are authored under tighter rules than page/site, because a
mail client renders inline styles, not `tenant.css` (docs/98 §3.6c):

- **Named nodes only — NO `el()` raw HTML.** Compose from `atom('Section'|'Stack'|
'Grid'|'Card', …)` containers and `atom('Heading'|'Text'|'Button'|'Divider'|
'ImageDisplay'|'line_item_table'|'unsubscribe_link'|'physical_address', …)` leaves.
  The email surface has no raw-element palette (`catalog.test.ts` rejects `el:*` here).
- **Base classes only — NO variants.** No `@3xl:`/`md:`/`hover:`/`dark:`, no arbitrary
  `[…]`. The email compiler (`emailStyleFor`) drops anything prefixed or bracketed.
- **Only the honored subset does anything.** Containers: `flex flex-col`/`flex-row` /
  `grid grid-cols-N` / `gap-N` / `p-N` / `bg-*` (the send parses direction/columns/gap
  /padding and inlines bg/border/radius). Leaves: text size/weight/leading/tracking,
  `text-*`/`bg-*`/`border-*` color, alignment, padding/margin, border, radius. Avoid
  shadows, filters, transforms, sizing, position — they no-op in mail.
- **No header block.** The `email_wordmark` header is pinned + auto-injected by
  `normalizeEmailTree`; a second one would be de-duped.

## Token utilities (these compile to the tenant's silica theme; use ONLY these colors)

- Surfaces/text: `bg-base-100|200|300`, `text-base-content` (+ opacity: `text-base-content/60`),
  `border-base-200|300`.
- Brand/semantic (each has a `-content` foreground): `primary`, `secondary`,
  `accent`, `neutral`, `info`, `success`, `warning`, `danger`, `highlight`.
  e.g. `bg-primary text-primary-content`, `bg-success/10 text-success`,
  `border-danger text-danger`. **It is `danger`, NOT `error`.**
- Radius: `rounded-box` (cards/panels), `rounded-field` (inputs/buttons),
  `rounded-selector` (chips), plus standard `rounded-full`, `rounded-lg`.
- Shadow: `shadow-sm|md|lg`. Motion: `animate-fade-in|fade-up|scale-in` etc.
- Spacing/layout: the full standard Tailwind scale (`p-*`, `gap-*`, `flex`, `grid`,
  `grid-cols-*`, `w-*`, `max-w-*`, `items-*`, `justify-*`, …).
- Responsive: use CONTAINER queries (`@3xl:flex`, `@2xl:grid-cols-2`, `@4xl:grid-cols-3`)
  NOT viewport `md:`/`lg:` — the canvas keys off the node's own width. Make multi-column
  layouts collapse to one column on narrow containers.

## BANNED (the allowlist rejects these — never author them)

`fixed`, arbitrary `z-[…]` (use named `z-40`/`z-50`), `content-[…]`, any `url()` in a
class, raw inline `style`. No `@keyframes`. Position `absolute`/`relative`/`sticky` OK.

## Tag + attribute rules

- Container tags: `div section nav header footer main aside article figure figcaption
ul ol dl table thead tbody tfoot tr form fieldset details picture svg g`.
- Text tags (carry `props.text` when they have no element children): `span p h1–h6 a
strong em small blockquote code pre label li dt dd th td caption legend option button
summary`.
- Void tags: `img input hr br source col` (never nest children).
- Attributes are CAMELCASE prop keys (mapped to HTML): global on every tag =
  `id, title, role, ariaLabel`. Per tag: `a`→`href,target,rel`; `img`→`src,alt,width,height,loading`;
  `input`→`type,name,placeholder,disabled,required`; `textarea`→`name,placeholder`;
  `button`→`type,disabled`; `label`→`htmlFor` is NOT available — use `for`? No: only the
  listed keys. `details`→`open`; `svg`→`viewBox,fill,stroke,strokeWidth`; `path`→`d,fill,
stroke,strokeWidth,strokeLinecap,strokeLinejoin`. There is NO generic `aria-*` except
  `ariaLabel`. Unknown attrs are silently dropped — don't author them.
- Icons: prefer the `atom('Icon','',{name:'lucide-name'})` atom, OR inline `el('svg',…)`
  with `el('path',…)`. Simple unicode glyphs in `text` (e.g. ☰ ✓ › ★) are fine too.

## Interactivity — two tracks

### CSS-only (prefer for `common` blocks; no runtime needed)

- Disclosure / accordion / dropdown / mobile menu → native `el('details', …, { children:
[ el('summary', '… [&::-webkit-details-marker]:hidden', { text }), el('div', 'absolute …
panel') ] })`. Hide the marker with `list-none [&::-webkit-details-marker]:hidden`.
- Carousel / horizontal scroller → a flex row with `overflow-x-auto snap-x snap-mandatory`
  and children `snap-start shrink-0`.
- Toggle / swap → a `peer` checkbox + `peer-checked:` siblings, or just a styled static.
- Tabs → static visual (active underline) is fine; panels wire up later.

### The behavior runtime (for `comprehensive` composites that genuinely need JS)

A small, CLOSED, platform-authored runtime (`@sparx/builder-render` behaviors, Pillar 5)
drives autoplay carousels, a continuous marquee, scroll-adaptive nav, click-open menus,
single-open accordions, and JS-wired tabs. You author it with `behave`/`part` — NEVER raw
`data-*` (the element whitelist strips those). The interactive composites live in
`interactive.ts`; copy its patterns. The runtime runs in BOTH surfaces: the live
storefront gets full behavior; the canvas previews (autoplay suppressed, panels revealed
for editing). Authoring rules:

- **Root:** `behave(node, { type, ...params })`. `type` is one of `carousel` | `marquee`
  | `disclosure` | `tabs` | `menu` | `scrollspy`. Params per behavior:
  `carousel` → `{ autoplay?: boolean, interval?: number /*sec*/ }`;
  `marquee` → `{ pauseOnHover?: boolean }` (give the moving track `animate-marquee`);
  `disclosure` → `{ single?: boolean }`; `scrollspy` → `{ threshold?: number /*px*/ }`;
  `tabs` / `menu` → no params.
- **Parts:** `part(node, role)`, role one of `track` `slide` `prev` `next` `dot` `trigger`
  `panel` `item` `tab`. Each behavior reads specific parts:
  - `carousel` → a `track` wrapping N `slide`s; optional `prev`/`next` buttons and one
    `dot` button per slide (the behavior sets `data-active` on the current dot — style with
    `data-[active=true]:…`). Wrap the root in `overflow-hidden`.
  - `marquee` → a single `track` with `animate-marquee`; the live surface clones its
    children for a seamless loop.
  - `disclosure` → N `item`s, each holding a `trigger` button + a `panel`. `single` keeps
    one open. The item carries `data-open`; flip a chevron with `group` +
    `group-data-[open=true]:rotate-180`.
  - `tabs` → `tab` buttons index-matched (DOM order) to `panel`s. The behavior sets
    `data-active` on the current tab.
  - `menu` → one `trigger` + one `panel` (absolute-positioned dropdown / mega-menu).
  - `scrollspy` → put it on the `nav`; it sets `data-scrolled` on the root past `threshold`
    (style with `data-[scrolled=true]:…`) and `data-active` on the `a[href="#id"]` whose
    section is in view (no `part` needed — it keys off the hash href).
- **Closed panels ship hidden:** any panel that starts collapsed (menu dropdown, inactive
  tab panels, accordion answers) gets `attrs: { hidden: true }` so it doesn't flash open
  before hydration. The active tab panel / open item omits it. The canvas reveals all of
  them regardless.

## Quality bar

Production-complete, world-class, on-brand. Realistic placeholder copy (no lorem; no
"eyebrow" uppercase kicker labels — house rule). Every component responsive + visually
balanced. Match `navigation.ts` density and comments. A single root node per entry.
Do NOT run any commands, do NOT edit any other file — only write your one category file.
Return a one-line summary of what you authored.

```

```
