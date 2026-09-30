# 840 — The search box told her to press a key she does not have

**Status:** fixed
**Severity:** a shortcut nobody could learn, a sentence about rows that were not there, and a highlight no screen reader could follow
**Found by:** P03 · Juniper Row · act 286
**Surface:** The launcher (⌘K), in both consoles
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** driven on `localhost:3022`, read back from the live page, and four new tests proved red first in each console

## The bar at the top of every screen

It says **What do you want to do?** and on the right of it, a little keycap:

```tsx
<Kbd>⌘K</Kbd>
```

`⌘` is the Mac Command key. Devi runs Juniper Row on Windows. That symbol is not
printed on her keyboard, it is not on the key she would need to press, and
nothing anywhere on the screen tells her the key is Ctrl.

The shortcut has always worked for her. The launcher binds
`metaKey || ctrlKey`, so Ctrl-K opens it. **Nothing was broken except the one
sentence that could have taught her it existed** — on a control whose entire
job is to be the fastest route in the product.

Then the launcher opens, and along its foot:

| Shown | Means        | On her keyboard |
| ----- | ------------ | --------------- |
| `↵`   | Enter        | fine            |
| `⇧↵`  | Shift Enter  | readable, just  |
| `⌥↵`  | Option Enter | **no such key** |

`⌥` is Mac Option. A Windows keyboard says Alt.

### The product already knew

Two places had it right the whole time.

The guided tour, in words:

> Ctrl-K opens it from anywhere (⌘K on a Mac) and it is almost always quicker
> than clicking.

And the hint along the foot of every list, which teaches the same three
destinations with the mouse:

> Click to open · Shift-click alongside · **Alt-click** in a new window

So the console taught the mouse route in Windows words and the keyboard route in
Mac symbols, one inch apart, on the same screen.
[[feedback_a_fix_leaves_its_neighbour_behind]]

### The fix

`components/shortcut-keys.tsx`, new in each console, reads which keyboard is in
front of the reader and spells the keys for it:

|              | Mac  | Everywhere else |
| ------------ | ---- | --------------- |
| open the box | `⌘K` | **Ctrl K**      |
| open         | `↵`  | **Enter**       |
| alongside    | `⇧↵` | **Shift Enter** |
| new window   | `⌥↵` | **Alt Enter**   |

It reads through `useSyncExternalStore` with a server snapshot of "not a Mac",
so the server's markup and the browser's markup agree and nothing has to be
suppressed. The snapshot is deliberately the Windows answer: it is what most of
these owners are holding, so the first paint is right for most people and
corrects itself in the same tick for everyone else.

**Measured on the live page after the change:** the bar reads `Ctrl K`, the
launcher's foot reads `Enter`, `Shift Enter`, `Alt Enter`.

## The sentence that described rows that were not there

The launcher searches two things at once: the screens in this console, and the
records in the business. A line along its foot states the record half's own
result — a whole file, `launcher-search-words.ts`, exists because that half used
to say nothing and the screens answered for it.

It ends on a claim about the list:

```ts
`${plural(found, 'record', 'records')} matched. The rest are screens.`;
```

Nothing ever told it how many screens matched.

**SEEN ON SCREEN, Juniper Row.** Typing a customer's name, **Tamsin**, returned
her, two of her invoices, a quote and two of her orders:

```
Tamsin Vale        tamsin@loomandlarder.com
Q-000016           Tamsin Vale
INV-000014         Tamsin Vale
INV-000011         Tamsin Vale
#O-000020          Tamsin Vale · fulfilled
#O-000019          Tamsin Vale · delivered

6 records matched. The rest are screens.
```

Six rows, every one a record. There was no rest.

The other ending is worse. Typing something the shop has never heard of empties
the list altogether, and the box then says two things at once:

```
            Nothing matches that. Try a different word.



Nothing the box can see matches “zzqqxx”. 2 customers and 2 orders are not in
this box yet, so it cannot look at them. Everything below is a screen.
```

**Everything below is a screen**, printed directly above nothing at all.

The count of matching screens is an argument now, and each ending is printed
only when the rows it describes exist. It is the exact failure the file was
written to stop: a sentence that describes the list without having read it.
[[feedback_never_present_absence_as_measurement]]

| Typed    |                   Rows | Before                                       | After                  |
| -------- | ---------------------: | -------------------------------------------- | ---------------------- |
| `Tamsin` |   6 records, 0 screens | 6 records matched. **The rest are screens.** | 6 records matched.     |
| `zzqqxx` |                nothing | … **Everything below is a screen.**          | … (ends after the gap) |
| `inv`    | 24 records, 60 screens | 24 records matched. The rest are screens.    | unchanged              |

The third row is the point: the guard is not satisfied by deleting the sentence.

## The highlight only half the people could follow

