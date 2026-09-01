# 375 — Her Shipping Policy promised a speed she does not work at

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · reading her own legal pages against her own words
**Surface:** juniper-row.piggles.site › /shipping-policy · and mypiggles › Content › Legal pages
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** her checklist, which now names all three guesses, in both themes

## What happened

Devi's Shipping and returns page, in her own words:

> I post on Tuesdays and Fridays, so allow about four working days from the next
> post day.

Her Shipping Policy, published, linked in her footer, and the document that
governs if a customer disputes anything:

> Orders are usually processed within one to two business days before they ship.

She never wrote that sentence and never chose that number. It is the starter
template's, published verbatim.

Two more of the same shape:

| Her Return Policy says                          | Which she never decided          |
| ----------------------------------------------- | -------------------------------- |
| returns accepted "within 30 days of delivery"   | the window                       |
| "We will note any exceptions at checkout"       | her checkout notes no exceptions |
| refunds paid "within five to ten business days" | the refund time                  |

And her Return Policy is silent on the one term she does state on her own page —
"If you would rather have the money back, the $9 comes off the refund" — so a
customer reading the policy expects the whole amount.

**Everything in the console said this was done.** The Legal pages screen showed
six green **Published** badges and, across the top:

> **Your required pages are all set**
> Every page you are expected to have is published, up to date, and linked in your
> footer.

## Why it happened

The checklist counts publishing, not reading:

```ts
if (!entry) state = 'missing';
else if (entry.status !== 'published') state = 'draft';
else if ((entry.legalTemplateVersion ?? 0) < t.templateVersion) state = 'stale';
else if (!placed) state = 'unplaced';
else state = 'complete';
```

A page that is published, current, placed and **word-for-word the starter** lands
on `complete`, the best state there is. Which is defensible for privacy, terms and
cookies — those describe the platform's own behavior, and the platform does know
it. It is not defensible for returns, shipping and refunds, which describe how
**this** business works, and where the starter has to write a number to have
written anything.

A number on a published policy page is indistinguishable from a decision.

### The two signals that already existed both answer a different question

- **`legalDisclaimerAckAt`** — set on all six of hers. It records that somebody
  accepted a general "this is starter wording" disclaimer. It does not record that
  anyone read the sentence promising one to two working days.
- **Revision count** — five on every one of hers, and every one still byte-identical
  to the template. Publishing and placement make revisions. Counting them says
  "edited" about a page nobody has touched.

I tried the revision count first, and it reported all six as edited. Measuring the
stored body against the template is what showed the pages were untouched.

## The fix

**The starter now declares what it made up**, in the owner's words, on the
template itself:

```ts
assumes: [
  'that you pack and send an order within one to two working days',
  'that tracking is sent when an order ships',
],
```

Three templates carry one; privacy, terms and cookies carry none, because they
assert nothing about this business.

**The checklist compares the published words to the starter's** and hands the list
forward as `stillGuessing`. Comparing the TEXT, not the JSON: Postgres reorders
jsonb keys on the way in, so the stored document never stringifies to the same
bytes as the literal it came from — an exact-looking comparison would have quietly
answered "edited" for every page on the platform. Text is also the better
question, since reformatting a heading has not changed what the page promises.

**The console says it, and the banner stops overclaiming.** Each affected row
carries a **Still our wording** badge beside Published, and under it:

> Nobody has changed this page, so it still says:
> · that returns are accepted for 30 days after delivery
> · that items must come back unused and in their original packaging
> · that any non-returnable item is pointed out at checkout
> We had to write something, and we guessed. Change anything that is not how you work.

The banner adds "3 of them still say things we guessed about your business — they
are marked below" and drops from success green to info, because a green banner
above three warnings is where an owner stops reading.

**Nothing of this reaches the published page.** Issue 267 settled that a legal body
addresses the visitor and never the owner — a shop's privacy page once opened with
"take your own advice on it before you publish this page", in the shop's own voice,
to a shopper deciding whether to hand over an address. There is a test enforcing
it, and it bans exactly the in-prose placeholder this fix first reached for. The
warning belongs in the console, and that is where it is.

### One thing I got wrong on the way

The first version painted the warning with `text-warning` on the card. Measured in
light mode it came out at **1.44:1 at 14px** — faded ink on text somebody is meant
to read, which is the failure the block exists to warn about, and a colour meant
for a component's fill being used as ink.

It is now a `<Badge color="warning" variant="soft">` carrying the colour as state
on the row, with the sentences in inherited ink at 16px. Measured after: heading
and bullets 15.18:1, badge 14.55:1, zero `text-warning` ink anywhere on the pane.

## Confirming it

On her real account, both themes:

| Check                    | Result                                                       |
| ------------------------ | ------------------------------------------------------------ |
| Return, Shipping, Refund | each carries **Still our wording** and names its own guesses |
| Privacy, Terms, Cookies  | unchanged — they assert nothing to warn about                |
| The banner               | "3 of them still say things we guessed", and no longer green |
| The published pages      | unchanged, and still address only the visitor                |
| Contrast, light mode     | 15.18:1 body, 14.55:1 badge, at 16px                         |

**Twelve tests** on the templates, four of which go red without `assumes` —
including the rule that any starter stating a period must declare it, so the next
number somebody adds to this prose cannot ship undeclared.

`legal-list.tsx` was 707 lines, well over Piggles RULE #0.5's 250, and this touched
it — split into the surface (332), `legal-checklist-rows.tsx` (140) and
`legal-placements.tsx` (293).

## Still open

- **Her three pages still say the wrong things.** The console now tells her; the
  words are hers to change, and rewriting an owner's published policy is not mine
  to do. The live contradiction is Shipping Policy's "one to two business days"
  against her own "I post on Tuesdays and Fridays".
- **The platform could fill some of these instead of guessing.** It knows her
  delivery charge and her free-delivery threshold from the shipping profile, and it
  could know a return window if it asked once. Deriving what it has and declaring
  only what it does not is strictly better than declaring all of it, and is its own
  piece of work.
- **The starter's return window is not connected to the returns feature.** If the
  console ever enforces a window when a customer requests a return, that number and
  this sentence must be the same number, and right now nothing joins them.
