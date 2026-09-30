# 849 — A magazine published the platform's marketing under its own name

**Status:** fixed
**Severity:** **major** — a live, paid, public site selling an invented brand's merchandise and publishing the platform's own articles, with nothing in the product ever saying so
**Found by:** P03 · act 294, reading P09's site as a stranger; scored in rating row 596
**Surface:** mypiggles › Home, and every site built from a design
**Filed:** 2026-09-26
**Fixed:** 2026-09-26
**Confirmed by:** a DB-backed test that installs a design, reports every example, then edits one product and watches only that one drop off

## What a stranger read

The Marrow Review is a reader-funded magazine of ideas. Live, public, paid for.
Its Journal:

```
How to launch your online store in a weekend
Product descriptions that sell
Turn first-time buyers into regulars
```

Its shop: thirteen active products with prices and a working **Add to cart**.
Enamel Pin. Sticker Pack. Ceramic Mug.

A stranger learned nothing about the magazine and could buy a pin from a
literary review.

## Why this is not the same defect as 091

[091](091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md) was
the WRONG starter: every Piggles tenant was provisioned with the `sparx` golden
blueprint, so a Denver hair salon sold a **sparx** Enamel Mug. That is fixed, and
the names here prove it. They are Rowan, the invented demo business Piggles ships
for exactly this.

This is the one underneath it. **Whichever design she installs, its contents are
copied into her site and are live from the first minute.** That is the right way
to build it: a site that is empty on day one teaches nobody anything, and the
example content is what makes a new site look like a site while she works on it.

It stops being right the moment she publishes. And nothing in the product ever
mentioned it.

## What was there all along

Every artifact an install creates is **stamped with a baseline**, the exact
content it was given (docs/55 §4), and the updater's own handlers already know
how to read each kind's live row back in that same shape. Deliberately: a comment
four lines into the page handler says it carries a field it never merges
"so base == live-extract stays exact and no false change surfaces."

So "has she touched this?" was already answerable and nobody was asking it. The
Marrow Review's install carries twenty-three of them:

```
page × 7    product × 6    content × 3    email × 2
brand · theme · frame · category · collection
```

Reusing those handlers is the point. A second reader of a page tree would be a
second thing to keep in step with the first, and the half that drifts is the half
nobody looks at. [[feedback_a_fix_leaves_its_neighbour_behind]]

## The rule, which had to be measured twice

The first version compared the live row to its baseline exactly. It reported
**nothing**, on an install where every product was untouched, and a panel that
never appears looks exactly like a product with no such defect.

Printed rather than guessed at a third time:

```
baseline  { title, handle, status, variants: [{ sku, priceCents }] }
live      { title, handle, status, variants: [{ sku, priceCents }],
            tags: [], fulfillmentType: "physical", requiresShipping: true }
```

**Nobody typed those last three.** They are column defaults, written by the
database on insert. A value nobody chose must never be read as a choice
([[feedback_never_present_absence_as_measurement]]), and this is that rule
pointed the other way: reading a default as an edit reported every product in the
catalog as hers.

So the compare is over **the fields the baseline carries and nothing else**, with
absent, null, empty text and an empty list read as one thing. That is not a
loosening; it is the question stated correctly. The sentence on Home is about
what a VISITOR reads, not about whether a row has ever been written to.

A field she CLEARS is still an edit: the baseline has the words, the live row has
nothing, and the two sides disagree on a key the baseline carries.

## The direction that must never be wrong

There are two ways to be wrong here and they are not the same size.

**Saying nothing** when her shop is full of examples is the defect this fixes.

**Saying "this is still the example"** about something she wrote is telling a
business owner her own work is a placeholder. Everything in the read leans away
from it: a detached artifact was ejected on purpose, an unmanaged one is an orphan
the design no longer ships, a row she deleted is the opposite of untouched, and a
read that throws is not evidence of anything. Every one of those falls through
silently, so the panel may under-report and can never over-report.

