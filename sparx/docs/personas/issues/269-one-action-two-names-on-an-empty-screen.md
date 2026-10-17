# 269 — An empty screen named one action twice: "New template" and "Write your first template"

**Status:** fixed (sparx); four Piggles screens listed as debt
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Customers › Email templates
**Surface:** six empty screens in each console: email templates, AI instructions, API keys, a custom record type, feedback, the team roster
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Customers › Email templates, with none yet. The bar said "New template". Under the
words, a second button said "Write your first template". Both open the same form.

## What should have happened

One action, one name. Issue 743 set that rule for a list's button and its `+`. The
empty screen's button is the same action.

## How to reproduce

1. Sign in as Doty. Open Customers › Email templates while there are none.

## Why it matters

Two buttons with two names look like two different things. The owner stops to work
out which one she wants.

## Where it lives

The guard for 743 (`lib/surfaces/create-label-agrees.test.ts`) passes when ANY button
in a list's files says the right words, so a second button with other words is never
seen. It also skips lists that create in a dialog, as templates do.

Sites: sparx `ai/prompts-list.tsx`, `ai-connections/ai-connections.tsx`,
`crm/records-list.tsx`, `crm/templates-list.tsx`, `feedback/feedback-list.tsx`,
`staff/people.tsx`; Piggles has the same six (records in `records-list-states.tsx`).

## The fix

- Each empty-screen button now uses its bar button's words: New instruction, Create
  key, Add <record>, New template, Send feedback, Add someone.
- `lib/surfaces/create-words-say-it-once.test.ts` (new, both consoles) reads every
  `<Button>` in the surfaces with the TypeScript parser and fails on "your first" or
  "the first". It was red at 6 sites in each console, then green.
- Piggles: `records-list-states.tsx` and `feedback-list.tsx` are fixed. The other four
  (`prompts-list`, `ai-connections`, `templates-list`, `people`) are over the 250-line
  rule and are listed as `PIGGLES_DEBT` in the test; an entry that no longer offends
  fails.

## Confirmed by

sparx as Doty, Customers › Email templates (empty): both buttons say "New template".

## Rating effect

crm.templates.list and five more empty screens: one action, one name.
