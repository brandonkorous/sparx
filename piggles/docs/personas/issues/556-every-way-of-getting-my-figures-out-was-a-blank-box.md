# 556 — Every way of getting my figures out was a blank box

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, looking for the thing that would send her stock figures to her accountant
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/{performance,stock-grid,stock-import}.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_absent_behaves_like_fine]] · [[feedback_fetched_but_never_rendered]] · [[feedback_silicaui_single_point_of_change]]

## What she saw

A small empty rounded box, 30px wide, sitting under the description on
**How it is performing**. Nothing on it. No word, no icon, no tooltip.

There were **five of them on that one screen**, one per report card, and two more
on **Edit a lot at once** and **Import from a file**. Seven blank boxes, and
between them they were the entire way of getting anything out of the Stock
module.

The import screen is the one that stings. Its own instructions read:

> _The file needs a code column and either a count or a change. **Download what
> you have** and you get exactly those columns, already filled in: count the
> shelves, correct the numbers that are wrong, upload it back._

The words "Download what you have" were the name of a button that had no words
on it.

## Measured

```js
[...document.querySelectorAll('a[download]')].map((a) => ({
  text: a.textContent,
  w: a.getBoundingClientRect().width,
}));
```

| before                    | after                                 |
| ------------------------- | ------------------------------------- |
| `{ text: "", w: 30 }` × 5 | `{ text: "Spreadsheet", w: 140 }` × 5 |

Empty text content, so no accessible name either: five links in a row that a
screen reader announces as "link", "link", "link", "link", "link".

## The cause

```tsx
<Button
  color="neutral"
  variant="outline"
  size="sm"
  render={
    <a href={reportCsvPath(reportKey, filters)} download>
      <Icon glyph={faDownload} className="size-4" aria-hidden />
      Spreadsheet
    </a>
  }
/>
```

Silica's `render` follows Base UI's composition model: **the element passed in
supplies the tag and its props, the control supplies the children.** The
documented form is

```tsx
<Button render={<a href="/docs" />}>Docs</Button>
```

Written self-closing, the Button has no children, so it renders none, and the
label inside the anchor is thrown away. The href survived, the classes survived,
the thing was clickable. It just had nothing on it.

Nothing could fail. Types were satisfied (`render` takes a `ReactElement`, and
that is what it got), lint was satisfied, 383 console tests passed, and no test
renders these buttons. This is [[feedback_absent_behaves_like_fine]] exactly: a
control with no label renders as a control.

**The inversion was deliberate**, which is the part worth keeping. The comment
above it said so:

> _A real anchor, so right-click → save and open-in-new-tab both work. The label
> lives INSIDE it rather than as Button children: silica merges them either way,
> and an empty `<a />` is an accessibility failure the linter is right to flag
> even when the runtime output is fine._

`jsx-a11y/anchor-has-content` does flag `<a />` with no children. Moving the
label inside silenced the rule and broke the button. The rule was right about the
symptom; the fix was backwards; and "silica merges them either way" was a
reading, not a measurement ([[feedback_verify_capability_in_code_not_docs]]).

## Swept

A brace-balanced scan of all 2,289 `.tsx` files in the three consoles, for a
control written self-closing whose `render` element carries its own children:

```
total: 236   by component: { FieldControl: 230, Button: 6 }
```

The 230 `FieldControl` uses are a different contract and render correctly. The
six `Button` uses are all of them, and all six are in Stock:

| file                  | label                      |
| --------------------- | -------------------------- |
| `performance.tsx` ×2  | Spreadsheet (×5 on screen) |
| `stock-grid.tsx` ×2   | Export                     |
| `stock-import.tsx` ×2 | Download what you have     |

The first pass of that scan reported **zero**, because it walked backwards from
`render={` to find the owning tag and landed on the `<a />` written inside the
comment above it. Blanking comments before scanning is what found all six. A
scan that reports zero is a claim, and it wanted checking the same way the code
did ([[feedback_structural_checks_go_blind]]).

## The fix

One component per console, `components/download-button.tsx`, beside
`components/table.tsx` and for the same reason: six call sites got the same
subtle contract wrong six times out of six, so it belongs in one place rather
than in six corrected copies that teach nobody.

```tsx
<Button
  color="neutral"
  variant="outline"
  size="sm"
  render={<a href={href} download aria-label={label} />}
>
  <Icon glyph={faDownload} className="size-4" aria-hidden />
  {label}
</Button>
```

`aria-label` is set from the **same `label`** as the visible text. That satisfies
the linter honestly rather than by silencing it, and because both come from one
value the accessible name and the words on the screen cannot drift apart
(WCAG 2.5.3, Label in Name).

## Proven

Her screen now shows five real **Spreadsheet** buttons, an **Export** button on
the grid and a **Download what you have** button on the import screen. Measured
after: `{ text: "Spreadsheet", w: 140, aria: "Spreadsheet" }` on all five, hrefs
unchanged (`/v1/inventory/imports/template` and the report CSV paths).

Both consoles typecheck; 383 piggles and 295 sparx tests pass; eslint clean
including `jsx-a11y/anchor-has-content` with no disable comment anywhere.
