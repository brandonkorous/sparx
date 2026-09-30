# 811 — One action with two names, a bare empty state, and a word this console does not use

**Status:** fixed
**Severity:** copy + layout
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.sla-policies`, `crm.snippets.list`, `crm.scoring`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** —

## 1. Response times had no pane at all

Opening **Response times** for the first time gave a bare heading and a
paragraph, flush against the top-left corner. No card, no icon, no artwork, no
centering, no toolbar. Every other first-run state in this console is a
centered `PaneEmpty` inside a `Card` with this app's own picture on it, and
this branch simply did not use any of it:

```tsx
if (!policy) {
  return (
    <div className={PANE_SHELL}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Heading level={1} …>No response times set up yet</Heading>
          <Text>…</Text>
```

[[feedback_copy_the_house_layout_before_building]] — two shipped screens were
one click away, and both answer this exact shape.

It also promised the wrong thing in the wrong words: _"One is created for you
the first time a **support request** comes in."_ This console calls those
**help requests** everywhere else, which made this a third name for one thing.
(The pipelines list was calling them "Support requests" too; issue 809.)

The promise itself is true — `ticket-service.ts:337` calls `ensureDefaultPolicy`
on the first ticket — so only the noun needed changing.

sparx got the same shape, in its own idiom: its `PaneEmpty` takes no `module`
and it draws lucide icons, so it uses `<Clock />` and no brand artwork.

## 2. Saved paragraphs asked for the same thing twice, under two names

The toolbar button said **New paragraph**. The invitation eight lines below it
said **Save your first paragraph**. Both called `startNew`. One action, two
names, and which one a person read depended on which one they pressed — the
defect issue 729 exists to stop, and which the configurator list already solves
by making the label ONE object used in both places.

Both now read **Save a paragraph**, from a single `CREATE_LABEL`.

Its description also ran two clauses together with nothing between them:

> Save a paragraph once (your hours, your returns policy, your usual lead time)
> give it a short name like hours, and…

Now:

> Save a paragraph once: your hours, your returns policy, your usual lead time.
> Give it a short name like hours, and…

## 3. The score was called a "lead score"

**Who is worth chasing** is one of the best-written panes in the console.
Every sentence on it is plain: _"Every rule that fits adds its points up"_,
_"Nothing scores yet, so everybody sits at zero"_, _"Without it a score is a
lifetime total, so somebody who was keen a year ago outranks somebody who
replied this morning."_

And the box at the top of it was pre-filled **Lead score** — the one piece of
sales vocabulary on the whole screen, on a pane for a person who makes clothes.
Its sibling default was **Deal health**, so the pair also used two different
words for one idea.

Both now use the word the pane itself uses in every other sentence:
**Customer score** and **Deal score**. Piggles only; sparx keeps "lead", which
is a term of art for its readers.

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/sla-policies.tsx`
- `piggles|sparx/apps/workbench/surfaces/crm/snippets-list.tsx`
- `piggles/apps/workbench/surfaces/crm/scoring.tsx`
