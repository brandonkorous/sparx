# 030 — Her privacy policy named a company she has never heard of

**Status:** fixed — both parts; the open question was answered 2026-08-20
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — the legal three
**Surface:** mypiggles › Content › Legal pages › Edit text
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

Marisol opened her Privacy Policy to read it before publishing. The first thing
in the body, in a yellow box:

> This is a starter template provided by **sparx** — not legal advice. Review it
> with your own counsel and tailor it to your business, jurisdiction, and how you
> handle data before publishing.

She has never heard of sparx. Her account is Piggles, the console says Piggles,
the bill says Piggles. The same sentence sits at the top of all six legal
templates.

## Why it matters

Two audiences, and the sentence is wrong for both.

**The owner.** A name she has never seen, inside her own policy, on the screen
where she is deciding whether to trust the wording. Piggles exists as its own
product with its own vocabulary — the console has a whole adapter for renaming
platform things (`PIGGLES_COPY`, `PIGGLES_SURFACES`) — and this walked straight
past it because it lives in content rather than in the interface.

**Her customers.** The disclaimer is **body content and survives editing** by
design — the code says so:

> The starter-text disclaimer prepended to every template body. **It is content
> (survives editing)** — the structured "reviewed?" signal lives on the entry's
> `legal_disclaimer_ack_at` column.

So unless she deletes the yellow box herself, it publishes. A shopper opening
Thistle & Rye's privacy page would read that the policy is an unreviewed template
from a company they have also never heard of. Nothing in the checklist tells her
to delete it — it says "Read it through, make it fit your business, then mark it
as checked."

## Where it lives

[wizeworks/packages/legal-templates/src/index.ts:63](../../../../wizeworks/packages/legal-templates/src/index.ts#L63)
— one `disclaimer()` used by all six templates.

## The fix

The sentence names no vendor now, and says what it means in plainer words:

> This is starter wording, not legal advice. Read it through, make it fit your
> business and where you trade, and take your own advice on it before you publish
> this page.

Fixed by REMOVING the name rather than swapping in "Piggles". The same package is
fronted by more than one product, and the second audience — the shopper — has no
use for any vendor's name. The sentence loses nothing.

**The template version had to move with it.** All six were `templateVersion: 1`,
and the checklist's readiness test is "published, **built on the latest starter
wording**, and linked in your footer" (`entry.legalTemplateVersion < t.templateVersion`
→ `stale`). Changing the words without bumping would have left every existing
page reporting itself current while still containing the old text — the version
column would have been lying. All six are now `templateVersion: 2`.

**Blast radius, stated plainly:** every tenant with scaffolded legal pages now
sees them as needing an update. That is the honest state — their pages really do
contain superseded wording — but it is a platform-wide flip and Brandon should
know it happened.

### A second defect, found by the first

With the pages now stale, the row copy read:

> A newer starter version is available. **open** it to see what changed and update it.

One template string serves two branches. With the live clause the verb continues
the sentence after an em dash ("— open it"); without it, the verb _starts_ a
sentence, lowercase. The second branch is the common one.
Fixed in [legal-data.ts:264](../../../apps/workbench/surfaces/cms/legal-data.ts#L264)
by capitalising per branch.

**The identical line exists under `sparx/`** (`sparx/apps/workbench/surfaces/cms/legal-data.ts`).
Not touched — piggles RULE #0 forbids it. **Someone needs to make the same
one-word fix there.**

## What was still open, and the answer

**Should that disclaimer be publishable at all?**

Brandon, 2026-08-20: **"yes it should be if the user publishes it. which is what
we built right?"** — and yes, it is. Nothing was changed for this; the behaviour
was already the decided one, and this section records that it was checked rather
than assumed:

- The disclaimer is an ordinary `callout` node at the top of the template body
  ([legal-templates/src/index.ts](../../../../wizeworks/packages/legal-templates/src/index.ts)),
  authored into the doc like any other paragraph.
- Nothing strips it at publish, and nothing blocks publish while it is present.
  The owner can delete it, keep it, or rewrite it — it is her page.
- The structured "I have read this" signal is a separate column
  (`legal_disclaimer_ack_at`), so acknowledging the warning and removing the text
  are independent acts. Neither forces the other.

So the three candidates floated in the original filing — strip at publish, block
publish, or instruct her to delete it — are all declined. **Publishing is the
owner's decision, and the platform does not edit her page on the way out.**

**The sparx-side one-word fix is done.** The `open` → `Open` correction in
`sparx/apps/workbench/surfaces/cms/legal-data.ts` was made on 2026-08-20 with
explicit approval to touch `sparx/` ("you can in this case update sparx as well,
as this is a confirmed system wide issue you are fixing"). Both products now read
the same.

## Confirmed by

Re-ran it as Marisol, 2026-08-20. Reloaded **Content › Legal pages**: all six
rows now read "A newer starter version is available. **Open** it to see what
changed and update it", and **Mark reviewed is correctly withdrawn** while the
wording is stale — you cannot certify wording you have not seen. The version
mechanism did exactly what it claims.

**Not checked:** what the new disclaimer looks like in a freshly scaffolded page
(this tenant's six were built at v1 and still hold the old body until rebuilt).

## Rating effect

None recorded yet — `cms.legal` has not been scored.
