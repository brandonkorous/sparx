# 002 — Doty pressed "Activate B2B" and nothing happened

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** sparx.works › B2B (and 18 other marketing pages)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — Activate B2B on /b2b opened the local Create account screen
**Blocked on:** —

## What happened

Doty read sparx.works/b2b, decided this was what Gillett needs, and pressed the
big **Activate B2B →** button in the hero. Nothing happened. The page did not
move, no new tab opened, no message showed. The same is true of the second and
third **Activate B2B** buttons further down the page.

Counted with a parser across the whole marketing site: **40 call-to-action
buttons on 19 files lead nowhere.** Every "Activate …", "Start selling →", "Start
your site →", "Connect your AI →", "Turn on your concierge →", "Switch CRM on →",
"Start free", "See pricing" and "Talk to sales" on the module pages and the
platform page was a plain `<button type="button">` with no link and no handler.

And the buttons that DID work went to the wrong place in dev: the header's
**Start free** and **Sign in**, and every `signupHref()` link, were hard-coded to
`https://app.sparx.works`, the live app. A sign-up started on a laptop opened the
production workbench, where it would have created a real account.

## What should have happened

"Activate B2B" takes him to create his account (the page also says "Start free for
14 days; no card to begin"). In dev, every sign-up link goes to the local
workbench.

## How to reproduce

1. http://localhost:3003/b2b
2. Press **Activate B2B →**. Nothing happens. Every time.
3. Hover the header's **Start free**: it points at `https://app.sparx.works/sign-up`.

## Why it matters

The module pages are where a business decides to buy. Their main button did
nothing, on 15 module pages plus the platform page. Every one of those visitors
had to find the small header button instead, or left.

## Where it lives

- `sparx/apps/web/components/marketing/*` — 40 `<Button>`s with no `href`,
  `onClick`, `render` or wrapping link. Found with a TypeScript-parser scan (a
  grep cannot tell a button inside a link from one that is not).
- `components/marketing/cta.ts` and `nav.tsx` hard-coded `https://app.sparx.works`;
  `lib/marketplace.ts` and `lib/partners.ts` each kept their own copy reading
  `SPARX_APP_URL`, with the same production fallback.

## The fix

- All 40 dead buttons are now real links (`<a href … className={buttonClasses(…)}>`,
  the pattern finance-page and customers-page already used), each to
  `signupHref('<module>-<hero|pricing|final>')`, `SALES_HREF` or `/pricing`. The
  shared `module-page.tsx` carries `meta.module` in the `ref`.
- `cta.ts` now owns the one `APP_BASE`: `SPARX_APP_URL`, else the local
  workbench (`http://localhost:3011`) in development and the live app in a
  production build. `nav.tsx`, `lib/marketplace.ts` and `lib/partners.ts` import
  it instead of keeping their own.
- Left alone on purpose: the two header drawer icons (they open the mobile menu)
  and the "Publish" button inside a drawing of the CMS editor (a picture of the
  product, not a CTA).
- Not changed: three of these CTAs were already `color="neutral"`
  (commerce pricing strip, CRM hero ×2). RULE #4 makes that Brandon's call, so
  they keep the color they had.

Sibling check: the parser scanned all 339 `.tsx` files in `sparx/apps/web`.

## Confirmed by

> Re-ran P01 act 1. Reloaded http://localhost:3003/b2b and pressed **Activate B2B →** in the hero. It is now a link, and it opened http://localhost:3011/sign-up?ref=b2b-hero: "Create your account · sparx Workbench", "Start your story".

Checks: web `tsc --noEmit` exit 0; `eslint` on the 24 changed files exit 0; prettier clean.

## Rating effect

—
