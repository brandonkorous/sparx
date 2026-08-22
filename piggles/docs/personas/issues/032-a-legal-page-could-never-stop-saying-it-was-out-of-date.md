# 032 — A legal page could never stop saying it was out of date

**Status:** fixed
**Severity:** blocker (the checklist could not be completed by any means)
**Found by:** P01 · Thistle & Rye · act 7 — rebuilding the legal pages
**Surface:** mypiggles › Content › Legal pages (and the editor it sends you to)
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

Marisol's six legal pages all read:

> **Needs review** — A newer starter version is available. Open it to see what
> changed and update it.

She opened one. The editor had a title box, a body, Publish, Schedule and Save.
**No "see what changed". No "update it".** The disclaimer at the top of the body
was still the old one, naming a company she has never heard of ([#030](030-her-privacy-policy-named-a-company-she-has-never-heard-of.md)).

The only thing she could have done is retype the paragraph by hand, having never
been shown the new one.

## Why it matters — this is worse than a missing button

`legal_template_version` was written **once**, at creation, and never again.
Grepping every write in the repo found exactly two: `createLegalPageTx` and the
seeders. So the checklist's `stale` state had **no exit**:

```
else if ((entry.legalTemplateVersion ?? 0) < t.templateVersion) state = 'stale';
```

A stale page could be edited, published, and placed in the footer, and it would
still be `stale` — because `stale` is tested before `unplaced` and `complete`,
and nothing could move the number it tests. **"0 of 4 required ready" was
unreachable from "0" for the rest of the tenant's life.**

And it was self-inflicted the same day: bumping all six templates 1 → 2 for
[#030](030-her-privacy-policy-named-a-company-she-has-never-heard-of.md) was the
right call, but it pushed every tenant with scaffolded legal pages into a state
the product had no way out of. The bump was correct; the missing exit is the bug
it exposed.

## The fix

**The service.** [legal-service.ts](../../../../wizeworks/packages/cms/src/legal-service.ts)
gains `legalStarterUpdateTx` (what the newer wording IS, and whether the page has
been edited since it was created — answered from the revision history, since old
template versions are not kept anywhere) and `refreshLegalPageTx` (take it).

The replace is deliberate about three things:

- **Her wording is banked first**, as a revision summarised "Before taking the
  newer starter wording". A replace that cannot be undone should not sit behind
  one button.
- **The disclaimer acknowledgement is cleared.** It means "a person read this and
  accepted it", and the words are now different. Carrying it forward would
  certify text nobody has read.
- **The page's status is not touched.** A published page updates live, which is
  what the confirm says will happen.

**The transport.** `GET /v1/legal/pages/:id/starter` and
`POST /v1/legal/pages/:id/starter` in [legal.ts](../../../../wizeworks/services/api-rest/src/routes/v1/legal.ts).

**The screen.** A **Use the new wording** button on the row, beside Edit text,
for stale pages only — and the row copy no longer promises a thing the product
cannot do:

> The starter wording has been updated since this page was made. You can take the
> new wording — what is on the page now is kept in its history.

with "Your live page still shows the older version." added when it is published.
The confirm names the page, says her version is recoverable, and warns when the
change goes live immediately. Built in **both** consoles.

## Two more defects this turned up, both fixed here

**The open editor kept the old wording, and Save would have put it back.**
`content-detail` initialised its draft once per entry id and never re-read —
correct for protecting an in-progress edit from a background refetch, wrong when
the server's copy has genuinely moved. After taking the new wording, the pane
already open on that page still showed the old text, the pane's own Refresh did
not shift it, and only a full browser reload did. Pressing Save there would have
written the superseded, vendor-named wording back over the new one — the same
shape as [#027](027-the-words-box-put-the-old-text-back-when-she-edited-on-the-canvas.md).
The guard is now **dirty** rather than "already initialised": a clean draft has
no edit to protect and shows the truth; a dirty one keeps her work. The mutation
also invalidates the entry and its revisions, so the pane actually refetches.

**Publishing a legal page did not update the legal checklist.** Four policies
went live one after another while Legal pages went on saying "0 of 4 required
ready" — which reads as "publishing did not work", not "this list is a minute
old". `useInvalidateContent` now refreshes the legal checklist too, since a legal
page IS a content entry and the editor is the only place it can be published
from. The key root is exported from `data.ts` and consumed by `legal-data.ts`
rather than written out twice, because two hand-written copies of a query key
drift silently — the invalidation keeps succeeding against a key nothing reads.

## Confirmed by

Re-run as Marisol, 2026-08-20, on the screen, end to end:

1. Six rows read the new sentence and carry **Use the new wording**.
2. Took it on all six. Each dropped from "a newer version is available" to the
   ordinary "This is still the starter wording… mark it as checked" — the state
   that has always had an exit.
3. Reloaded the Privacy Policy editor: the disclaimer now reads **"This is
   starter wording, not legal advice…"** with no vendor named. That is #030's fix
   visible in a real page for the first time.
4. Marked all six reviewed, published five (Shipping left as a draft — she does
   not post orders out; see [#031](031-her-collection-only-bakery-was-set-up-to-deliver-anywhere-in-the-world.md)).
5. **Legal pages now reads "All required pages ready — Every page you are
   expected to have is published, up to date, and linked in your footer."**
   0 of 4 → 4 of 4.

**Not driven on screen:** the two knock-on fixes were made after this walk, so
the stale-editor re-read and the auto-refreshing checklist were reasoned and
lint/typecheck-clean but not re-walked by hand. The behaviour they replace WAS
seen, twice.

## Rating effect

None recorded yet — `cms.legal` has not been scored.
