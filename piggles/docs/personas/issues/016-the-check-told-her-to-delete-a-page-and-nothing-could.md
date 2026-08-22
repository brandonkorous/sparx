# 016 — The check told her to delete a page, and nothing in the console could

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7
**Surface:** mypiggles › My Site › Page
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** deleted "Home — Landing" from the page list as Marisol — the dialog named the page and named the survivor, the row went, and the database agrees (five pages, not six)
**Blocked on:** —

## What happened

Marisol runs **Publish → Check my site** and it tells her, in her own words, that two
of her pages both claim `/`:

> **2 pages are all set to be your home page.** Home — Landing, Home all answer to
> `/`. Only one of them can — visitors will get whichever the site happens to reach
> first, and the others cannot be opened at all. **Give the ones you did not mean a
> web address of their own in page settings, or delete them.**

She goes to delete one. There is nowhere to do it:

| Where she looked                   | What was there                                      |
| ---------------------------------- | --------------------------------------------------- |
| The page row in **My Site → Page** | One button — "Open alongside"                       |
| Right-click on the row             | Nothing                                             |
| The page editor's **⋮** menu       | Preview · History · Publish · Save as piece         |
| **Page** settings in the Inspector | Name · Address · Header and footer · Search wording |

The product printed a remedy it had not built. Half the sentence — "give them an
address" — works. The other half was a dead end, and it is the half somebody reaches
for when the page is one they never asked for.

## What should have happened

A page can be deleted, from the list, with a confirm that says what it costs.

Both siblings of this surface already have exactly that: **saved pieces** have a
delete button on the row, and so do **emails**. Pages — the thing a site is made of —
were the one document type you could create and never remove.

## How to reproduce

Before the fix, every time:

1. **My Site → Page.**
2. Try to remove any page. There is no affordance anywhere on the surface.
3. `DELETE /v1/builder/pages/:id` answers perfectly well from a terminal — the
   endpoint has been there the whole time, with an audit-log write and everything.

## Why it matters

Root CLAUDE.md's one-outcome-two-causes rule says it directly: **advice in a message
is part of the contract — check the remedy you print is available.** This is that
failure in its purest form, because the check is otherwise the best screen in the
product. It found a real problem, explained it in plain words, and then sent her to a
button that does not exist.

The specific trap: a page with no address is INVISIBLE on the live site (something
else wins `/`), so the only place it exists is this list. A page you cannot see and
cannot delete is one you cannot reason about at all.

## Where it lives

`piggles/apps/workbench/surfaces/studio/pages-list.tsx` — the row rendered a name, a
status badge and "Open alongside", and `lib/studio/page-data.ts` had create, read,
save and publish, but no delete. Nothing was broken; the call was simply never
written. The API, the audit log and the confirm-dialog pattern were all already in
place.

## The fix

`useDeletePage()` in `lib/studio/page-data.ts`, and a delete button on the row in
`pages-list.tsx` — following `pieces-list.tsx` line for line, because a second
pattern for "delete a document from a list" is how the two drift.

The page's cached copy is **removed** rather than invalidated: a pane still open on
that page has to fall to its "isn't here any more" state, and invalidating would
refetch a 404 and get there more slowly, holding the deleted draft on screen in the
meantime.

The confirm carries whichever of three facts apply, worked out at the moment of
asking rather than held from the list:

- **Who else claims this address.** Naming the survivor is the entire decision when
  the check has just sent her here — "Home is also set to be your home page, and will
  have it to itself."
- **Whether it is live.** The published body lives on the same row, so deleting a
  live page stops its address answering immediately, with no republish in between.
  That is worth saying out loud.
- **Whether it is a record template.** Deleting one takes the page every one of those
  records is shown through.

Then always: "There is no undo — the page and everything on it go for good." Which is
true; `remove()` hard-deletes the row.

## Confirmed by

> Opened **My Site → Page** as Marisol. Six pages, each now with a delete beside
> "Open alongside". Pressed it on **Home — Landing**:
>
> > **Delete "Home — Landing"?**
> > Home is also set to be your home page, and will have it to itself. It has never
> > been live, so nobody outside your business has seen it. There is no undo — the
> > page and everything on it go for good.
> > **[Keep it] [Delete page]**
>
> Pressed **Keep it** first — the page stayed. Pressed **Delete page** — toast
> "'Home — Landing' deleted", the row went, five pages left, and `select name, slug
from builder_pages` agrees.
>
> The first attempt exposed a second, worse defect: the page came back. That is
> [017](017-the-deleted-home-page-came-back-21-milliseconds-later.md), and this delete
> is only trustworthy because that one is fixed too.

## Rating effect

mypiggles › My Site › Page — Ease 5 → 8. The list is clear, the add-a-page field is
one line, and a page can now be removed by the person who owns it. Held short of 10
because the whole editor collapses at the pane's default width (see the note in P01's
run log).
