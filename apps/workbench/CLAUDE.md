# apps/workbench

Read [docs/123-workbench.md](../../docs/123-workbench.md) before building a surface here.

## Build it, don't port it

For any work in the workbench that is coming from the dashboard app, you must not
COPY the code from the dashboard app. You must instead build the code from scratch
in the workbench app. This is to ensure that the workbench app is self-contained
and does not have dependencies on the dashboard app, and that we are thinking
outside the box and not just copying code from the dashboard app. The dashboard app is a legacy app and we want to ensure that the workbench app is built with modern best practices and is not constrained by the limitations of the dashboard app.

## Pane or modal?

**A pane is the default. A modal has to earn it.** Full rule + the worked examples
in [docs/123-workbench.md](../../docs/123-workbench.md) §"Pane or modal?" — read it
before you pick.

The reason is structural: `hasUnsavedWork()`, `usePaneDirty` and the per-site
persisted layout are the app's unsaved-work safety net, and **a modal is invisible
to all of it**. Modal state evaporates on reload, site switch and tear-off, and can
never show a dirty dot because it has no tab. A modal is the one place here where
work can be silently lost.

A modal must clear all four: nothing to lose if abandoned · no durable thing you
would return to · nothing else needed on screen · seconds, not minutes.

**A fifth test applies to BOTH shapes: it must not break their context.** This is
the only test that can rule a _pane_ out, so a pane is not automatically the safe
choice — `controller.open(…)` defaults to `target: 'tab'`, which opens in the
focused group and hides what the operator was looking at, and on compact there is
no `beside` at all. For a cross-cutting action invoked from the chrome, that is a
worse interruption than a dialog. Corollary: **capture context instead of keeping
it on screen** — the feedback composer attaches the pane, module, record and site
automatically, which is what lets it be a dialog without costing anyone the view
of what they were describing.

**Creating something is a PANE whenever create has the same shape as edit** — a new
site renders the same surface as managing one (`{id:'new'}` → `{id}`), so a create
modal would mean writing that form twice forever. Invite-a-teammate is a modal:
two fields, no invitation surface, nothing to return to.

Exemption: a modal may hold real work when its result commits to **the pane's own
draft** rather than the server (`line-editor-modal.tsx`) — the pane stays dirty on
its behalf. Confirms (`useImperativeAlertDialog`) are outside this: a decision, not
a form.
