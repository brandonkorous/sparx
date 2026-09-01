# 356 — She came back to her page and two panes spun forever

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · reloading the console with a History pane open
**Surface:** mypiggles › My Site › History, and My Site › Preview
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her own About page, reloaded, recovered in one click

## What happened

Devi opened her About page, pressed the clock in its toolbar, and read the page's
history beside it. Ordinary. Then she reloaded the console — a browser refresh,
which every person does without thinking about it.

The arrangement came back. The History pane came back with it, focused. And it
showed the Piggles mascot **spinning**, with a line underneath:

> Open the page, header, piece or email first…

It span for as long as the tab was open. Nothing was loading. Nothing ever would
be. There was no button, no link, and no error — the only way out was to hunt
through 130-odd tabs for the page's own tab, click it, and come back.

The Preview pane does exactly the same thing, from identical code. Preview is the
one people are most likely to leave open, because "see it as a visitor would"
next to the canvas is the whole point of it. So the common shape of this is: she
refreshes, and the pane she uses to check her work is a spinning pig.

## What should have happened

Two things, and the console already says both of them out loud.

**A spinner means something is coming.** [pane-load-error.tsx](../../../apps/workbench/components/pane-load-error.tsx)
opens by naming the three states a pane can be in and the one shape each gets:

> waiting → `<PaneWaiting>` · nothing there → `<ListEmptyState>` · could not load → this

This was the middle case wearing the first one's clothes. Worse than looking
wrong: `<PaneWaiting>` carries `role="status"`, so a screen reader was also told
work was in progress on a pane that had stopped.

**And the way out belongs on the screen.** [pane-empty.tsx](../../../apps/workbench/components/pane-empty.tsx)
exists for this exact case, lists it by name — _"a detail pane opened without a
record"_ — and its `actions` prop is documented as _"the way out — usually the
thing that would fill this pane."_ The address already named her page. Telling
her to go and open something, while holding its id, is describing the fix instead
of doing it.

## How to reproduce

Every time.

1. Sign in as Devi and open **My Site › Pages › About**.
2. Press the **clock** in the page's toolbar. History opens beside it and works.
3. Reload the browser.
4. History comes back focused, and shows the mascot spinning under "Open the
   page, header, piece or email first…". It never resolves.

Same steps with the **eye** (Preview) instead of the clock.

## Why it matters

It reads as broken software. A spinner that never finishes is the single clearest
way to tell somebody their tool has hung, and this one said it after nothing more
unusual than pressing refresh — on the pane she uses to check her own work before
publishing it.

And it is quietly self-inflicted: both panes are opened `beside` their document
and both are kept in the saved arrangement, so a reload restores them **before**
anything has opened the document they point at. The state was not an edge case.
It was the normal outcome of refreshing the page.

## Where it lives

- [history-pane.tsx](../../../apps/workbench/surfaces/studio/history-pane.tsx) — three branches
- [preview-pane.tsx](../../../apps/workbench/surfaces/studio/preview-pane.tsx) — the same three, duplicated
- [document-pane.tsx](../../../apps/workbench/surfaces/studio/document-pane.tsx) — new; where they live now

## The fix

Neither pane loads its own document, and that stays true — it is a good decision,
written down in both files: a pane with its own loader ends up describing a
version nobody is editing. The fix is about what the pane SAYS when the document
is named but not open, not about how it gets it.

`refFrom` and the `KINDS` set were identical in both files, and so were all three
of these states, so they moved into one `document-pane.tsx`:

| Branch                       | Was                                    | Now                                           |
| ---------------------------- | -------------------------------------- | --------------------------------------------- |
| No document named at all     | a bare `<p>` centred in a bare `<div>` | `<PaneEmpty>`, the console's own shape        |
| The site is still resolving  | `<PaneWaiting>` with an INSTRUCTION    | `<PaneWaiting label="Finding your website…">` |
| Named, but nothing opened it | `<PaneWaiting>` forever                | `<PaneEmpty>` with a button that opens it     |

The button is what closes the loop. `WorkbenchController.open` re-focuses a pane
already open on the same surface and params rather than making a second one, so
after a reload **"Open the page" brings the restored canvas forward** — which is
what puts the document in the session, which is what fills the History pane in.
One click, through the ordinary path, so the one-loader rule is untouched.

Each kind gets two phrases rather than one noun, because they sit in different
sentences: "Your header and footer **are** not open" needs a plural verb that
"This page **is** not open" must not have. The five kinds map to the panes that
open them (`builder.page`/`pageId`, `builder.layout`, `builder.theme`/`themeId`,
`builder.piece`/`pieceId`, `builder.email`/`emailId`).

The middle row matters on its own: "Open the page… first" was being shown while
the site was still being found, which is a real wait, and the instruction was
useless advice — she could not open anything yet either. It now says what is
actually happening, in the wording the rest of the console already uses.

## Confirmed by

> Reloaded the console on her About page's History address. The pane came back as
> a Piggles empty state: **"This page is not open"**, the reason underneath, and
> **Open the page**. One click focused the About canvas that was already restored,
> and the pane filled with her four saves and four releases. Its tab retitled
> itself from "History" to "History — About" as the document arrived.

## Rating effect

`builder.history` and `builder.preview` — both previously unrated. Recorded in
[rating.md](../rating.md).
