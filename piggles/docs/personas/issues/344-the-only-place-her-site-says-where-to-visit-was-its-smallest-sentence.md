# 344 — The only place her site says where to visit was its smallest sentence

**Status:** fixed — platform and her own page
**Severity:** minor
**Found by:** P03 · Juniper Row · scoring her published site (RULE #8)
**Surface:** the published site › Contact — and seven more sections across the kit
**Filed:** 2026-08-30
**Fixed:** 2026-08-30
**Confirmed by:** eight sentences pinned at body size in `sections.test.ts`, proved red first

## What happened

Devi's Contact page offers a form, and beside it one sentence telling a shopper they
can come to the studio instead:

> Or come and see the clothes in person. The studio is open Thursdays, 11 to 4, at
> 1418 Larimer Street in Denver. No appointment needed.

It renders at **14px** — smaller than every other sentence on the page. It is the only
place on her whole site that says where to physically go.

## What should have happened

Body text is 16px. A sentence a visitor is meant to act on is body text.

## Why it mattered

**She never chose the size.** The words are hers; the class came out of our factory.
`enquiryForm()` ships this slot as `text-sm` with the sample copy _"Or call
(555) 123-4567 if that is quicker"_ — which reads like small print, so 14px looked
right when it was written.

But the slot is not "small print". It is **the other way to reach this business**, and
whatever an owner rewrites it to, it stays that. She rewrote hers to an address and
opening hours, and the platform set them in caption type.

**The kit's own header already said so:**

> BODY TEXT IS 16px MINIMUM. `text-base` is the floor for anything meant to be read;
> `text-sm` appears only on genuine captions and metadata.

And `caption()`, the one helper that is allowed to be small, says what qualifies: _"a
photo credit, a unit, a footnote… text deliberately NOT competing for attention."_

## Seven more, and they share a shape

Auditing every small-text use in the section kit against its own rule found the same
mistake seven more times. None of them is a credit, a unit or a footnote — every one is
a **term of the purchase** or an **instruction addressed to the reader**:

| Section         | Set at 14px                                                         |
| --------------- | ------------------------------------------------------------------- |
| `offer_hero`    | Free delivery within 50 miles. Four to six weeks from order.        |
| `bundle_offer`  | Price held for 60 days from your quote.                             |
| `cost_examples` | All figures include VAT, materials, fitting and disposal.           |
| `opening_hours` | Holiday hours vary — call ahead if you are making a special trip.   |
| `service_area`  | Outside these? Call us — a longer trip is usually still worth it.   |
| `price_list`    | Prices include VAT and delivery within 50 miles.                    |
| `menu_sections` | Please tell us about any allergies — everything is cooked to order. |

Delivery cost, lead time, what a price includes, how long a quote holds, whether to
call before driving over, and an allergy instruction in a restaurant. Every one is
something a person decides or acts on, and every one was the smallest text near it.

`service_area`'s is the sharpest: _"Outside these? Call us"_ is addressed precisely to
the visitor who did NOT find their town in the list — the one reader on that section
who most needs a next step, given the least readable sentence.

## The fix

All eight move from `caption()` to `body()` — `text-base`, the same helper the rest of
the kit already uses. No new concept, no new class, one word each.

`caption()` keeps every genuinely small use it had: photo credits, a person's role,
bylines and dates, field labels, "Last updated 18 July 2026", and the privacy note
under the newsletter form. That last one is reassurance rather than an instruction,
which is the line this audit drew.

The enquiry form's line is the only raw `text-sm` string that existed outside
`_shell.ts`; with it gone, every small-text decision in the kit now goes through
`caption()`, where the rule is written down.

## Confirmed by

`sections.test.ts`, nine new tests: the eight sentences, each asserted to render
without `text-sm`, plus a guard that all eight sections still exist — **which earned
its place immediately**, catching two section keys I had guessed wrong (`pricing_hero`
and `quote_table` are really `offer_hero` and `cost_examples`). Without it the two
assertions would have found nothing to check and reported nothing wrong.

Pinned by SENTENCE rather than by scanning for `text-sm`, deliberately: a scan goes
green the moment someone rewrites the copy, which is exactly when a type decision gets
lost.

Proved red by putting `text-sm` back on the enquiry line — the test named the section
and the phrase. `silica-catalog`: **1321 tests across 37 files** (was 1312).

## Her own page, stated plainly

**The catalog fix does not reach it.** Her Contact page is a stored, published tree, so
it keeps the class it was stamped with.

**But she can change it herself, and this file first said she could not.** That was a
claim about the code that did not survive being checked: the Design tab's Text section
opens with a Size row — Small, Normal, Large, Bigger, Title, Headline, Huge — sitting on
exactly the `text-sm` / `text-base` ladder this issue is about. Selecting a paragraph
and clicking Normal is the whole repair.

**A heal-on-read repair was considered and rejected on the numbers.**
`upgrade-page.ts` exists for exactly this, and all three of its stated conditions hold
(the shape is broken, the platform stamped it, the replacement is known). What it fails
is the fourth thing that file says about itself — _"dated repairs for known cohorts"_.
Measured across the whole database: **1 page out of 419** carries this shape, and it is
hers. New stamps use the corrected factory, so the cohort is closed at one and cannot
grow. Fleet-wide repair code, with its own tests, to fix one paragraph on one page is
not a proportionate answer.

Its own table would also have made it dangerous: `DEAD_CLASS_REPAIRS` is keyed on the
exact stale token, and `text-sm` is a perfectly good class used correctly on every
genuine caption in the fleet. A token-keyed heal would have rewritten all of them —
the same trap [339] avoided.

### What actually fixed her page

Done as her, in the studio, and it took one click rather than a re-placed section — so
her heading, her paragraph and her sentence were all kept, and the paragraph's node id
(`2a323619…`) is unchanged.

**The click had to be made at the phone size, not the desktop one.** The studio opens on
desktop, and there the Size row read _"Small — from a smaller size"_: the class lives on
the base breakpoint and desktop only inherits it. Clicking Normal there would have
written a desktop-only override and left every phone visitor on 14px, which on a
clothing shop is most of them. The panel does say so, in the line above the controls
(_"Editing what changes on desktop. Smaller sizes keep what they already have"_), and
the Size row's own chip said the value was inherited rather than set — which is the
distinction [348] had just made visible. Switching to the phone size first, then
clicking Normal, sets it once for every width.

Confirmed on her published page: `class="text-base-content text-base"`, no `text-sm`
anywhere in the tree, and the sentence measured at **16px** on the served page — the
same size as the paragraph above it.

## Noticed, not acted on

`productAttributes()` in `commerce.ts` renders each attribute section's heading as
`text-sm font-semibold uppercase tracking-wide` — 14px micro-caps. It is a real `<h2>`
for its own section rather than a kicker above another heading, so RULE #2 does not
plainly ban it, and it does not render on this site at all (the block is
`visibleWhen('attributeSections')` and her products carry none — checked on her live
Marlow Knit page, where both `uppercase` hits are in the CSS bundle and neither is in
the markup). A type decision on a section no persona has exercised is not this run's to
make.

## Rating effect

Against `P03 site — Juniper Row`, the Contact page. Closes item (5) of that row's gap
list at the platform; her own page is named above.