Focus never leaves the text field. Arrows move a highlight in a list the field
does not own, and Enter opens whatever the highlight is on — the contract the
panel prints along its own foot.

The row carried `aria-selected="true"`. Nothing was ever told to read it.

```
input   role=null  aria-controls=null  aria-activedescendant=null
listbox id=null
option  id=null    aria-selected=true
```

A screen reader follows focus. Focus was in the field, the field named nothing,
and the rows had no names to be named by. **Walking the list was silent.** The
sighted half of the contract worked and the other half did not exist.

The field is a combobox now: it controls the list, and it names the one row that
is current.

```
input   role=combobox  aria-controls=launcher-results  aria-expanded=true
        aria-autocomplete=list  aria-activedescendant=launcher-row-0
```

**Measured on the live page:** moving the highlight took
`aria-activedescendant` from `launcher-row-0` to `launcher-row-61`, and that id
is the row carrying `data-active="true"`. It is the same failure shape as the
rail's waiting badge in issue 839 — the one thing on the surface that changes
was the one thing nobody was told about. [[feedback_absent_behaves_like_fine]]

## The other console had all three

`sparx/apps/workbench` is this launcher's twin: same file names, same functions,
same sentence, same missing attributes. And four more Mac glyphs of its own —
Home teaches the whole workbench in prose with "Press ⌘K and start typing" and
"Hold ⇧ when opening".

Both consoles are fixed in the same pass. Issue 839, filed this morning, was
about a line piggles fixed two months before sparx because nothing read that
tree; doing it again in the same week would have been a choice.

## Two things that measured like defects and were not

Worth writing down, because the first one nearly went in this file.

**"Clicking a launcher row does nothing."** Clicking a result left
`document.querySelector('[role="dialog"]')` truthy and opened no pane by any
count I could take from the page. **The screenshot showed the Returns pane open,
the dialog gone and the address bar reading `/commerce/returns`.** The dialog
element lingers in the DOM through its exit, so reading the DOM said "still
open" while the screen said otherwise.

**"Ctrl-K does not close the box it opened."** Same reading, same cause. It
toggles.

That is now three surfaces in a row where the DOM or the computed style
described something that was not on the screen. **In this console, read the
pixels.** [[feedback_no_arguing_without_proof]]

## Proved red before it was believed

Four tests added to each console. With the old sentence in place and the new
tests in the file:

```
 × does not promise screens below it when no screen matched
 × does not point at an empty list
 × does not point at an empty list when it cannot see her records either
 Tests  3 failed | 15 passed (18)
```

Exactly three, in both consoles. The fourth — "still names the screens when
there are some" — passes on the old code on purpose, because it is the guard
against fixing this by deleting the sentence.
[[feedback_a_test_that_cannot_go_red]]

Green after: **piggles 138 files / 1299 tests**, **sparx 117 files / 1104
tests**, both typechecks clean, lint clean, all nine copy and structure guards
OK.

## What the box gets right

Measured, not assumed, because most of this surface is good and the report
should say so.

- Typing `inv` puts the **Invoices** screen first, then her real invoices —
  `INV-000018` for Loom and Larder down to `INV-000007` for Tessa Wren.
- Typing `Loom` puts the trade company first, then the task about onboarding
  them, then their paperwork.
- The record half states its own result every time, including what it cannot
  reach: "2 customers and 2 orders are not in this box yet" — with a button on
  that same line to put them back.
- The panel is a fixed height, so it does not jump under the finger when the
  record results land (issue 414).
- Focus lands in the field on open, and the field is empty every time.

## Files

- `piggles/apps/workbench/components/shortcut-keys.tsx` (new)
- `piggles/apps/workbench/components/{launcher,launcher-rows,topbar,empty-workspace}.tsx`
- `piggles/apps/workbench/components/launcher-search-words.ts` + its test
- `sparx/apps/workbench/components/shortcut-keys.tsx` (new)
- `sparx/apps/workbench/components/{launcher,launcher-rows,toolbar,empty-workspace}.tsx`
- `sparx/apps/workbench/components/launcher-search-words.ts` + its test
- `sparx/apps/workbench/surfaces/home.tsx`

## Measured, not swept

`sparx/apps/web/components/docs/sidebar.tsx` draws a **Search docs** field with
a `⌘K` keycap on it, and its own comment says the field "focuses nothing yet".
That is not a wrong key; it is a control that does nothing wearing a shortcut
that does nothing. Building docs search is a capability, so it is recorded here
rather than swept.

Two more mentions on the marketing site name the feature rather than instruct
anybody to press it (a capability list entry and a drawn picture of the
console), and are left alone.

## The thing to remember

**A caption about a key is a claim about the reader's hands.** Three parts of
this console taught the same three destinations, and the two written as words
were right while the two written as symbols were written for somebody else's
machine. The symbols looked more precise, which is why nobody read them twice.
