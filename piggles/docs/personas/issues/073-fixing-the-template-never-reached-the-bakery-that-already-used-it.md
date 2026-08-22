# 073 — Fixing the template never reached the bakery that already used it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks
**Surface:** mypiggles › Home, and every tenant whose site came from a blueprint
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

Two content defects were found on Marisol's live site, traced to the blueprint
she installed from, and fixed there:

- [060](060-the-menu-on-her-website-named-no-money-at-all.md) — menu prices were
  bare numbers (`6.50`, not `$6.50`).
- [070](070-a-pet-shop-and-a-wine-merchant-promised-their-customers-studio-news.md) — the
  footer promised "new work, journal notes, and **studio news**".

**Her site still showed the old text for both.** Nineteen bare prices on `/bake`,
and every page still selling studio news — each one a literal text node in her own
published page tree, because a blueprint's content is COPIED into a site at
install and is hers from that moment.

## The diagnosis this was FILED with was wrong

It said: _"Nothing records which bundle a page came from, so nothing can compare"_,
and proposed building provenance from scratch.

**All of it already existed.** `TenantBlueprintInstall` carries the
`blueprintVersion`; `TenantBlueprintInstallArtifact` carries a stamped `baseline`
per artifact — the three-way-merge ancestor — plus `baselineVersion`, `managed`
and `detached`. There are `GET`/`POST /v1/blueprints/installs/:id/update`
endpoints, a `blueprint-baseline.ts` that captures and loads them, a whole
[docs/55-blueprint-updates.md](../../../../docs/55-blueprint-updates.md), and the
console **already had the update UI** in the blueprint detail pane. Marisol's own
install had **10 baselines captured**.

That is the [[feedback_verify_capability_in_code_not_docs]] failure, and the
memory records it as the fifth time. Reading one Prisma schema file before filing
would have caught it.

## The actual defect, which is smaller and worse

The update machinery decides there is something to offer by comparing the version
a tenant installed against the version in the catalog.

Marisol installed **`sparx-restaurant-cafe` 1.3.0**. After correcting its prices
and its footer, the bundle on disk was **still 1.3.0** — because I changed its
content and never bumped the version.

So the machinery worked perfectly and had nothing to say. The fix shipped, 1147
tests passed, two issues were marked fixed, and no existing tenant would ever have
been offered either of them.

Both harnesses carry the rule in a comment, four lines above the constant:

> `/** The payload version every service bundle ships. BUMP on any content change — a`
> ` *  marketplace artifact is IMMUTABLE per (category, slug, version), so without a bump`
> ` *  the catalog keeps serving the OLD payload. */`

Nothing enforced it.

## Why it matters

A silent no-op that reports success. The repo's own worst failure shape: green
build, closed issue, unchanged tenant — and the number of tenants carrying the
defect only grows with adoption.

## The fix — three parts

**1. The 52 bundles whose content changed were bumped**, in both places the
loader requires (it refuses a bundle whose `sparx.json` and payload versions
disagree), plus the `BUNDLE_VERSION` in both generator harnesses so a regeneration
agrees. Café is now **1.3.1** against her installed **1.3.0**, so the update is
detectable at last. All 191 bundles still validate.

**2. Home tells her.** New
[surfaces/home/template-update.tsx](../../../apps/workbench/surfaces/home/template-update.tsx),
rendered right under the first-run panel, and nothing at all when every installed
design is current:

> **The design your site was built from has been improved**
> You started from **Café**, and it has been corrected since. It has 2 things
> corrected. Anything you have written or changed yourself stays exactly as it is
> — nothing of yours is overwritten.
> **[See what changed]**

"2 things corrected" comes from the plan endpoint, which is read-only and writes
nothing. Where the plan has not arrived the sentence simply omits it rather than
guessing a number — [[feedback_never_present_absence_as_measurement]].

It is an **offer**, so it deliberately sits outside "What needs you" and out of
the quiet line. Nothing is waiting on her and nothing is late; folding it in would
make it one more thing to be reassured about.

**3. A guard, so it cannot recur.**
[scripts/check-blueprint-versions.mjs](../../../../scripts/check-blueprint-versions.mjs)
fails when any file under a bundle changes — except `media/**`, which is
marketplace art and re-stages by byte length — without `sparx.json`'s version
moving. Wired into `pnpm check:blueprint-versions`, the pre-push hook and its own
CI job, alongside the sixteen other structural checks.

## Confirmed by

Re-run as Marisol on 2026-08-21. Her Home now reads:

> Good morning, Marisol. One thing is waiting for you.
>
> **The design your site was built from has been improved** — You started from
> Café, and it has been corrected since. It has 2 things corrected. …
> [See what changed]

The alert resolves to `alert alert-module alert-soft` — the Builder hue, no
`neutral`. Clicking **See what changed** opens the blueprint pane, which shows
**"Update available · Version 1.3.1"** with its existing Update button.

**The guard was proved in all three directions**, in a throwaway detached worktree
(no branch moved, nothing in the real tree touched):

| case                                | result                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| content changed, version NOT bumped | **FAILED**, naming the bundle and the stale version — exit 1     |
| same change, version bumped         | `OK: 1 blueprint(s) changed content, all with a bumped version.` |
| `media/preview.png` only, no bump   | passes, as it must                                               |

Worktree removed afterwards; `git worktree list` clean.

## What is still true and still hers

**Her live site is not retroactively fixed by any of this, and must not be.** The
words are in her published pages and they are her content. What changed is that
the product now _offers_ — she decides. Applying it keeps every edit she has made
(docs/55 U1; conflicts resolve to her value).
