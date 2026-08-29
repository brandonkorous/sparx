# 313 — Every design was a release behind, so her customers could not get back to their account

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · carry-forward review
**Surface:** mypiggles › Site › the header and footer every design ships
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** driven as Devi on 2026-08-28 — both halves; see the bottom

## What happened

Juniper Row's site was installed from the **Fashion Boutique (Minimal)** design. Its
live header carries an account link and its footer carries the privacy and terms
links, so a shopper can reach the orders and returns screens the last two acts were
spent building. That is not what the design ships. It is what the platform HEALED
after Devi opened the builder.

The design's own frame carries two host cores and nothing else:

    site.brand ×2, site.theme-toggle ×1

What the platform composes today is:

    site.brand ×2, site.account-link ×2, site.theme-toggle ×1, site.legal-links ×1

Across all 191 shipped designs, as committed:

| the account link in the design's own header | designs |
| ------------------------------------------- | ------- |
| the live `site.account-link` core           | **0**   |
| a stamped "Sign in" anchor                  | 167     |
| nothing at all                              | 24      |

Nought. The core has been in the composite since issue [291] and had reached not one
design. And in the footer, 47 of the 191 carried no legal links — 46 of those sell
things.

Across the sites actually live in this database (22 published frames):

| what the published header carries | sites |
| --------------------------------- | ----- |
| the live account core             | 1     |
| a stamped "Sign in"               | 15    |
| nothing at all                    | 6     |

The one is Juniper Row, and only because Devi opened the builder and published.
Six live shops have no route to an account anywhere in their chrome, and six have
no route to a privacy policy or terms.

## What should have happened

A shop should ship with a way in to an account. Sign in, my orders, start a return:
all of it exists, all of it is built, and it is reachable from one of the twenty two
live sites.

A stamped "Sign in" is not the same defect but it is not fine either — it is exactly
what issue [291] was filed on: it tells a signed-in customer she is a stranger and
offers her no route to the account holding her orders. That fix landed in the
composite and had reached no shipped design at all.

## How to reproduce

Every time, on any design.

1. Install any design onto a fresh site.
2. Do not open the builder.
3. Visit the site. On 24 of the designs there is no account link at any width; on the
   other 167 there is a "Sign in" that still says "Sign in" after the customer has
   signed in.
4. On 47 of them the footer has no privacy or terms link.

Or read it off the source:

    grep -l 'site.account-link' marketplace-catalog/blueprints/*/site.json | wc -l   # was 0 of 191
    grep -l 'site.legal-links'  marketplace-catalog/blueprints/*/site.json | wc -l   # was 144 of 191

## Why it matters

**The customer sees it.** A shopper who buys from one of these sites has an account,
an order history and a returns flow, and no link to any of it. The self-service
returns work is unreachable from twenty one of the twenty two sites that are live.

**It says something false about the shop.** Forty six selling designs with no privacy
or terms link in the footer is not a styling gap.

**And it is silent.** The heal runs on the DRAFT at studio load and is deliberately
never applied to the published tree, which is the right call — the platform must not
rewrite somebody's live site. The consequence is that a site only improves if its
owner opens the builder AND presses Publish. An owner who installs a design, likes it,
and never goes back keeps the day-one chrome forever, and nothing tells anyone.

## Where it lives

Three separate holes, which is why the count was zero rather than merely low.

**1. The bundles were never regenerated.** All three harnesses already build their
frame from the live composite, so no generator was wrong — the committed JSON was just
older than the composite.

- [marketplace-catalog/\_gen/template-sites/harness.ts](../../../../marketplace-catalog/_gen/template-sites/harness.ts)
- [marketplace-catalog/\_gen/service-sites/harness.ts](../../../../marketplace-catalog/_gen/service-sites/harness.ts)
- [marketplace-catalog/\_gen/portfolio-sites/harness.ts](../../../../marketplace-catalog/_gen/portfolio-sites/harness.ts)

