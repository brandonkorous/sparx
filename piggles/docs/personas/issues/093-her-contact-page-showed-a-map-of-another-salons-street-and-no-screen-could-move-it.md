# 093 — Her contact page showed a map of another salon's street, and no screen could move it

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** the published site — `/contact` · mypiggles › My Site › Page
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen and on the live site 2026-08-22

## What happened

Nia wrote her contact page. The address on it is hers, and it stayed hers without
her typing it twice — the console says so on the canvas:

> These words come from Your site, under Phone number. Change them there and every
> page that shows them follows.

Underneath that address is a map. The map is of **128 Linden Street, Portland,
Oregon** — the demo salon the starter site was written around, six hundred miles
from her chair, on the same page as her real address and her real phone number.

Read straight off the live page:

| What the page says                              | Where it comes from                     |
| ----------------------------------------------- | --------------------------------------- |
| 214 Bower Street, Suite B, Sacramento, CA 95811 | her Site identity, bound                |
| the map beside it                               | `128 Linden Street, Portland, OR 97205` |

She cannot fix it. Selecting the map in the console gives a settings panel with
**Gap above**, **Link straight to this part**, **Name this layer** and **Lock in
place** — and no field that has anything to do with an address.

And it is not only the one the starter left. Adding a **Map** from the Add
palette gives the same block with the same lack of a field, under a hint that
promises the opposite:

> A map showing where you are. **Type your address** — or paste a Google Maps
> link — and visitors get a map they can zoom and get directions from.

There is nowhere to type it.

## Why it matters

A wrong map is worse than no map, and worse than a wrong line of text, because a
map is the thing a person acts on. A client who taps it drives to a different
state. It also sits **beside** the correct address, so the page contradicts
itself and the more authoritative-looking half is the wrong one.

It is silent in the way that costs most ([[feedback_absent_behaves_like_fine]]):
a map with somebody else's address renders exactly like a map with yours.

## Where it lives

The core declares the field. Nothing drew it.

[wizeworks/packages/silica-catalog/src/host-nodes.ts](../../../../wizeworks/packages/silica-catalog/src/host-nodes.ts)
gives `site.map` three author-tunable props, with labels already written in the
tenant's language, under a comment that says exactly where they were meant to
appear:

```ts
/** Author-tunable props surfaced in the Inspector's Host panel. */
props?: HostComponentProp[];
// …
{ name: 'location', label: 'Address or place', type: 'text', default: '' },
{ name: 'title', label: 'What the map shows', type: 'text', default: 'Map' },
{ name: 'zoom', label: 'Zoom', type: 'number', default: 15 },
```

**There was no Host panel.** Nothing in either console read `props` at all —
`hostCoreGroups()` in
[piggles/apps/workbench/lib/studio/catalog-scope.ts](../../../apps/workbench/lib/studio/catalog-scope.ts)
maps each core into the palette by `label`, `icon`, `hint` and `make`, and drops
the prop list on the floor. The Inspector's own extension point was wired to the
document and nothing else:

```ts
inspectorPanels: (_node, ctx) => (ctx.isRoot ? panelFor(ctx.doc.kind) : null),
```

`_node` — the underscore is the whole defect. The selected node was handed to the
hook and deliberately ignored, so the only values these props could ever hold were
the ones whoever authored the tree wrote. For Nia that is a blueprint, and the
blueprint wrote its own street.

**Five cores were affected**, not one:

| Core               | Props nobody could reach                             |
| ------------------ | ---------------------------------------------------- |
| `site.map`         | Address or place · What the map shows · Zoom · Shape |
| `site.embed`       | **Link** · What it is · Shape                        |
| `site.brand`       | Show (logo and name / logo only / name only)         |
| `site.legal-links` | Heading                                              |
| `site.pagination`  | Which list                                           |

`site.embed` is the same defect one step worse: an embed block whose **Link** can
never be set is a block that can only ever show nothing.

## The fix

**A Host panel, drawn from the props the cores already declare** —
[piggles/apps/workbench/surfaces/studio/host-settings-panel.tsx](../../../apps/workbench/surfaces/studio/host-settings-panel.tsx),
returned from `inspectorPanels` for any selected host node:

```ts
inspectorPanels: (node, ctx) => {
  if (ctx.isRoot) return panelFor(ctx.doc.kind);
  return node ? <HostSettingsPanel node={node} /> : null;
},
```

Three things about it worth keeping:

- **It reads the registry, never a list of its own.** A core that gains a prop
  gains a field, and a new core needs no change here. That is the point: the
  reason this was broken for years is that the declaration and the editor had no
  connection at all.
- **An unrecognised type gets a text box, not silence.** `text` / `number` /
  `select` / `boolean` each draw their own control; anything else — including a
  type added later — falls back to a text field. Rendering nothing for a type it
  does not know is precisely how the whole set came to be unreachable.
- **The panel writes through the ordinary op** (`node.setProp`), so a map's
  address undoes with everything else and goes to the server on the pane's one
  Save. No second Save button, matching the page-settings panel beside it.

**This is Piggles' file.** sparx's workbench has its own copy of
`inspectorPanels` with the same `_node` and the same gap; it is outside this
run's tree and is flagged rather than touched.

## Confirmed by

Re-run as Nia on 2026-08-22.

1. `mypiggles` › My Site › Page › Contact, select the map in Layers. The panel now
   reads **Map on its own**, its hint, and **Address or place · What the map shows ·
   Zoom · Shape** — with the address field showing `128 Linden Street, Portland,
OR 97205`, which is the first time that value has ever been visible to its owner.
2. Typed `214 Bower Street, Suite B, Sacramento, CA 95811`, saved, published.
3. The live page's map now requests
   `q=214+Bower+Street%2C+Suite+B%2C+Sacramento%2C+CA+95811`.

## Rating effect

`My Site › Page` and the published `/contact` are scored in [rating.md](../rating.md).
