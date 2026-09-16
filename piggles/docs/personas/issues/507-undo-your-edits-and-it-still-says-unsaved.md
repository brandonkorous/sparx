# 507 — Undo every edit and it still says you have unsaved changes

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, putting a counting schedule back the way she found it
**Surface:** six panes across both consoles
**Filed:** 2026-09-14

## What she saw

She opened her counting schedule, tried narrowing it to a zone, saw it covered
nothing, and put both controls back exactly as they had been. Every field on
screen now matched the saved record.

The status bar still read **"Not saved: a panel"**, and closing the pane would
still have asked her to confirm discarding changes she had already undone.

## Why

The flag was a sticky boolean. `patch()` set it on any edit and only a save or a
re-seed from the server cleared it. Nothing compared the draft back to what was
loaded, so "dirty" meant "somebody touched something", not "this differs from
what is stored".

## The scope note in the first version of this issue was wrong

It said this was the house pattern across roughly 120 panes and needed a
considered replacement with asymmetric risk. Measured, the opposite is true:

```
panes calling useDirtySource : 122
  already compare a draft    :  72   e.g. serializeDraft(draft) !== initialRef.current
  sticky boolean             :   6
  other shapes               :  44   a mutation's isSuccess, a validity test, …
```

**The house already does it right.** Six panes were the stragglers, and the fix
was not a new mechanism but bringing them back to the one already in use next
door. Writing "this is the house pattern" without counting turned an hour of
work into a decision nobody needed to make.

Of ten files that declare `const [dirty, setDirty]`, only six feed
`useDirtySource`; the others gate a button or guard a re-seed and were never
part of this.

## What changed

| pane                       | how dirty is decided now                                   |
| -------------------------- | ---------------------------------------------------------- |
| counting schedule          | `JSON.stringify(draft) !== initialRef.current`             |
| spending limit             | same, and Save goes quiet again when the form is put back  |
| enter a supplier's invoice | field by field, against what the order filled in           |
| supplier return            | field by field, against a blank form plus the one location |
| invoice editor             | draft + chosen workflow, against what was loaded           |
| workflow editor            | `adopt()` is the single seam, so the baseline is set there |
| email editor (sparx)       | compared inside silica's `onChange`, where the ref changes |

Two things that were already reading `dirty` improve for free in the invoice
editor: **Save** goes back to grey and **Send again** comes back when the edit
is undone.

## One thing that turned out not to need fixing

Three of these panes cleared the flag before closing themselves. That was never
load-bearing, and the controller says so in its own words:

> Closes unconditionally. Surfaces closing THEMSELVES (a deleted draft's editor)
> come through here — prompting "unsaved changes?" about a document that no
> longer exists would be nonsense.

`close()` deletes the guards before closing; only `requestClose()` holds the
conversation. So the delete and archive paths drop their line rather than gain a
new one, and a comment claiming otherwise was removed rather than shipped.

## Proven

Counting schedule, on screen:

|                                     | status bar             |
| ----------------------------------- | ---------------------- |
| loaded                              | clean                  |
| typed "Mezzanine" into the zone box | **Not saved: a panel** |
| cleared it again                    | clean                  |

Invoice editor INV-000010, on screen:

|                                        | Save    | Send again |
| -------------------------------------- | ------- | ---------- |
| loaded                                 | grey    | enabled    |
| typed two characters into Billing name | **lit** | greyed     |
| backspaced them                        | grey    | enabled    |