**2. One navbar variant had nowhere to put the link.** `fillSlots` fills only the slots
a block HAS, and `centerLogo` declares no `secondary`, so `withHostAccountLink` found
nothing to swap and that variant shipped no account link at all. That is the 24. **The
identical hole in the footer was closed by `ensureLegalLinks` and the navbar's was left
open** — the comment above `ensureLegalLinks` describes this exact failure, about a
different slot, and the fix was never carried across.

- [wizeworks/packages/silica-catalog/src/site-chrome.ts](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts)

**3. The heal could not see an older frame.** `upgradeFrameChrome`'s account rule matched
on `slot.name === 'secondary'` — the handle the platform's own fill writes. True of a
frame the current composite built; false of the ones that most need repairing. The golden
`sparx` bundle is a CAPTURE of a hand-authored navbar whose sign-in links carry no slot,
and 21 designs are clones of it. The rule matched none of them, and did nothing for the
fifteen live sites.

- [wizeworks/packages/silica-catalog/src/upgrade-frame.ts](../../../../wizeworks/packages/silica-catalog/src/upgrade-frame.ts)

## The fix

**1. `ensureAccountLink`, the twin `ensureLegalLinks` never got.** Whatever the navbar
variant, the account core is in the header: appended to the bar's end zone and to the
phone panel, in the two classes the block's own `secondary` fill produces. A no-op when
the fill already placed it, so `brandLeft` and `centerLinks` are unchanged byte for byte.

**2. The heal matches the seeded ADDRESS, not the slot.** Safe for the same reason the
legal pair is: matched literally, and strictly better in both directions. A stranger
still gets "Sign in" pointing at the sign-in form; a signed-in customer gets her own
account instead of an invitation to sign in again. An author who repointed the link keeps
their own link.

**3. All 191 designs regenerated, with the version bumped.** The bump is not optional: a
marketplace artifact is immutable per `(category, slug, version)`, so a regenerated
payload at the same version is written once and skipped forever and no fresh install
would ever see it. `1.4.2 → 1.5.0` (templates), `1.3.3 → 1.4.0` (services),
`1.2.1 → 1.3.0` (portfolios), `1.4.0 → 1.5.0` (themed clones), `1.2.0 → 1.3.0` (piggles).
The two generators that clone the golden CAPTURE now run it through
`upgradeFrameChrome` first, so an installing tenant gets the current chrome on day one
rather than on a builder visit many never make.

**4. A guard, in [blueprint-chrome.test.ts](../../../../wizeworks/packages/site-lint/src/blueprint-chrome.test.ts).**
Every design's frame must carry every host core the composite emits for every module
combination, either as shipped or provably after the heal. Written against
`starterFrame()` rather than a list of names, so the next core the composite grows is
covered without anyone remembering to come back. It went red on 238 findings before the
fix and green after — the drift had been shippable the whole time with nothing anywhere
to say so, which is the shape [[feedback_structural_checks_go_blind]] describes.

### And one the regen turned up

All six portfolio generators had been failing since the tree move: their preview step
wrote a temp file to `apps/site/`, which became `wizeworks/apps/site/`. The bundle was
already written by then, so each run printed a valid bundle AND a stack trace, and the
preview silently stopped being produced. The template previews had been fixed for the
same move; the portfolio copy of the line was missed. It now uses the one shared
resolver, which asserts the directory exists and says what to change when the tree
moves again.

## After

| in the design's own frame | before     | after   |
| ------------------------- | ---------- | ------- |
| `site.account-link`       | 0 of 191   | **190** |
| `site.legal-links`        | 144 of 191 | **191** |

The one remaining is `sparx` itself, the captured golden bundle no generator writes.
The guard passes it because the heal demonstrably supplies the core on install, not
because it is waved through — the day the heal stops covering it, the guard goes red.
Bringing the bundle itself forward needs the Template property opened in the studio
(which heals its draft) and re-captured.

## The 22 already-published sites, and telling them

The heal reaches a DRAFT, so a site already published keeps the chrome it has until its
owner publishes again. That is the right blast radius and it does not change — the
platform must not rewrite somebody's live site. What had to change is that **nobody was
ever told.**

