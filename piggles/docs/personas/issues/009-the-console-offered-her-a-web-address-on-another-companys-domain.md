# 009 — The console offered her a web address on another company's domain

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 3
**Surface:** mypiggles › Get set up wizard and the story flow (site address, launch, summary)
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran the check across `piggles/` — no rendered `sparx.zone` remains; every site address is built from `PRODUCT.tenantSites.suffix`, which is `piggles.site`
**Blocked on:** —

## What happened

Act 3 checks the spine in the database, and one of its lines is blunt: _"the
subdomain is on **`piggles.site`**, never `sparx.zone`"_.

The database is right — Marisol's site is `quiet-haven-3783.piggles.site`, and
the Site identity pane says so. But the console's own setup flows had the other
brand's domain typed into them as a literal, in eight places:

```
apps/workbench/lib/onboarding/api.ts:145        `https://${slug}.sparx.zone`
apps/workbench/lib/onboarding/story-state.ts    ` Find me at ${slug}.sparx.zone.`
apps/workbench/surfaces/onboarding/story/story-canvas.tsx     <span>.sparx.zone</span>
apps/workbench/surfaces/onboarding/story/story-go-live.tsx    SITE_ZONE = 'sparx.zone'
apps/workbench/surfaces/onboarding/story/story-summary.tsx    {slug}.sparx.zone
apps/workbench/surfaces/onboarding/wizard/step-domain.tsx     SITE_ZONE = 'sparx.zone'
apps/workbench/surfaces/onboarding/wizard/step-launch.tsx     SITE_ZONE = 'sparx.zone'
apps/workbench/surfaces/onboarding/wizard/step-workspace.tsx  SITE_ZONE = 'sparx.zone'
```

Plus a sentence in `wizard.tsx`: _"…or start free on your **sparx.zone** address
and add a domain anytime."_

## What should have happened

Every address a Piggles customer is shown is on `piggles.site`. `sparx.zone`
belongs to a different product from a different brand, and Marisol has no account
there — the address is not merely off-brand, it does not resolve for her.

## How to reproduce

Static, and reliable:

```
cd piggles && grep -rn "sparx\.zone" --include=*.ts --include=*.tsx .
```

Eight rendered occurrences before the fix. On screen, the story flow's canvas
shows `<your-name>.sparx.zone` as the address it is about to give you.

## Why it matters

piggles/CLAUDE.md is explicit that a sparx product is not a Piggles capability,
and that renaming is the worst of the three ways to get it wrong because it makes
a false sentence read as a correct one. This is the same family and slightly
worse: it is not even renamed, it is the other brand's domain shown to a customer
as their own.

Concretely: somebody who copies that address down, or gives it to a customer, has
an address that does not exist. And the "Preview" button on the launch step
pointed at it in production.

## Where it lives

Listed above. The suffix has been a brand token since Piggles existed —
`PRODUCT.tenantSites.suffix` in `piggles/packages/config/src/product.ts`, with a
note explaining exactly why it is a separate registrable domain — and these
surfaces were copied from sparx's workbench during the 2026-08-14 detachment with
the literal still in them.

## The fix

Every rendered occurrence now reads `PRODUCT.tenantSites.suffix`. The four
`const SITE_ZONE = 'sparx.zone'` declarations become
`const SITE_ZONE = PRODUCT.tenantSites.suffix`, each carrying a one-line note so
the next person does not retype the literal. The wizard's sentence was rewritten
as a template string, and while it was open, "Grab the perfect one now" /
"a custom domain" became "Set one up now" / "a web address of your own" — the
console does not sell domains and should not sound like it is (RULE #2).

The remaining `sparx.zone` matches in `piggles/` are all comments, several of
them the new notes pointing back at this issue.

## Confirmed by

> Re-ran the sweep after the change: `grep -rn "sparx\.zone"` over `piggles/`
> returns comment lines only — no string, template or JSX renders it. Reloaded the
> console as Marisol and re-read **Get set up**; the site-address row and every
> address the flows show are on `piggles.site`, matching the
> `quiet-haven-3783.piggles.site` the Site identity pane and the database both
> carry.

## A related thing this run found, filed separately

Her web address is **`quiet-haven-3783`.piggles.site** — a random two-word phrase,
not her business name. That is issue #010; it is a different defect with a
different cause, and fixing this one does not touch it.

## Rating effect

None on its own — the surfaces carrying it are scored under their own rows.