## What Home says now

Only once she has **published**. Before that the examples are doing their job, and
telling her to clear her shop window before she has anything to put in it is not
help.

> **Your website is still showing the example things it came with**
>
> Your shop is selling **Rowan canvas tote, Rowan enamel mug, Rowan everyday tee
> and 3 more**. Those came with your design as examples, and anyone visiting can
> buy one. You are publishing **Launch your store in a weekend, Product
> descriptions that sell and Turn first-time buyers into regulars**, which were
> written as examples rather than by you. Change them to your own, or take them
> down. Nothing happens to them until you say so.
>
> **[Show me what I am selling]**

**One offer at a time, examples before pages.** An unedited About page says
nothing about the business; an unedited shop sells an invented brand's mug to the
business's customers. Two boxes on Home saying "your site is not yours yet" is a
wall she scrolls past, which is the same reasoning the site-behind panel next
door already carries.

**It is an offer, not a demand**, so it sits with its two siblings above "What
needs you" rather than in the quiet line. Nothing is late and nothing is waiting
on her.

**It changes nothing and hides nothing.** Her examples stay exactly where they
are. She may have wanted them.

## A natural key is not a sentence

The server answers with the manifest's own correlation keys:

```
slug:about    blog_post:launch-your-store-in-a-weekend    rowan-enamel-mug
```

A screen that prints one of those at a business owner is the thing this console's
vocabulary file exists to stop. Each becomes words she would recognise: `home` is
"your home page", `slug:blog` is "Journal", and anything unnamed is de-slugged so
it reads as a title. Three are named and the rest are counted, because listing
nine turns an offer into a wall and a bare number tells her nothing she can act
on.

## Proved

**24 tests**, in three places, and the DB-backed one is the one that matters:
install a design, assert every example is reported, then edit **one** product and
assert that one and only that one drops off. An edit to one thing must not quietly
silence the panel for everything.

```
api-rest   src/lib/blueprint-untouched.test.ts          10 · the rule
api-rest   test/integration/blueprint-untouched.test.ts  3 · against the real database
console    surfaces/builder/blueprints-untouched.test.ts 11 · the words
```

## Files

- `wizeworks/services/api-rest/src/lib/blueprint-untouched.ts` (new)
- `wizeworks/services/api-rest/src/lib/blueprint-untouched.test.ts` (new)
- `wizeworks/services/api-rest/src/lib/blueprint-updater.ts` (`reportUntouched`)
- `wizeworks/services/api-rest/src/routes/v1/blueprints/index.ts` (the new read)
- `wizeworks/services/api-rest/test/integration/blueprint-untouched.test.ts` (new)
- `piggles/apps/workbench/surfaces/builder/blueprints-untouched.ts` (new)
- `piggles/apps/workbench/surfaces/builder/blueprints-untouched.test.ts` (new)
- `piggles/apps/workbench/surfaces/home/still-the-example.tsx` (new)
- `piggles/apps/workbench/surfaces/home.tsx`

## The other half, in 851

What a stranger read on The Marrow Review was two things at once, and this fixed
one of them. The articles and the products are example **content**, copied in by a
design install, which is what this panel now names.

The **pages they were drawn on** were never published either: the magazine's
primary site has seven pages and has published none of them, so every page a
visitor loaded was the code starter, whose headline told the magazine to edit its
own homepage. That is
[851](851-four-of-my-seven-websites-were-live-and-none-of-them-was-mine.md), and
this panel could not have said it, because it keys on an install and a starter site
has none.

## The thing to remember

**The product knew, and had known since the install.** Twenty-three rows in a
table recorded exactly what it had put on her site and exactly what it looked
like when it arrived. Everything needed to say "a stranger is reading these words
and you did not write them" was already written down, by the feature that exists
to update designs, for a completely different purpose. The gap was not data and
was not machinery. Nobody had asked the question.
