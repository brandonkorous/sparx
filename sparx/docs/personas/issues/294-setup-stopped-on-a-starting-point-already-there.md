# 294 — Setup stopped on a starting point the business already had

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming [019] and [021] (setup for a business not yet launched)
**Surface:** workbench › first-run setup › "Pick a starting point" (and the sentence setup, which installs through the same call); sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Mike Vanderberg (his own workspace), 2026-10-17, in part
**Blocked on:** —

## What happened

Mike's own workspace (made when he joined Gillett) had never been set up. In setup,
"Pick a starting point" had "Universal Starter" chosen, with "Bring its examples" on.
Pressing "Use this starting point" left him on the same step under:

> This template is already installed (status: installed). Update it to the latest
> version, or delete it to remove it.

There was no way on. The starter had been put in his workspace on 2026-10-09, before he
ever opened setup, so setup's own record of what it installed was empty, and it asked
the server to install it again.

Reading the code for it found two more faults in the same call:

- **Switching designs kept both.** Setup removed the old design by posting to
  `/v1/blueprints/installs/:id/reset`. That route was renamed to
  `DELETE /v1/blueprints/installs/:id` (commit `cfc6f6c6e`, "reset → delete"); setup
  kept the old address and swallowed the error (`.catch(() => undefined)`). So picking
  one design, going back and picking another left the first design's pages and
  products in the business beside the second's. "Start from scratch" had the same call.
- **Changing only "Bring its examples"** has to replace the install (the answer is
  fixed when it goes in), and hit the same refusal once the old one stayed.

Counted in the dev database: 102 businesses hold an install that setup's record does
not name. Every home workspace of an invited team member is one (Mike's, Kendra's and
Alyssa's are three).

## What should have happened

Choosing a design that is already there, with the same answer, carries on to the next
step. Choosing another removes the one setup put in, then installs the new one. A
removal that fails stops the step and says so.

## How to reproduce

1. Sign in as someone whose business holds a starter design setup did not install
   (any invited team member's own workspace).
2. Open setup › step by step › Continue › "Use this starting point".

## Why it matters

Setup is the first thing a new owner does, and the goal is a live site in under five
minutes (docs/15). A dead end on step two, worded for a developer ("delete it to
remove it"), ends that. Switching designs left a business with two sites' worth of
pages and sample products and nothing saying where they came from.

## Where it lives

`lib/onboarding/steps-setup.ts` (both consoles): `selectTemplate` decided from
`GET /v1/tenant/onboarding` alone, and both it and `startFromScratch` removed through
the dead `/reset` route.

## The fix

Both consoles:

- `lib/onboarding/template-plan.ts` (new): `planTemplateInstall(state, installs, choice)`
  decides from setup's record AND the business's installs
  (`GET /v1/blueprints/installs`). Same design, in place, same answer: keep it. Setup's
  own install, or any row for the same design (the server refuses a second one while
  any remains, failed included): remove it, then install. Another design setup did not
  make is left alone.
- `lib/onboarding/steps-setup.ts`: `selectTemplate` follows the plan; removal goes
  through `removeInstall`, which calls the real `DELETE /v1/blueprints/installs/:id`,
  treats "already gone" (404) as done, and lets any other failure stop the step.
  `startFromScratch` uses it too.

Tests: `lib/onboarding/template-plan.test.ts`, 7 per console. Making the plan read
setup's record only (the old rule) reddens 3: keeping an install setup never made,
replacing it on a changed answer, and removing a failed one. Prettier clean. ESLint
and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Mike Vanderberg, in his own workspace, 2026-10-17: setup › step by step ›
Continue › "Use this starting point" (Universal Starter, examples on) now goes on to
"Name your workspace". One install row is left, the one from 2026-10-09, and setup's
record named it (`installId` efa67287-…). The domain step after it read as [019] and
[021] say.

Not checked on screen: switching designs and changing only the examples answer (both
would remove Mike's starter); the tests above cover them. Piggles: tests only.

Left behind by the check: pressing Continue on Modules switched on the five modules
the story had picked (Builder, Commerce, CMS, CRM, Scheduling) in Mike's workspace, and
with them the starter's shop and customer parts (6 sample products, a warehouse, a tax
zone, a pipeline, 6 segments, 2 invoice workflows). They were left as the app made
them. Mike's setup record was put back to where it started (step "modules", nothing
done, no design named).

## Rating effect

—
