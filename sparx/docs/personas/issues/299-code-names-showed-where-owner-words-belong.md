# 299 — Code names showed where owner words belong

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Content › Types and filing; Invoicing › Workflows; AI › Instructions; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Several screens printed the machine name of a thing next to, or instead of, its name: the content type list and editor ("slug"), the filing list, the workflow list (a code line under each name), and the new-instruction form, whose permanent name field was labeled "Id". A taken name answered "A prompt with key … already exists", in words the screen never uses.

## What should have happened

One word for the permanent name everywhere: "Reference name", as the workflow editor already said. Lists show the name, not the code.

## How to reproduce

1. Open Content › Types, Invoicing › Workflows, and AI › Instructions › Write one from scratch.

## Why it matters

An owner reads "slug" and "Id" as something broken or not meant for them, and the same idea had three names.

## Where it lives

`surfaces/cms/reference-word.ts` (copied to sparx from Piggles), the content type and filing panes, `surfaces/invoicing/workflows-list.tsx`, `surfaces/ai/prompt-editor.tsx`, and `api-rest/src/lib/ai/prompt-templates.ts`.

## The fix

- sparx gets Piggles’ `reference-word.ts`. The content type list, the filing list and the type editor say "Reference".
- The workflow list drops the code line in both consoles.
- The instruction editor labels the field "Reference name" in both consoles, with its two errors and its read-only note to match.
- The API’s taken-name answer reads "An instruction with the reference name "…" already exists. Give this one a different name."

No test: words on the page.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The workflow list shows "Invoice", "Service" and "Invoices on account" with their stages and no code line. AI › Instructions › Write one from scratch shows "Reference name" with "A short, permanent name used behind the scenes."

Not checked: the taken-name message on screen (Doty has no instructions to collide with).

## Rating effect

See the pane's row in `rating.md`.