`liveChromeGaps` in
[live-chrome-gap.ts](../../../../wizeworks/packages/silica-catalog/src/live-chrome-gap.ts)
answers "what are visitors not getting", from two sources, because there are two ways to
be behind and only one of them was visible:

- **The saved draft has it.** She opened the builder, the repair ran, it is waiting on a
  publish. A draft-versus-published diff finds this.
- **The repair WOULD add it.** She has never opened the builder, so nothing has run and
  her draft is exactly as old as her live site. A diff finds nothing — the two agree, and
  they are both stale. This is the common case and the invisible one, so the published
  tree is run through the repair in memory to ask what it would gain. Nothing is written.

Derived, never stored: no migration, nowhere to clear, and it disappears the instant the
live site has it.

It surfaces in two places, because the owner who most needs telling is the one not
opening the builder:

- **Home** — [site-refresh.tsx](../../../../piggles/apps/workbench/surfaces/home/site-refresh.tsx),
  a sibling of the existing "the design your site was built from has been refreshed"
  offer, for the same reason: nothing is late and nothing is waiting on her, so it is an
  offer rather than a line in "What needs you". _"Your live site is behind the one you
  have saved. Until you publish, the people visiting your site do not get these: …"_
- **Publish** — [publish-gaps.tsx](../../../../piggles/apps/workbench/surfaces/studio/publish-gaps.tsx),
  because that pane's one existing sentence was **"your header and footer have changes"**
  about changes she did not make and could not identify, which reads as a fault she might
  reasonably undo.

Run against the 22 live sites in this database: **15 are told their customers have no way
back to their account**, 2 about legal links, 1 a brand mark, 1 a theme toggle, and 5 are
told nothing because their live site is already current.

**What it deliberately will not say.** Both sources are conservative — the repair only
rewrites a node that is already there and never invents one — so an owner who removed a
control and published that is never nagged about it. The cost, stated rather than left to
be found: a site whose design never had a sign-in link is equally silent. Intent is not
recoverable from a tree.

That half is now **[314]**, filed and fixed the same day: "your site offers no way into
an account at all" is an advisory finding for the pre-publish check rather than an
unpublished change, so it is a `site-lint` rule gated on whether the tenant runs a module
that gives a customer an account. Measured there against the same 22 live frames, the
sites with no route ANYWHERE — not the live core, not a stamped link, not a footer link —
are **three**, of which two sell and are reported. The "6" in the header table above is a
narrower question than it reads as: it counts headers carrying neither the live core nor
the seeded stamped anchor, and three of those six do have a route in another shape.

## Confirmed by

Driven as Devi on 2026-08-28, both halves.

**The designs.** Added a second site to Juniper Row (**Juniper Row Archive**), installed
**Fashion Boutique (Minimal)** onto it, and published — WITHOUT opening the builder at any
point. The gallery offered **Version 1.5.0**, so the bump reached the console. On the site
itself:

- the header's top right carried the live account control, showing the signed-in
  shopper's own NAME rather than "Sign in" — which is what [291] asked for and what none
  of the 191 designs used to ship;
- both placements were present, the bar's and the phone panel's, each with the account
  component's own title;
- at 360px in an iframe the phone menu carried it as a full-width row under the nav links;
- the footer carried Privacy Policy and Terms of Service, resolved by the legal core.

**The telling.** Juniper Row's own Home showed **nothing**, which is the failure mode this
had to avoid — her live site is already current. The Archive site showed nothing either
while it was unpublished, which is the `neverPublished` guard. Then, with a stamped
"Sign in" published on the Archive site, Home said her customers have no way back to their
account, **Review and publish** opened the Publish pane, and publishing from there cleared
BOTH the Home panel and the Publish list.

**And it found a defect.** Following the panel's own instruction on the other of its two
sources led to a disabled button and two contradictory sentences on one screen — filed and
fixed as **[315]**. Adding the second site to drive this also turned up **[316]**.
