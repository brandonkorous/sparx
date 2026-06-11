# Component submission

A **component** is a reusable building block for the site/page builder — a hero, a
pricing table, a testimonial band, a CTA. It is a declarative node-tree; no code runs.

## Bundle

```
cta-banner/
  sparx.json      # category: "component"; facets: group, surfaces[]
  component.tsx   # exports { group, surfaces, icon, description, propSpec, tree }
  media/
    preview.png   # the component rendered on a sample page (card image)
  README.md
```

## Payload contract (`component.tsx`)

- **`tree`** — a `BuilderNode` built with the allow-listed `node()` helper. Use
  only known node types (`Section`, `Grid`, `Stack`, `Heading`, `Text`, `Button`,
  `Image`, `Card`, …). Reference colors/spacing via tokens, never hardcoded hex, so
  the component re-themes to the installing site.
- **`propSpec`** — the fields an installer fills in. Each: `{ key, label, kind,
default? }` with `kind` ∈ `text | textarea | richtext | url | boolean | number |
select`. Mark a value as fillable in the tree with a `{ $prop: 'key' }` slot.
- **`group`** ∈ `layout | content | data`; **`surfaces`** ⊆ `page | site | email`.

## What gets checked

- `tree` validates against the builder node schema; every node type is known; no
  raw `style`/HTML; no `custom:*` nested components.
- Every `{ $prop }` slot has a matching `propSpec` entry and vice-versa.
- Allow-list: only the files above; imports limited to the authoring helper.

## Add

On approval the tree + propSpec are stored on the catalog row. **Add to my
components** clones it into the tenant's own component library (a real, editable
copy) — no deploy. Placing it on a page expands the tree to primitives at publish,
so the storefront only ever sees safe data.
