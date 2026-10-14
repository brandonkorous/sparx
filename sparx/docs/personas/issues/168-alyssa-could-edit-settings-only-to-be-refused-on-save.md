# 168 — Alyssa could edit settings, only to be refused on Save

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (team: Alyssa, accounts receivable)
**Surface:** workbench › Business details, Your sparx bill, the trial banner, and the other settings only an owner or an admin may change; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx, as Alyssa and as Doty)
**Blocked on:** —

## What happened

Alyssa Thompson does accounts receivable at Gillett and is an Editor. She signed in.

- Modules was right: "You can see what is on, but not change it. Only an owner or an
  admin can turn modules on or off." Every switch was locked.
- Business details opened as an open form with a Save button. She typed "Suite B" in
  Street line 2 and pressed Save. The toast said: "Could not save. Nothing was
  changed. Check the fields and try again." The fields were fine. She is not allowed,
  and nothing said so.
- The trial banner on every screen offers her "Add payment method". It opens Your
  sparx bill, where "Set up billing" is open to her. Pressed, it says "Requires admin
  role or higher."

## What should have happened

A screen she may look at but not change says so before she starts, the way Modules
does, and its controls are locked. If a refusal still happens, it says why in plain
words and who can do it.

## How to reproduce

1. Sign in as `alyssa.thompson@gillettdiesel.test` (Editor).
2. Business details: change any field, Save. "Check the fields and try again."
3. The banner's "Add payment method", then "Set up billing": "Requires admin role or
   higher." Every time.

## Why it matters

A sentence on screen is false ("check the fields"), and another is jargon. The form
invites work that cannot be kept. An owner who hands a bookkeeper a seat needs that
seat to show them what is theirs to change.

## Where it lives

- The server refuses correctly: `requireRole(request, 'admin')` on each write. Its
  sentence is `Requires ${min} role or higher.` (`wizeworks/packages/api-core/src/auth.ts`),
  which every console and the MCP server show as is.
- `sparx/apps/workbench/surfaces/business-details.tsx`: no role check; its `onError`
  ignores the error and gives fixed advice. `email/email-settings.tsx` has the same
  fixed advice.
- No role check on: business details, email settings, Your sparx bill
  (`finance/subscription.tsx`), sample data, payment providers (list and detail),
  sending domains, shop settings (`commerce/commerce-settings.tsx`), the trial banner.
- The rule "an owner or an admin" is written out by hand in about twelve other
  screens (`modules-list.tsx`, `chat/settings.tsx`, `ai-connections.tsx`,
  `integration-detail.tsx`, …), each its own copy.

## The fix

Four single points, then each screen.

- **What a refusal says** (`wizeworks/packages/api-core/src/auth.ts`, shared by both
  consoles and the MCP server): `roleRefusal(min)`, e.g. "Only an owner or an admin of
  this business can do this. Ask one of them." in place of "Requires admin role or
  higher." `role-refusal.test.ts`, red then green.
- **Who may change settings, said once** (`lib/manage-rights.ts`, both consoles):
  `canManageBusiness(role)` and `useManageRights()`. The fifteen hand-written copies
  of the rule (three spellings) now call it; `lib/manage-rights.test.ts` keeps it the
  only copy (red on the fifteen, green after; Piggles had one more,
  `all-apps-dialog.tsx`).
- **The notice and the lock** (`components/managers-only.tsx`, both consoles):
  `ManagersOnlyNotice` ("You can see this, but not change it. Only an owner or an admin
  can …") and `ManagersOnly`, a `<fieldset disabled>` that locks every control inside.
- **A `+` they cannot use is not offered** (`createManagersOnly` on a screen in the
  registry; `createActions` and the panel's `+` skip it): "Add a sending address"
  is gone from the search box and the panel for them. `launcher-create.test.ts`, red
  then green, both consoles.
- **The screens**, both consoles: Business details (no Save, locked, notice; its error
  now gives the server's reason), Your bill (the card button replaced by the notice;
  "No card on file yet." without the instruction to set it up), the trial banner
  (sparx: `billingNotice(billing, canPay)`, tells the team who can act, no button,
  `notice.test.ts` red then green; Piggles: `lifecycleNotice`, the band and the plan
  card, `lifecycle.test.ts` red then green), Sample data, Selling settings, Payment
  providers (list: notice; a provider: notice and locked), Sending addresses (list and
  address: no add, check, default or remove; notice). Email settings, open to Editors,
  keeps its form; its fallback no longer says "check the fields".

Screens already right and left alone: Modules, Team, Chat settings, AI connections,
Integrations, Partner access. Lint clean on every changed file; sparx console 2,054
tests and Piggles 2,352 pass; api-core 11. Typecheck not run (Brandon: leave it for
now). The Piggles part was ported by a helper agent and read back here.

## Confirmed by

P01 on screen, 2026-10-08 (sparx), as Alyssa: Business details opens with "You can see
this, but not change it. Only an owner or an admin can change your business details",
every field locked, no Save. The banner reads "7 days left in your free trial. An
owner or an admin can add a payment method to keep every feature running when the
trial ends." with no button. Your sparx bill: "No card on file yet." and "An owner or
an admin looks after the bill". Payment providers and sparx Pay: notice, "Continue
setup" locked. Sending addresses: notice, no add button, and the search box offers
only "Sending addresses". Sample data: notice, no Load. Selling settings: notice, all
14 fields locked, no Save.

Second confirmation, as Doty (owner): Business details editable with Save, the banner
keeps "Add payment method". The refused "Suite B" never reached the database.

Not checked on screen: the Piggles console (its tests pass).

## Rating effect

—
