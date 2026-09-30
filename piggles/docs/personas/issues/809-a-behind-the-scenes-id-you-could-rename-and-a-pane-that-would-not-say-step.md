# 809 — A behind-the-scenes id you could rename, and a pane that would not say "step"

**Status:** fixed
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.pipelines.list`, `crm.pipeline.detail`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi; `check:toolbar-names` green at 81/81
**Blocked on:** —

## 1. An id you could rename, that the platform matches on

The detail pane offered a free text box:

> **Short id** — `sales`
> A short, lowercase id used behind the scenes.

Nothing stopped Devi editing it. And `bootstrapDefaultPipeline` finds the
starter sales process by exactly that string:

```ts
const existing = await tx.pipeline.findFirst({
  where: { propertyId: null, objectKey: 'deal', slug: DEFAULT_PIPELINE_TEMPLATE.slug },
});
if (existing) return existing;
// …otherwise create six fresh stages
```

Change the slug and that lookup misses. The next CRM module activation, or the
next `POST /v1/crm/bootstrap`, creates a **second** sales process with six fresh
steps, marked default, while every existing deal stays on the first. Two boards,
one of them empty, and nothing on screen explaining it.

This is [[feedback_copy_edit_breaks_identity_lookups]] with the twist that the
edit is one the form invites. "Used behind the scenes" is a hint, not a warning.

**Fixed:** the field is set on create and disabled afterwards. Nothing needs to
rename it — it is an id, no customer ever sees it, and the Name above it is the
thing people read. The note now says so: _"It cannot change once things are
using it."_

The lead path is unaffected either way: `resolveEntryPipeline` finds a pipeline
by `objectKey`, not by slug, and only falls through to the bootstrap when none
exists.

## 2. "Stages" under a description that says "steps"

```
Stages
The steps a deal moves through, top to bottom.
```

Heading and description, one line apart, two words for one thing. The deals
board in **both** consoles already says "Nothing at this **step** yet", so
"stage" was the outlier in both. It is "Steps", "Add a step", "Step name" now.

The description was wrong in a second way: this pane is the only place a
**support queue's** steps can be renamed, and a help request does not "move
through a deal". It reads _"The steps something moves through here"_.

## 3. A Piggles pane that said "pipeline" in every place but its own tab

The tab said **How a deal moves**. Inside it:

|            | said                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| search box | "Search pipelines…"                                                         |
| filter     | "Active pipelines" / "Including archived"                                   |
| button     | "New pipeline"                                                              |
| error      | "Could not load your pipelines"                                             |
| no results | "No pipelines match that"                                                   |
| first run  | "No pipelines yet" · "A pipeline is the set of stages a deal moves through" |
| column     | "Stages"                                                                    |
| badge      | "Support requests"                                                          |

The same defect issues 798 and 802 fixed one layer up: the tab was renamed and
the body was not. Sparx is internally consistent here and was left alone.

The tab was also wrong on its own terms. This pane lists **support queues as
well as sales processes** — the file says so in its own comment — so "How a deal
moves" undersold half its rows. It is **How things move** now, and the toolbar
follows (`check:toolbar-names` green).

The body uses **process**, which is the word the file's own code comment was
already using (`WHAT this process moves`), and is plain English rather than
plumbing. The badge says **Help requests**, which is what this console calls a
ticket everywhere else.

New first-run copy:

> A process is the set of steps something moves through: a sale going from a
> first inquiry to won, or a help request from asked to answered. Create your
> first one to start following them.

## 4. A percentage whose % showed only while the box was empty

The **Chance** column carried 10 / 25 / 50 / 75 / 100 with no unit anywhere on
the row. The `%` was the input PLACEHOLDER, so it appeared only while the box
was empty and vanished the instant a figure went in — the unit was visible in
exactly the state where there was no number to attach it to.

It is a sibling span now, which is the house pattern (the Discount field on a
company detail, and several more), so it shows at rest. Both consoles.

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/pipeline-detail.tsx`
- `piggles/apps/workbench/surfaces/crm/pipelines-list.tsx`
- `piggles/apps/workbench/lib/console/vocabulary.ts`
