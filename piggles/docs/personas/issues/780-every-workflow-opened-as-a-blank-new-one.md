# 780 — Every saved workflow opened as a blank new one

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 276
**Surface:** mypiggles + sparx workbench — `invoicing.workflow.edit`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

First click into **What happens when**, on the row named **Invoice** — the
default workflow, the one every bill Juniper Row has ever sent runs on:

```
Untitled workflow
no reference name yet

Name             (empty, placeholder "Service / Repair")
Reference name   (empty, placeholder "service-repair")
1  Invoice   sent, still yours to change   Documents start here

status bar:      Not saved: Workflow
```

The row said three stages. The editor showed one. The name fields were empty.
The pane was marked unsaved before anything had been touched.

Every one of her five workflows did this. The editor could not be used at all.

## Why

```ts
const [draft, setDraft] = useState<WorkflowDraft>(emptyWorkflowDraft); // call 1
const baselineRef = useRef<string>(JSON.stringify(emptyWorkflowDraft())); // call 2
const dirty = JSON.stringify(draft) !== baselineRef.current;
```

Two calls to the same function, and each stage draft carries a `key` minted by
`newStageKey()` — `stage-${crypto.randomUUID()}`, fresh every time. So the two
strings could never be equal and `dirty` was true on the very first render.

The effect that adopts the saved workflow is GUARDED on dirty, which is correct
and is the whole reason this mattered:

```ts
useEffect(() => {
  if (!workflow || dirty) return; // always returned
  adopt(workflow);
}, [workflow]);
```

The server answered 200 with the full workflow every time. Nothing ever read it.

Three further things follow from `adopt` never running, and all three were on
screen:

- `setOriginal` never fired, so the toolbar's **Archive** action — rendered only
  `original ? … : undefined` — was missing from every saved workflow;
- `ctx.setTitle` never fired, so the tab read "Workflow" rather than the name;
- `useDirtySource` was armed, so closing the pane asked to discard changes
  nobody had made.

## When

`851aa54d6` (2026-09-16) — the fix for issue 507, which replaced a sticky
`useState(false)` dirty flag with a comparison against a baseline. That fix was
right. It just built the baseline a second time instead of from the same object,
and nothing in the repository can tell those apart.
[[feedback_a_fix_leaves_its_neighbour_behind]]

Six days, both consoles, and no check could have caught it: it typechecks, it
lints, and there was no test over the comparison.

## The same defect, two hours earlier

This is the third of the four defects in issue 778 — "the dirty baseline was
built two different ways so the pane started dirty and therefore never adopted".
That one was in `template-editor.tsx`. This one is in `workflow-editor.tsx`, in
the same folder, and the template editor was written by copying this file's
shape. The bug was copied with it, and then found in the copy first.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

`comparableWorkflow(draft)` in `workflow-data.ts` — the draft reduced to what
the SERVER stores, which is what "unsaved changes" has to mean. It drops `key`,
exactly as `comparableDraft` does for print templates. Both the baseline and
every comparison go through it.

## Proof

Five assertions in `workflow-data.test.ts`, per console. The two that matter are
the ones a raw `JSON.stringify` cannot pass:

```
comparableWorkflow(emptyWorkflowDraft()) === comparableWorkflow(emptyWorkflowDraft())
comparableWorkflow(toWorkflowDraft(SERVER)) === comparableWorkflow(toWorkflowDraft(SERVER))
```

Putting `key` back into the comparison reddens exactly those two.
[[feedback_a_test_that_cannot_go_red]]

The other three hold the line in the opposite direction: a renamed stage, a
removed stage, a reorder, a renamed workflow and a changed default flag all
still register as changes.

On screen: Service / Repair now opens with its name, its reference name, all six
stages and the Archive action; Save is correctly disabled until something
changes.

## Files

- `piggles|sparx/apps/workbench/surfaces/invoicing/workflow-data.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/workflow-editor.tsx`
