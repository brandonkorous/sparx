# 033 — Publish put the old wording live and said it was live

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Content › any entry (here: Legal pages › Shipping Policy › Edit text)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 on the Refund Policy — pasted his policy, pressed Publish without Save; the stored, published body starts "Last updated: 8/20/25"
**Blocked on:** —

## What happened

Doty opened his Shipping Policy from Legal pages, pasted his real policy from
gillettdiesel.com over the starter text (headings, a table of delivery times),
and pressed **Publish**. The toast said **"Shipping Policy is live"**, the badge
said Published, the status bar said "Saved just now".

The database held the **starter wording**: `published`, body "This policy
explains how and when we ship orders." His text sat on screen, unsaved, under a
"1 unsaved change" note. Customers would have read the starter policy.

The editor also said nothing about the page being starter wording. Piggles fixed
that in its issue 267 (a warning in the editor of a policy page); sparx never got
it, under a parity exception that called it a Piggles-only feature.

## What should have happened

Publish puts what is on the screen in front of customers. A toast that says "is
live" is only true about what is live.

## How to reproduce

1. Open any draft content entry. Change the body.
2. Press Publish (not Save).
3. The stored body is the old one; the edit is still unsaved.

## Why it matters

Every owner presses Publish after writing. The page they just wrote is the one
they believe customers see. For a policy page that is a legal document: a
30% restocking fee and a core-return rule promised to customers who were shown
something else.

## Where it lives

- `surfaces/cms/content-detail.tsx` (both consoles): `publishNow` called the
  publish endpoint, which publishes what is STORED, and ignored `dirty`. Schedule
  the same.
- **The same shape, found by grepping every editor that publishes beside a
  dirty Save:**
  - `surfaces/social/composer.tsx` (both): Send for approval, Schedule and
    Publish now acted on the stored post with edits on screen.
  - `surfaces/invoicing/template-editor.tsx` (both): Publish sent the stored
    layout.
  - `surfaces/commerce/discount-detail.tsx` (sparx) /
    `discount-editor-writes.ts` (Piggles): Switch on turned on the stored
    discount, old amount and all.
  - Already right: email editor, automation editor (both save first).

## The fix

- Each of those actions now saves the edits on screen first, then does its job;
  a save that fails stops it there with the save's own error. Discount "Switch
  on" with invalid edits says "Fix the boxes marked in red first. Nothing was
  changed."
- sparx content editor: Save moved to the toolbar's `primary` slot (it sat in
  `controls`, which folds into a menu on a narrow pane); line removed from
  `SPARX_DEBT` in `scripts/check-toolbar-primary.mjs`.
- The policy-page warning ported to sparx (`policy-page-notice.tsx`,
  `ContentEntry.legal_kind` / `legal_reviewed`, `legalKindTitle`), and the two
  stale parity exceptions removed.
- The warning said "still the starter wording" while keyed only on "not marked
  reviewed", so it kept saying it after he replaced every word. Both consoles now
  say "not marked reviewed yet", and the warning carries a **Mark reviewed**
  button. The Legal pages row copy now says the same true thing.

## Confirmed by

> Re-ran P01 act 2. Shipping Policy (already live with starter text): the editor
> showed "Your Shipping Policy is live and not marked reviewed yet"; Save stored
> his text (body 10,481 chars, starts "Effective Date: January 1st, 2025");
> Mark reviewed cleared the warning. Refund Policy (draft): pasted his policy,
> pressed **Publish** only; stored body starts "Last updated: 8/20/25",
> `published` at 15:33:12Z, Save greyed, no unsaved change.

> Discounts: made "Spring fleet service" (FLEETSPRING, 10%, $250 minimum), changed
> 10 to 15 without saving, pressed **Switch on**: stored `active`, `value_percent` 15. Invoice templates: renamed "Default" to "Gillett invoice – Net 30" and wrote
> his Net 30 and core-return terms without saving, pressed **Publish**: "Template
> saved", "Your customers now get this one", `published_tree` holds "Net 30".

**Not checked, outside service:** social posts (a post needs a connected social
account). **Not re-proved on screen in Piggles:** the write fixes (the only
signed-in Piggles account belongs to another agent's persona); its search and
toolbar changes were checked read-only.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0;
`check:console-parity` green; `check:toolbars` green (18 debt left); prettier clean.

## Seen, not settled

The first Save of the Shipping Policy failed ("That didn't save. We couldn't
reach the server", api-rest restarting) while the status bar read "Saved just
now". The second Save worked. Whether the status bar was describing the earlier
publish or the failed save is **not checked**.

## Rating effect

Content editor: Ease deduction until re-scored.
