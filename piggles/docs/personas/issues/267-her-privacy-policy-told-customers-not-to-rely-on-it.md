# 267 — Her privacy policy told customers not to rely on it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — closing out the legal checklist
**Surface:** mypiggles › Content (the entry editor), and every legal starter
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi opened her Privacy Policy from the Content list, read it, and pressed
**Publish**. One click, no question. This then served at
`juniperrow.com/privacy-policy`, as the first thing on the page:

> **Privacy Policy**
>
> This is starter wording, not legal advice. Read it through, make it fit your
> business and where you trade, and take your own advice on it before you
> publish this page.
>
> This Privacy Policy explains what personal information we collect…

A shopper opens that page to decide whether to hand over an address and a card.
The shop's own voice tells them the policy is not to be relied on.

The Return, Shipping and Refund starters carried the same sentence, plus a
second kind of note-to-the-owner inside customer prose:

> "You may request a return within **the period stated here (for example, 30
> days of delivery)**."

## Why it matters

- **It is the one page whose entire job is to be trusted.** Nothing else on a
  shop's site can undo a policy that opens by disclaiming itself.
- **Publishing it took one click and said nothing.** The entry editor lists
  policy pages beside blog posts and treats them identically. It never mentions
  that this one is a legal document.
- **The gate exists and was not reached.** `content_entries` has a
  `legal_disclaimer_ack_at` column, the API has
  `POST /v1/legal/pages/:id/acknowledge`, and the Legal pages surface badges
  every unreviewed page "Needs review". Hers was NULL and stayed NULL, because
  the route she took never asks.

## Where it lives

The warning was authored as CONTENT, deliberately, and the comment above it
shows the thinking got most of the way there:

> "It is content (survives editing) — the structured 'reviewed?' signal lives on
> the entry's `legal_disclaimer_ack_at` column. … This text is written for the
> owner but **sits in a body the owner can publish, so it has two audiences**,
> and the second one is the reason: a shopper reading a bakery's privacy page
> has never heard of whoever built the site…"

Both audiences were seen. The conclusion drawn was only about which VENDOR NAME
to avoid in front of the second one — not about whether that audience should be
reading the sentence at all.

## The fix

**The warning is out of the body, in all six templates.** It says nothing the
console does not already say twice where only the owner can see it: the Legal
pages surface badges the page "Needs review" and prints the same point in its
own words, and its Mark-reviewed dialog says it best of all —

> "Confirm you have read the starter wording and made it fit your business. This
> is not legal advice — if you are unsure, check it with your own advisor. This
> only clears the 'needs review' note; it does not publish the page."

**The in-prose placeholders became real sentences.** "within the period stated
here (for example, 30 days of delivery)" → "within 30 days of delivery"; the
same for the shipping processing time and the refund window. A number an owner
can change beats a bracket that tells a customer nothing.

**`templateVersion` 2 → 4.** That is what makes the correction reach the tenants
who already installed the old wording: the checklist marks their page **stale**
and offers **Use the new wording**, keeping what they had in the page's history.
Verified on Devi's own six.

**The generic editor now says what it is publishing.**
[policy-page-notice.tsx](../../../apps/workbench/surfaces/cms/policy-page-notice.tsx)
appears above an unreviewed policy page's body, names the document, says it is a
starting point and not legal advice, and links to Legal pages. It needed
`legal_kind` and `legal_reviewed` on the entry wire shape, which the editor had
never been given.

**And a guard.**
[index.test.ts](../../../../wizeworks/packages/legal-templates/src/index.test.ts)
walks every string in every template body — and in `legalEntryBody`, the shape
that actually lands in the row — and fails on anything addressed to the owner:
"not legal advice", "starter wording", "before you publish", "read it through",
"make it fit your business", "stated here", "(for example, 30…".

Proved red by putting one sentence back:

```
AssertionError: returns body matches /stated here/i
AssertionError: returns stored body matches /stated here/i
```

## Also seen, and it is why the ungated route gets used

**Legal pages has no Publish button.** Every row says "Publish it when you are
ready" and offers only **Edit text**, which opens the generic entry editor — the
route with no gate. The surface whose whole job is getting these live cannot put
one live. Not filed separately: it is the same story, and it explains how an
owner ends up publishing a policy from a screen that thinks it is a blog post.

## Confirmed

All six of her policies are live, on the corrected wording, marked reviewed, and
linked in the footer of every page — the checklist reads **All required pages
ready**, and every URL resolves:

```
/privacy-policy   /terms-of-service  /cookie-policy
/returns-policy   /shipping-policy   /refund-policy
```

None contains "not legal advice" or "stated here". `@wizeworks/legal-templates`,
`@wizeworks/cms`, api-rest and the workbench all typecheck; 7 template tests
pass.

## Related

[[feedback_absent_behaves_like_fine]] — `legal_disclaimer_ack_at` exists, is
written by a real endpoint, and was simply never reached from the screen an
owner actually used. A half-wired gate looks exactly like a wired one.

Same family as [263] and [266]: words written for the OWNER, rendered to the
CUSTOMER. This is the sharpest instance, because the sentence is specifically
about not trusting the page it is printed on.

## Rating effect

Content and Legal pages, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
