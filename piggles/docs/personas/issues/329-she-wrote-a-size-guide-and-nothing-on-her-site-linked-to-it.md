# 329 — She wrote a size guide, and nothing on her site linked to it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8, reading her own published site
**Surface:** mypiggles › My Site › Publish › Before you publish
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the check, run from her Publish pane, naming both pages

## What happened

Devi built a **Size guide** on August 26 and a **Shipping and returns** page later
the same afternoon. She published both. Both work.

Nothing on her site links to either one.

Her published header and footer point at eleven destinations. These are the
eleven, read off her live frame:

```
/  /shop  /about  /contact  /blog  /made-in-the-studio
/search  /cart  /account  /account/orders  /account/returns
```

Neither `/size-guide` nor `/shipping-and-returns` is among them, and no page body
links to them either. A visitor can reach them by typing the address and by no
other means.

## What should have happened

Something should have told her. Not stopped her, not fixed it for her — told her.

She did the hard part twice: she decided a size guide was worth writing, and she
wrote it. The part she missed is the part that takes four seconds, and it is the
part with no screen anywhere that shows it.

## Why it matters

**This is her most expensive page.** She sells knitwear and trousers online. The
one question that stops a sale, and the one that causes a return when it is not
answered, is _will this fit_. Her Ash Overshirt page discusses fit at length — the
cut, the shoulder, what to size up for — and does not link to the guide she wrote
to answer exactly that.

**Nothing about it looks wrong.** The page renders. It is in the sitemap. Open it
by address and it is exactly right. The only thing wrong with it is that the road
to it was never built, and roads are the one property of a page that nothing in
the console displays. She would find out from a customer, or never.

**She linked five other pages she made.** About, Shop, Contact, Journal and Made
in the studio are all in her menu. This is not somebody who does not know how to
add a link — it is somebody who added five and lost track of two, which is what
everybody does.

## Where it lives

`@wizeworks/site-lint` is the pre-publish check, and it had **26 rules**. One of
them, `link-broken`, proves that every link on the site points at a page that
exists. Nothing proved the reverse.

They sound like one check. They are opposite directions, and only one was
written:

| Direction                               | Checked             | Fails how                            |
| --------------------------------------- | ------------------- | ------------------------------------ |
| Every link points at a page that exists | yes — `link-broken` | loudly, on a "page not found" screen |
| Every page has a link pointing at it    | **no**              | silently, forever                    |

The outward direction got written because something visibly breaks. The inward
one did not, because nothing does — which is the same shape as [327], where a
URL naming a dead surface got an honest screen and a BUTTON naming the same dead
surface got silence. The platform keeps checking the direction that complains.

## The fix

**A 27th rule, `page-unreachable`**, in
[reach.ts](../../../../wizeworks/packages/site-lint/src/reach.ts). It reads the
same composed documents the link rules already walk, collects every internal
destination, and reports any page whose address is in none of them.

It is warning severity, matching this package's own definition: the page works,
so it is not an error; it is more than a wording nicety, so it is not a
suggestion. Nothing here can block a publish and this does not either.

**Conservative, because the false positive is the expensive one.** Three classes
are exempt on principle, and each of them is reached without an authored link:

- **The home page.** The address bar reaches it.
- **Record templates.** `/products/:handle` is a pattern, not a place — visitors
  arrive from a listing, one record at a time.
- **The storefront's own routes.** `/cart`, `/search`, `/account/orders` and the
  rest are reached by a cart core, a search box, and the account area's own
  navigation, none of which is an authored link this can see.

**Measured before it was trusted**, because a rule that fires on working sites is
a rule somebody switches off:

- **191 shipped blueprints, 1,173 pages: zero.** Every starter site on the
  platform links every page it ships.
- **Devi's live site, 21 pages published: exactly two**, and they are the two.

No service change was needed. The API's site-check already hands the engine
`addressing` — every page the site has, including ones with no saved draft — and
the frame, for the duplicate-address rule that needed the same two things.

## Confirmed by

**Her screen.** **My Site › Publish › Check my site**, as Devi, reports 15 things
across 21 pages, and the first two, above every SEO suggestion:

> **Size guide** — Nothing on your site links to Size guide
> Size guide is part of your site and works perfectly if you already know its web
> address, but no link anywhere on your site points at /size-guide. Nobody
> browsing your site can get to it by clicking, so the only visitors who will
> ever see it are the ones who find it through a search engine. Add a link to it
> from your menu, from your footer, or from a page where someone would go looking
> for it.
> `/size-guide`

> **Shipping and returns** — Nothing on your site links to Shipping and returns
> `/shipping-and-returns`

Proved red before it was trusted green: with the rule unwired, the two tests that
assert it names her pages fail with `expected [] to deeply equal [ Array(2) ]`.
11 tests for the rule, 385 for the package, all passing.

**And the remedy it prints was followed, as Devi, to check it exists.** Advice in a
message is part of the contract, and a finding that sends someone somewhere that
cannot help them is its own defect ([[feedback_one_outcome_two_causes]]). It said
to add a link from her footer, so: **Design the header & footer**, select a footer
link, duplicate it, and the Settings panel asks for **Words** and **Goes to** in
those words, under the sentence "A page on your own site starts with a slash, like
/contact". Two links added to her Explore column, saved, published.

The check then reports **13 things across 21 pages instead of 15**, and both
findings are gone. Her live footer draws them:

```html
<a href="/size-guide" class="text-base-content hover:text-primary text-sm">Size guide</a>
<a href="/shipping-and-returns" class="text-base-content hover:text-primary text-sm"
  >Shipping and returns</a
>
```

Her published frame went from eleven destinations to thirteen. A customer reading
about the Ash Overshirt's fit can now reach the guide she wrote about fit.

## Rating effect

Against `My Site › Publish`. The check gains the one direction that could only
ever be found by a person, and the pane that already tells her what a visitor
will run into now also tells her what a visitor cannot run into at all.
