# 266 — Her journal published the vendor's advice on running a shop

**Status:** fixed (the blueprints) · fixed (her site)
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — reading the Journal as a visitor
**Surface:** the tenant's public Journal, installed by the blueprint
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi's Journal, live, in this order:

```
The case for fewer clothes
How to launch your online store in a weekend        ←
How to read a fabric
Writing product descriptions that actually sell     ←
Five ways to turn first-time buyers into regulars   ←
Caring for knitwear so it lasts
```

Three of her six posts are the platform's advice to a SHOP OWNER, published
under her name for her CUSTOMERS to read. She writes about fabric and fit; in
between sits a laptop photograph and a plan for opening an online store in a
weekend.

She never wrote them, never published them, and was never asked. They arrived
with the blueprint, `status: 'published'`, on the day she installed it.

## Why it matters

- **Her journal is the premium.** Small-batch clothing sells on the maker being
  the maker. An article about conversion rate says a stranger writes this site.
- **It is published, not drafted.** The legal pages installed by the same
  blueprint arrive as DRAFTS, because publishing is the owner's act. Blog posts
  did not get that treatment, so a business's public voice was used without it
  ever asking.
- **It is not just her.** The same three posts shipped in **22 blueprints**,
  including `sparx-clinic` (dental and medical practices), `sparx-ledger`
  (accountancy), `sparx-garage`, `sparx-salon`, `sparx-petal` (florists) and
  `sparx-lodge`. A dental practice's news page opened with "Writing product
  descriptions that actually sell".

## Where it lives

`marketplace-catalog/blueprints/<key>/content.json`. Of 94 blueprints that ship
journal content, **72 do it properly** — an electrical wholesaler ships "Sizing
cable and breakers", a coffee roaster ships "Dialling in for your cafe". The
other **22 shipped the same three** and nothing of their own:

```
piggles-starter  sparx  sparx-academy  sparx-boutique  sparx-cellar
sparx-clinic     sparx-field    sparx-gallery  sparx-garage   sparx-harbor
sparx-hearth     sparx-kitchen  sparx-ledger   sparx-lodge    sparx-petal
sparx-press      sparx-salon    sparx-signal   sparx-stage    sparx-studio
sparx-summit     sparx-workshop
```

The three live in the golden `blueprints/sparx`, whose header comment called
them "the 3 universal journal posts". `gen-sparx-themed.ts` copies the golden's
content into all 21 clones, and `gen-piggles-showcase.ts` rebrands it — so one
fallback nobody replaced reached 22 kinds of business.

## The fix

**The 22 ship no journal content.** An empty journal is honest and the owner
writes the first post; a journal full of somebody else's trade is not. The 72
that have real posts are untouched.

Versions bumped in all four places the loader and the update machinery read —
`sparx.json`, `blueprint.ts`, and the two generators that emit them — so every
tenant who already installed one is OFFERED the correction rather than silently
left with it (that is `check-blueprint-versions.mjs`'s whole point, and skipping
it is how a bakery kept showing prices with no currency for two days after they
were "fixed").

**And a guard.**
[check-blueprint-journal.mjs](../../../../scripts/check-blueprint-journal.mjs)
fails a blueprint whose journal is made entirely of posts other blueprints also
ship. Sharing one is fine — two candle shops both want "Get a clean, even burn",
and each has two of its own — but a blueprint with NOTHING of its own has no
journal of its own, which is exactly what the fallback looked like. Wired into
`pnpm check:blueprint-journal` and the pre-push guard beside
`check:blueprint-versions`.

Proved red by giving `sparx-clinic` a journal of one borrowed post:

```
NOT ITS OWN  sparx-clinic
             every post it installs is also installed by another
             blueprint: get-a-clean-even-burn
```

Green now, with its denominator printed:
`72 of 94 blueprints ship journal posts, every one with a post of its own (242 distinct posts).`

## Her site

Deleted all three as Devi, through Sell → Content. The flow is good: each post's
History said **"Version 1 · latest — Aug 23, 2026 · Installed from template"**,
which is exactly the provenance a person needs to feel safe deleting something;
the confirm named the post and said what could not be undone; the list refreshed
and a toast said which one went. Her Journal is now her three apparel posts.

## Not fixed, and named

**The 22 now install with no journal posts.** Writing three real posts per trade
— 66 in all, the way the other 72 blueprints have — is a content project of a
different kind and is not something to invent for a dental practice in the
middle of an apparel run. The defect (wrong content published under a business's
name) is closed; the gap (those blueprints demo no journal) is stated here
rather than left to be discovered.

## Related

Third instance of [263]'s cause and the worst of the three: blueprint content is
COPIED at install and is the tenant's from that moment, so a fix in this repo
never reaches a site already built from it. The tagline was a sentence; this was
three articles.

[[feedback_never_present_absence_as_measurement]] — nobody wrote a journal for
these 22, and the platform rendered somebody else's as if they had.

## Rating effect

The Journal, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
