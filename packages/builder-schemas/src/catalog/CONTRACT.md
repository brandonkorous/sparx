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
import { el, atom, bound, entry, type PlatformCatalogEntry } from './_kit';
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

## Token utilities (these compile to tenant `--st-*`; use ONLY these colors)

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

## Interactivity WITHOUT JavaScript (there is no behavior runtime yet)

- Disclosure / accordion / dropdown / mobile menu → native `el('details', …, { children:
[ el('summary', '… [&::-webkit-details-marker]:hidden', { text }), el('div', 'absolute …
panel') ] })`. Hide the marker with `list-none [&::-webkit-details-marker]:hidden`.
- Carousel / horizontal scroller → a flex row with `overflow-x-auto snap-x snap-mandatory`
  and children `snap-start shrink-0`.
- Toggle / swap → a `peer` checkbox + `peer-checked:` siblings, or just a styled static.
- Tabs → static visual (active underline) is fine; panels wire up later.

## Quality bar

Production-complete, world-class, on-brand. Realistic placeholder copy (no lorem; no
"eyebrow" uppercase kicker labels — house rule). Every component responsive + visually
balanced. Match `navigation.ts` density and comments. A single root node per entry.
Do NOT run any commands, do NOT edit any other file — only write your one category file.
Return a one-line summary of what you authored.

```

```
