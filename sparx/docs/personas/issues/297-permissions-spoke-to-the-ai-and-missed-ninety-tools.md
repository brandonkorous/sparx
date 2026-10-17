# 297 — Permissions spoke to the AI, and about ninety tools could not be switched off

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › AI › Permissions; api-rest tool catalog; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Every row on Permissions showed the description written for the AI ("Use this when the user asks to…") instead of a name an owner would say. Counting the rows against what the AI server publishes, about ninety tools were missing: media, content, social, wholesale and campaign tools, and the nine tools api-mcp defines itself. An AI app could call those, and the owner had no switch for them.

## What should have happened

Each tool has a short name in the owner’s words, and every tool the server publishes has a row and a switch.

## How to reproduce

1. Open AI › Permissions.
2. Read a row, then compare the list with the tools api-mcp registers.

## Why it matters

This is the one screen that limits what an outside app may do in the business. A tool that is not listed cannot be blocked, and a row nobody can read cannot be judged.

## Where it lives

`wizeworks/services/api-rest/src/lib/ai/tool-catalog.ts` (the list), `tool-policy.ts` (the answer the screen reads), and `surfaces/ai/tool-policies.tsx` and `overview.tsx` in each console.

## The fix

- `lib/ai/tool-titles.ts`: `TOOL_TITLES`, a short owner-word title for each of the 634 tools, and `toolTitle(name)`.
- `tool-catalog.ts` now takes the media, cms, social, b2b and funnels tool arrays, plus `LOCAL_TOOLS`, a mirror of the nine tools api-mcp defines itself. `moduleForScope` knows b2b, cms, social and funnels.
- The policy answer carries `title`. Permissions and the AI overview show it.
- `services/api-mcp/src/tool-catalog-parity.test.ts` compares the published names and scopes with the catalog, both ways.

Tests: `tool-titles.test.ts` (6 checks) and the parity test (3). Removing one tool from the catalog turns the parity test red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Permissions lists 12 groups with 634 tools in all, and every row has a plain title ("Start a new campaign", "Delete a campaign and its results", "See one campaign and its steps"). No row shows a code name.

Not checked: Piggles on screen (same API answer; tests only).

## Rating effect

See the pane's row in `rating.md`.
