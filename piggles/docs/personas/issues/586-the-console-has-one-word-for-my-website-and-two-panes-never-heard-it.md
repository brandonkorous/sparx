# 586 — The console has one word for my website, and two panes never heard it

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Stock → Things that do not add up
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/{integrity.tsx,provenance.tsx}`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_non_technical_audience]]

## What she saw

Under the heading **When you ran out**, one row:

| Item                                    | What happened |
| --------------------------------------- | ------------- |
| The Ash Overshirt<br>**via storefront** | Sale refused  |

"storefront" is not a word Devi uses. It is the word the database uses. On Money,
two panes away, the same sale is called **Your website**.

## Why

The console already fixed this once. `lib/console/channels.ts` exists because
Devi's single till sale read four different ways on four screens (issue 260), and
its header says so:

> ONE vocabulary, because a channel is a fact about an order and a fact may not
> have four names.

Eight panes use it. Two never did:

```tsx
<span className="text-sm">via {incident.channel}</span>   // integrity.tsx
<Text className="font-semibold">On {data.channel.channel}</Text>  // provenance.tsx
```

The module that prevents this was written, adopted almost everywhere, and the two
inventory panes were left behind. The same two lines, unchanged, in sparx.

## Measured

```sql
select t.name, i.channel, count(*) from inventory_oversell_incidents i
join tenants t on t.id = i.tenant_id group by 1,2 order by 3 desc;
```

| tenant        | channel        | rows  |
| ------------- | -------------- | ----- |
| Thistle & Rye | **storefront** | **3** |
| Thistle & Rye | _(none)_       | 3     |
| Juniper Row   | **storefront** | **1** |

Four rows, two businesses, and Devi is one of them. Every row that carries a
channel at all prints the raw word.

## The fix

Both panes call `channelLabel`, and the preposition goes.

```tsx
<span className="text-sm">{channelLabel(incident.channel)}</span>
```

The preposition had to go because the console's channel words are written to
**stand alone**: `pos` is "At the till" and `admin` is "Added by hand". "On At
the till" is not a sentence. Every one of the eight call sites that already used
the module renders the label bare, so these two now match them.

**Now**, verified in the browser:

> The Ash Overshirt
> **Your website**

## Proven

**`channel-slug-never-rendered.test.ts`** — a source scan of the whole
`surfaces/` tree in both consoles, for one shape only: a JSX expression whose
entire content is a path ending in `.channel`, in a child position.

It asserts three things, in this order:

1. **The matcher works**, before anything trusts what it reports. It must see
   `via {incident.channel}` and must not see `{channelLabel(incident.channel)}`.
2. **Its own denominator** — more than 150 `.tsx` files, so a scan whose root
   moved fails rather than reporting everything clean
   ([[feedback_structural_checks_go_blind]]).
3. No raw channel is drawn.

An **attribute** is deliberately exempt. `value={draft.channel}` on a Select is
the identity the form round-trips, and translating it would break the control.
The `=` before the brace is what tells a prop from a label.

Putting both lines back:

```
+     "text": "incident.channel",
+     "where": "inventory/integrity.tsx:431",
+     "text": "data.channel.channel",
+     "where": "inventory/provenance.tsx:177",
```

Two hits, the right two, no false positives, in both consoles.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **483 pass** (58 files) |
| sparx console   | **385 pass** (49 files) |
| typecheck       | both exit 0             |
| console parity  | PASS                    |
| lint / prettier | clean                   |

## Still open

`provenance.tsx` has **no instance today** — `inventory_channel_buffers` is empty
platform-wide, so nobody has seen "On storefront" yet. It is fixed on the same
reasoning rather than on a sighting, because the column is a free `varchar(63)`
and the next business to set a channel cushion would have been the first to read
it.

sparx's channel vocabulary is now **consolidated** and filed separately as
[593](593-the-same-sale-had-five-names-in-the-other-console.md).

The count recorded here was wrong, and wrong in a way worth remembering. This
issue said "three separate `channelLabel` functions". There were **six**. Two of
them are not called `channelLabel` — `CHECKOUT_CHANNEL_LABELS` and
`CART_CHANNEL_LABELS` — so a search for the function name found four and a
reading of that search reported three. **Grepping for the name of a thing finds
the copies that kept the name.** What found all six was asking who IMPORTS the
shared function: the two extra tables showed up as callers with no import.
