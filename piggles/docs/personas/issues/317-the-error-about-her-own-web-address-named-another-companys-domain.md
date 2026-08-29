# 317 — The error about her own web address named another company's domain

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · confirming [316]
**Surface:** mypiggles › Settings › Web addresses
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the four sentences are gone from the tree, and a new `check:boundaries` rule was shown red on one of them before being trusted green

## What happened

While confirming [316] on the Web addresses pane, the sentences the pane can show
turned out to name the wrong product. If Devi tries to remove the address that came
with a site, she is told:

> The sparx.zone subdomain is the site's permanent address and cannot be removed.

Her address is `juniper-row.piggles.site`. She has never heard of sparx.zone, there is
nothing on her screen called that, and the sentence is refusing her in a vocabulary
belonging to a different company's product.

Four of them, all reachable from this one pane:

| She does                                 | She is told                                                     |
| ---------------------------------------- | --------------------------------------------------------------- |
| Removes the address her site came with   | "The sparx.zone subdomain is the site's permanent address…"     |
| Tries to buy an address she already has  | "sparx.zone domains cannot be purchased…"                       |
| Tries to connect one                     | "sparx.zone subdomains cannot be connected."                    |
| Acts on an address she connected herself | "This operation is only available for sparx-purchased domains." |

And one more the staff see, on the operator console's re-verify: "This is an automatic
sparx.zone address — it is always live and needs no verification", printed beside a
`piggles.site` host, where it is not merely off-brand but **false**.

## What should have happened

A sentence about her address names her address, or names nothing. Every one of these
is a refusal, and a refusal is the worst possible place to introduce a word the person
reading has no way to look up — she cannot tell whether she has hit a rule, a bug, or
somebody else's system.

## How to reproduce

Every time, on any Piggles tenant.

1. Open **Settings › Web addresses**.
2. Try to remove the address a site was created with.
3. The refusal names `sparx.zone`.

Or read them straight out of the source:

```
grep -n "sparx" wizeworks/services/api-rest/src/routes/v1/domains.ts
```

## Why it matters

**It is the exact thing `wizeworks/CLAUDE.md` RULE #0 forbids** — "No product names in
user-facing strings. No 'sparx', no 'Piggles', no 'Workbench'." Not a style preference:
`api-rest` serves both brands from one process, so a product name compiled into a
sentence is right for one tenant and wrong for the other, always.

**A refusal is where trust is cheapest to lose.** She was stopped from doing something,
and the reason given was unintelligible. The likely next move is a support ticket, and
the likeliest guess she makes is that her account is somehow on the wrong system.

**The operator one is worse than off-brand — it is untrue.** Staff reading "an automatic
sparx.zone address" next to `journal.juniper-row.piggles.site` learn to discount what
the screen says, which is exactly the habit an operations console must not teach.

## Where it lives

[wizeworks/services/api-rest/src/routes/v1/domains.ts](../../../../wizeworks/services/api-rest/src/routes/v1/domains.ts)
— the purchase guard, the connect guard, the delete guard, and `findPurchasedDomain`.
[wizeworks/services/api-rest/src/routes/internal/operator-domains.ts](../../../../wizeworks/services/api-rest/src/routes/internal/operator-domains.ts)
— the re-verify no-op message.

**And the reason nobody caught them: the guard that exists for this deliberately skips
them.** `check:boundaries`' brand-prose rule ends its brand-word pattern with `(?!\.\w)`,
so a brand name followed by a dot is exempt. That exemption is right — measured across
2,547 files it covers eighteen sentences, and seventeen of them are legitimate:
`sparx.navbar` is a block id, `sparx.json` is a filename on disk, and `sparx.market` is a
sparx PRODUCT that `piggles/CLAUDE.md` excludes from Piggles rather than renames.

`sparx.zone` is the eighteenth, and it is not like the other seventeen: it is the
**tenant's own address**, and it differs per brand. So the one dotted token that had to
be caught was the one the exemption was written to let through.

## The fix

**1. The five sentences name no zone.** Each of them had a host or a site in hand
already, so the honest sentence was shorter than the wrong one:

- "That address already comes with your site, so there is nothing to buy."
- "That address already comes with your site and is always on."
- "The address that came with this site is its permanent one, so it cannot be removed."
- "This only applies to a domain you bought here, not one you connected."
- The operator message now interpolates `row.host`, which is both correct under every
  brand and more useful to whoever is reading it.

They also drop "subdomain", "host" and "operation", which were jargon on top of the
brand leak — this pane is read by people who bought a domain name once
([[feedback_non_technical_audience]]).

**2. A new `check:boundaries` rule, narrow on purpose.** Relaxing the existing
dotted-token exemption would fire on all eighteen and become a rule somebody switches
off — which is the trap the hex-rule note at the bottom of that same script already
describes. So `checkZoneProse` is its own rule and matches only a **zone literal inside a
sentence**. Zero hits across 2,547 files today, no exception list, and it should keep
both properties: a sentence that genuinely needs a zone has a host or a tenant nearby to
read one from.

The rule prints its denominator on success — `✓ zones named in a sentence under
wizeworks/: 0 (2547 files)` — because this repo has shipped five checks that scanned
nothing and reported green ([[feedback_structural_checks_go_blind]]), and it fails
outright if its scan ever returns no files at all.

## Confirmed by

**The rule was shown RED before it was trusted green**, which is the repo's own bar for a
new guard. Putting one removed sentence back:

```
✖ a tenant's own zone, named in a sentence — 1:

   wizeworks/services/api-rest/src/routes/v1/domains.ts:729: The sparx.zone subdomain is …

   A tenant's address zone differs per brand, so a sentence naming one is
   wrong for every tenant who is not on it. Read it instead: tenantZone(id)
   in api-rest, or name the host the row already has.
```

Restored, and `pnpm check:boundaries` reads `✓ zones named in a sentence under
wizeworks/: 0 (2547 files)` with the other three rules still green.

**Not driven on screen.** These are refusals, and reaching all four as the owner means
deliberately breaking four different rules on a live tenant. What was proved instead is
that the sentences no longer exist in the tree and that a guard now fails the push if one
returns. The measurement that found them — eighteen dotted-token sentences, seventeen
legitimate — is recorded above so the judgement can be re-checked rather than taken on
trust.

## Rating effect

None recorded. The pane itself was not re-scored — the defect is in sentences that only
appear on refusal, and none of them are on the pane at rest.
