# 090 — Piggles offered to sell her a domain, from another company's shop

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › Domains
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Nia went looking for a better web address than the one she had been given
([089](089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)),
and the Domains pane offers her two things:

| Button               | What it does                                       |
| -------------------- | -------------------------------------------------- |
| **Get a domain** ↗   | opens **shop.sparx.works** in a new tab            |
| **Connect a domain** | the real thing — point one you already own at this |

The first one sends a Piggles customer to a **sparx** shop. It carries a tooltip
that says so out loud, because below a certain width it is icon-only:

> Get a domain — opens shop.sparx.works

## What should have happened

Nothing there at all. Piggles does not sell domains. sparx.works is a different
product with a different brand, a different price list and a different signup,
and a Piggles customer buying from it is buying from a company she has never
heard of, in a tab she did not expect, on the strength of a Piggles button.

This is named in piggles/CLAUDE.md, under "A sparx PRODUCT is not a Piggles
capability", along with the three ways to get it wrong. Two of them apply here:

- **Renaming** it "shop.piggles.com" would be worse than leaving it, because the
  sentence would then read correctly and be false.
- **Leaving it** is "a bug with a support ticket attached" — and this one has a
  charge on a card at the end of it, not just a confused customer.

The rule's own conclusion for anything not argued: **exclude.**

## How to reproduce

Every time.

1. `mypiggles` › search "web address" › **Domains**.
2. Read the toolbar.

## Why it matters

It is the strongest form of the leak in the whole console, because it does not
merely mention another product — it invites a purchase from it. Every other
instance found so far was a screen or a label; this one takes her to a checkout.

And a domain is exactly the thing this customer is most likely to click. She has
just been shown that her free address is a random word and a number, and the
button next to it says "Get a domain".

## Where it lives

[surfaces/domains/domains-list.tsx](../../../apps/workbench/surfaces/domains/domains-list.tsx)
— the toolbar's `controls` slot, rendering an anchor to `DOMAIN_SHOP_URL` from
[surfaces/domains/data.ts](../../../apps/workbench/surfaces/domains/data.ts),
which is the literal `https://shop.sparx.works`.

Both files are Piggles' own copies, inherited wholesale from sparx's console at
the 2026-08-14 tree split. The comment above the button explains the sparx
reasoning perfectly and was carried across without anybody asking whether it was
still true for this product:

> Buying is not part of this surface yet, so "I don't have one" is answered with
> a real place to get one rather than a dead button.

## The fix

**Deleted, not hidden.** `hiddenFeatures` is the right seam for a block inside a
surface Piggles SHARES with sparx, which is what `commerce.channels.market` and
`commerce.payments.sparx_pay` are. This file is not shared: the tree split on
2026-08-14 gave Piggles its own copy of every surface, and piggles/CLAUDE.md is
explicit that Piggles' copy is Piggles' — "change it directly rather than adding
a conditional". A flag whose value is a constant in the only app that reads it is
ceremony over dead code, so the button and its URL are gone.

The URL went with it. `DOMAIN_SHOP_URL` is deleted from
[surfaces/domains/data.ts](../../../apps/workbench/surfaces/domains/data.ts), and
that file's header now says buying stays absent and why, rather than explaining
how to send somebody to sparx for it.

**Connect a domain stays and becomes the whole surface.** It is a real shared
capability: she buys a domain wherever she likes and points it here, which is
what the pane's other button, its empty state and its DNS instructions are all
about.

**The `neutral` went with it.** The removed button was the pane's only
`color="neutral"`, which needs Brandon's approval every time (root RULE #4); it
came across in the same copy-paste and is now moot.

**And the file got split**, because Piggles' own RULE #0.5 caps a file at 250
lines and this one was 334 before the edit. `AddressRow` — one row of the list,
its live-link rules and its badges — moves to
[surfaces/domains/address-row.tsx](../../../apps/workbench/surfaces/domains/address-row.tsx).

## Confirmed by

Re-run as Nia on 2026-08-21. `mypiggles` › Domains:

- The toolbar reads **1 address · Search addresses… · Connect a domain ·
  refresh**. **No "Get a domain".**
- `shop.sparx.works` appears nowhere in the pane, in its markup, or in its
  tooltips.
- **Connect a domain** still opens the setup pane, so the capability she
  actually has is untouched.

## Rating effect

`Domains` is scored in [rating.md](../rating.md).
