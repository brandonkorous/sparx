# Migration tracker

**Version:** 1.1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

The working checklist. Tick a box only when its **exit test** passes — not when
the code is written. Update `Last Updated` and the counts below whenever you tick
anything.

**Track A — decoupling:** 18 / 26 — A0, A1 and A2 complete, including the
transitive `cms-editor → ui → brand` chain that put sparx's brand package inside
the Piggles image. A3 (the rename), A4 (the tree move) and A5 (the deletability
job) are repo-wide restructures touching every sparx app, and are open.
**Track B — console:** 16 / 17 — everything except B4.3, which is a decision
rather than a build.
**Blocked right now:** nothing. The three cross-track edges (B2.3←A2.1,
B3.1←A1.4, B3.4←A1.3) all cleared when A1 and A2 landed.

**One thing to run before any of this typechecks:** `pnpm install`. Two new
packages (`@wizeworks/silica-corrections`, `@wizeworks/brand-core`) and eleven
new workspace edges — silica-corrections into six apps plus `@sparx/ui` and
`@sparx/cms-editor`, `@sparx/links` into `@sparx/auth` and `@piggles/account`,
brand-core into `api-rest` and `email-worker`. None resolve until the workspace
is linked, so a typecheck before that reports missing modules and means nothing.

Legend: ⬜ open · 🔶 in progress · ✅ done · ⛔ blocked · ❌ decided against

---

# Track A — break the `@sparx/*` dependency

## A0 · Guardrails — do this first

| ID   | Step                                                                                                                            | Exit test                                                             | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| A0.1 | Write `scripts/check-boundaries.mjs`, carrying over the two app-crossing patterns from `check-piggles-isolation.mjs`            | `pnpm check:boundaries` runs and is green                             | ✅    |
| A0.2 | Add rule 5 — a per-package baseline of `@sparx/*` counts in `piggles/` that may only fall                                       | Adding one `@sparx/query` import to a Piggles file turns it red       | ✅    |
| A0.3 | Add rules 3 + 4 (hex / brand-name literals under `wizeworks/**`), inert until A4                                                | Script runs; documents that rules 1, 3, 4 are dormant                 | ✅    |
| A0.4 | Wire into `package.json`, `.githooks/pre-push`, CI beside `check:events`                                                        | A push with a fresh `@sparx/*` import in `piggles/` is blocked        | ✅    |
| A0.5 | Retire `check-piggles-isolation.mjs`                                                                                            | No script references it; its patterns live in the new check           | ✅    |
| A0.6 | Split the rule in two: a **hard ban** on `@sparx/brand` / `@sparx/ui` that no baseline can absorb, and the ratchet for the rest | Appending a `@sparx/brand` import fails even with `--update-baseline` | ✅    |

**A0.6 came from the check being wrong in practice.** A single ratchet over all
34 packages is noisy where it matters least and silent where it matters most:
every new Piggles pane legitimately imports `@sparx/query` and `@sparx/api-client`
(the two largest counts), so the check fired constantly for the brand-blind infra
— and a brand leak, where the correct number is zero, could be baselined away
like anything else. Being able to do that is precisely how five sparx-mark render
sites survived the fork unnoticed.

Now: `@sparx/brand` and `@sparx/ui` fail at any count, `--update-baseline`
refuses to write while such a leak is present, and everything else ratchets. It
caught two real leftovers the moment it existed — `next.config.mjs` was still
transpiling both packages after the deps were dropped.

**The baseline is `piggles/docs/migration/sparx-usage-baseline.json`, and it went
UP once, on purpose.** 420 → 432, all of it Track B building capability that did
not exist: `@sparx/auth` +7 (the MCP consent screen and `/accept-invite`, which
are Better Auth flows and cannot be anything else), `@sparx/app-kit` +2 (the two
error boundaries need the stale-chunk helpers), `@sparx/links` +2 (the
brand-aware invite URL — the fix itself), and one measurement drift in
`@sparx/query` where `git diff` shows no import added at all.

That is the intended use of `--update-baseline`: a rise that is argued and
written down. It is NOT for making a red check green because the number is
inconvenient — if you cannot name what capability each increment bought, the
answer is to undo the import, not to re-baseline. The check ran red first and
caught this exact work, which is the evidence it functions.

## A1 · Evict sparx brand from `piggles/`

| ID   | Step                                                                                                                                                                                                                                                                                                     | Exit test                                                                         | State |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----- |
| A1.1 | `pane-waiting.tsx` — removed the `SparkMascot` branch entirely. **Correction: it was UNREACHABLE, not live.** Piggles registers `StateArt`, which draws every state including `waiting`, so the fallback could never run. A build-time dependency on another brand's art for a branch with no path to it | No `@sparx/brand` import; the loading pose is Piggles'                            | ✅    |
| A1.2 | `spark-field.tsx` — **deleted.** Its only consumer was `onboarding-gate.tsx`, itself unmounted                                                                                                                                                                                                           | File gone; no importer left                                                       | ✅    |
| A1.3 | `onboarding-layout.tsx` — **deleted `OnboardingHeader`**, which held the sparx wordmark AND signed out to a `/sign-in` that does not exist in the console. Only the gate rendered it. `OnboardingLayout` (reachable) stays and now imports nothing sparx                                                 | No `@sparx/brand` import; the reopenable wizard/story panes still work            | ✅    |
| A1.4 | `lib/tour/*` — **DELETED** (8 files + `driver.js`). Zero references anywhere; `surfaces/first-run.tsx` already replaced the first-run tour. Module tour offers have no Piggles equivalent — recorded, not silently dropped                                                                               | Files gone, dep gone, `data-tour` anchors left in place for a future Piggles tour | ✅    |
| A1.5 | Moved `silica-gaps.css` + `toast.css` into the new `@wizeworks/silica-corrections`; re-pointed all six apps. `toast.css`'s one brand statement (`box-shadow: none`) became `--toast-elevation`, defaulting to the current rendering for both brands                                                      | Piggles `globals.css` imports no `@sparx/*`; neither brand's toasts changed       | ✅    |
| A1.6 | Dropped `@sparx/ui` **and `@sparx/brand`** — both declared, both imported zero times                                                                                                                                                                                                                     | Neither appears in `piggles/apps/workbench/package.json`                          | ✅    |
| A1.7 | Phase gate                                                                                                                                                                                                                                                                                               | `grep -rE "@sparx/(brand\|ui)" piggles/` returns comments only                    | ✅    |

## A2 · De-sparx the shared packages

| ID   | Step                                                                                                                                                                                                                                                                                                                                                                                                         | Exit test                                                          | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----- |
| A2.1 | `packages/links` — `appOrigin(brand)`, variable name DERIVED from the brand key so the file names no brand; the `app.sparx.works` literal is gone and an unconfigured production origin now throws instead of guessing. **Plus `accountOrigin(brand)`** — see the note below                                                                                                                                 | 42 tests in `packages/links/src/server.test.ts`, all green         | ✅    |
| A2.2 | Threaded the brand through every caller that has a tenant: api-rest team (invites, role change), chat notify, email domains, tenant module toggle, operator feedback, Stripe billing webhook, domain-worker (handler + cron ×2), social-worker (×2), and `@sparx/auth`'s own invitation email. The two sparx-ONLY emitters (market payouts, partner programme) keep the default with the reason written down | No caller silently takes the default without a comment saying why  | ✅    |
| A2.3 | `packages/attribution` — `LAUNCH_LINKS` is sparx's own campaign data, not a mechanism, so it moved OFF the barrel to a `./launch-links` subpath rather than growing a fake brand lookup. Piggles imports the barrel and can no longer reach it                                                                                                                                                               | `@sparx/attribution`'s barrel states no brand value                | ✅    |
| A2.4 | `@wizeworks/brand-core` — **shipped, and it is not the token contract.** See below                                                                                                                                                                                                                                                                                                                           | 8 tests in `packages/brand-core/src/index.test.ts`, all green      | ✅    |
| A2.5 | Sweep the 29 remaining Class-1 packages for brand literals in code                                                                                                                                                                                                                                                                                                                                           | No sparx hostname / hex / product name outside a comment           | ⬜    |
| A2.6 | Break `@piggles/console → @sparx/cms-editor → @sparx/ui → @sparx/brand` — **done, and it was an hour, not a phase.** See below                                                                                                                                                                                                                                                                               | No `packages/{brand,ui}` in the console image; the ban enforces it | ✅    |

**A2.4 turned out to be load-bearing, and it is a different package than
planned.** The plan filed it as the token-contract split — which tokens exist,
values stay with each brand. What shipped first is the **identity** half: who the
platform is speaking AS. That got promoted because chasing the support-name
question surfaced a much larger leak underneath it.

`resolveEmailBrand` resolves the TENANT's brand — their logo, for their own
customers. It has no notion of the PLATFORM brand at all, so a tenant who has not
set up branding falls through to `@sparx/email`'s `defaultBrand`, which carries
`siteName: 'sparx'`. Worse, `wordmark.tsx` asked `siteName !== 'sparx'` to decide
whether a name was real — making one brand's name the literal definition of
"unbranded". **Every platform email to a Piggles tenant without branding arrived
wearing sparx's name, and no amount of configuring Piggles could have stopped
it.** Same class as the invite link, one layer deeper and far wider.

Fixed by: `platformBrandIdentity(brand)` reading `<BRAND>_BRAND_NAME` /
`_SUPPORT_NAME` / `_SUPPORT_EMAIL`; a `siteNameIsPlatformDefault` flag replacing
the string comparison; and email-worker overriding the fallback's name from the
tenant's `platformBrand`. Support replies are now signed by the tenant's own
product and carry its reply-to when one is configured.

**Deliberately NOT fixed: the fallback PALETTE.** A platform email to an
unbranded tenant still uses sparx's colours. What a brand-neutral platform email
should look like is a design question, and silently restyling every sparx email
while fixing a name would be smuggling one in. Open, and listed below.

**A2.6 was mis-filed as a phase-A3/A4 problem and was neither.** The chain was
held up by exactly two things: `cn`, a 26-line tailwind-merge wrapper with no
brand in it, and `type ModuleManifest` from a module-manifest contract written
for the removed dashboard. `cn` moved to `@wizeworks/silica-corrections`
(re-exported from `@sparx/ui`, so admin's six call sites were untouched) and the
four dead `manifest.ts` files were deleted. The lesson worth keeping: **trace a
transitive dependency to what it actually imports before scheduling it.**

## A3 · The rename — `@sparx/x` → `@wizeworks/x`

| ID   | Step                                                                                                                                                                                                      | Exit test                                              | State |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----- |
| A3.1 | Write `scripts/codemod-scope-rename.mjs` (package names, deps, imports, CSS `@import`/`@source`, tsconfig, Dockerfiles, workflows)                                                                        | Dry-run on one leaf package produces a reviewable diff | ⬜    |
| A3.2 | Wave 1 — leaves: `field-schema`, `*-schemas`, `events`, `modules`, `time`                                                                                                                                 | `pnpm install && pnpm typecheck` green                 | ⬜    |
| A3.3 | Wave 2 — core: `db`, `auth`, `query`, `api-core`, `api-client`, `app-kit`, `links`, `attribution`, `migration`                                                                                            | `pnpm install && pnpm typecheck && pnpm test` green    | ⬜    |
| A3.4 | Wave 3 — consumers: `email*`, `legal*`, `blueprints`, `integrations`, `cms-editor`, `silica-catalog`, `site-themes`, `social`, `builder-*`, `story-schemas`, `sitebuilder-schemas`, `marketplace-schemas` | `pnpm install && pnpm build` green                     | ⬜    |
| A3.5 | `marketplace-catalog/` (368 sites) + delete `.tmp/` scratch                                                                                                                                               | `pnpm check:*` all green                               | ⬜    |
| A3.6 | Phase gate                                                                                                                                                                                                | Only `@sparx/brand` and `@sparx/ui` remain repo-wide   | ⬜    |

## A4 · The tree move

| ID   | Step                                                                                                          | Exit test                                                      | State |
| ---- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----- |
| A4.1 | `git mv packages/ → wizeworks/packages/`, `services/ → wizeworks/services/`; `brand`+`ui` → `sparx/packages/` | `pnpm install` resolves                                        | ⬜    |
| A4.2 | `git mv apps/{web,market,workbench} → sparx/apps/`; `apps/{admin,site} → wizeworks/apps/`                     | `pnpm install` resolves                                        | ⬜    |
| A4.3 | `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.js`, `.prettierignore`                                    | `pnpm lint && pnpm typecheck` green                            | ⬜    |
| A4.4 | `Dockerfile.base` paths + `--filter` args                                                                     | Base image builds                                              | ⬜    |
| A4.5 | **Replace the 34 hand-enumerated `COPY` lines** in the piggles console Dockerfile with a glob                 | `docker build -f piggles/apps/workbench/Dockerfile .` succeeds | ⬜    |
| A4.6 | `release.yml` — path filters (~805, ~1224), image matrix, `azure-bootstrap.sql` path                          | A no-op push to `main` deploys nothing; a real one deploys     | ⬜    |
| A4.7 | Every `scripts/check-*.mjs` path assumption                                                                   | All structural checks green                                    | ⬜    |
| A4.8 | Activate A0 rule 1 (`wizeworks/` may not import `sparx/` or `piggles/`)                                       | `pnpm check:boundaries` green with rule 1 live                 | ⬜    |

## A5 · Prove it

| ID   | Step                                                                                                                                  | Exit test                                                       | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----- |
| A5.1 | `scripts/check-deletability.mjs` — worktree, `rm -rf sparx/`, install, typecheck, build                                               | Runs locally and passes                                         | ⬜    |
| A5.2 | Add the container build to it                                                                                                         | `piggles-console` image builds with `sparx/` deleted            | ⬜    |
| A5.3 | CI job on `main`                                                                                                                      | Green on `main`; red if an `@sparx/*` dep returns to `piggles/` | ⬜    |
| A5.4 | Correct piggles/CLAUDE.md — delete _"What is ALLOWED, deliberately: `@sparx/_` package imports"\* and the paragraph under "The guard" | No binding file still grants the allowance                      | ⬜    |

---

# Track B — finish the console

Independent of Track A except where marked ⛔.

## B1 · Broken today

| ID  | Step | Exit test | State |
| --- | ---- | --------- | ----- |

All four callbacks are thin routes over ONE shared
`components/oauth-popup-relay.tsx`, rather than four copies of a
security-relevant `postMessage` — four places to get `targetOrigin` wrong is four
too many. The wire discriminators were renamed on both sides
(`sparx-social` → `piggles-social`, and the same for gsc / accounting / stripe).

| ID   | Step                                                                                                   | Exit test                                                              | State |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----- |
| B1.1 | `app/social/callback/page.tsx`                                                                         | Connect a social account end to end in the Piggles console             | ✅    |
| B1.2 | `app/seo/search-console/callback/page.tsx`                                                             | Connect Search Console end to end                                      | ✅    |
| B1.3 | `app/finance/accounting/callback/page.tsx` — forwards unnamed params so QuickBooks' `realmId` survives | Connect an accounting provider end to end                              | ✅    |
| B1.4 | `app/onboarding/stripe-callback/page.tsx` — `done`-only, since Stripe's hosted flow has no code        | Stripe Connect popup returns and the pane advances                     | ✅    |
| B1.5 | `app/error.tsx`                                                                                        | A thrown route segment shows the recover screen, not Next's white page | ✅    |
| B1.6 | `app/global-error.tsx` — Piggles' own palette inline, the one sanctioned hex exception                 | A layout-level throw shows a Piggles page                              | ✅    |

## B2 · Absent capabilities

**Correction to the plan: all three of these belong in `piggles/apps/account`,
not the console.** The plan put them in `apps/workbench` because that is where
sparx has them — and sparx can, because its workbench mounts Better Auth. The
Piggles console mounts none, has no `/sign-in`, and never will. Discovery
metadata served from there would have advertised
`https://mypiggles.com/api/auth/mcp/authorize`, and every advertised endpoint
would have been a 404. `lib/mcp-oauth-metadata.ts` moved to the account app with
its dev fallback corrected from port 3011 to 3021.

| ID   | Step                                                                                                                  | Exit test                                                             | State |
| ---- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| B2.1 | MCP OAuth metadata — both `.well-known` routes, in the **account** app                                                | Both routes return the documents `lib/mcp-oauth-metadata.ts` builds   | ✅    |
| B2.2 | `/oauth/consent` page + form + submit route, in the **account** app                                                   | An MCP client completes a connect against a Piggles tenant            | ✅    |
| B2.3 | `/accept-invite` page + client + actions, in the **account** app. Needed a second platform primitive — see note below | An invited teammate lands on `getpiggles.com/accept-invite` and joins | ✅    |
| B2.4 | Capacity notices — **re-scoped, see below**                                                                           | —                                                                     | ⬜    |

**B2.3 needed `accountOrigin(brand)`, not just `appOrigin(brand)`.** An invitee
is not signed in yet, so the page must offer sign-in AND sign-up — which means it
lives wherever the brand's auth lives. For sparx that is the same host as the
console; for Piggles it is a different registrable domain. `appOrigin` answers
"where you work", `accountOrigin` answers "where you prove who you are", and code
that assumes those are one place breaks for exactly one brand. Both the api-rest
route and `@sparx/auth`'s own invitation email now use it.

**B2.4 was two things wearing one id, and only one of them was a migration
item.** The orphaned `lib/billing/*` was sparx's trial-banner ladder; Piggles had
already reimplemented that decision differently in the rail's account-state card,
so it is superseded and deleted (B3.2). What remains — warning somebody they are
near a storage / contacts / email / seats ceiling — is **new platform work, not a
port**: the `Bill` API carries no meters, so there is nothing to render. It stays
open, and it is deliberately not ticked, because RULE #2 says meter from day one
and nothing here meters yet.

## B3 · Decisions on dead code

Each needs a recorded outcome. ❌ (delete) is a legitimate answer.

| ID   | Step                                                                                                                                                                                                                                                               | Exit test                                | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ----- |
| B3.1 | Module tour offers — **DELETED** with the rest of `lib/tour`. No Piggles equivalent exists; that is recorded rather than quietly lost                                                                                                                              | Files and `driver.js` gone               | ✅    |
| B3.2 | `lib/billing/*` — **DELETED.** Superseded by the rail's own account-state card, which is explicitly written as Piggles' different answer to the same question                                                                                                      | No orphaned module                       | ✅    |
| B3.3 | `components/feedback/button.tsx` — **MOUNTED**, replacing the topbar's hand-rolled copy. Not a tidy-up: the copy could not show the unread dot, so a customer who wrote in and got a reply had no way to find out                                                  | One help control, and it carries the dot | ✅    |
| B3.4 | `surfaces/onboarding/*` — **KEPT, gate deleted.** The _reopenable_ wizard and story surfaces are registered and reachable from ⌘K, so they are live capability, not dead code. The GATE is what was dead, and it redirected to a `/sign-in` this app does not have | Gate gone; the panes still open          | ✅    |

## B4 · Chrome and polish

| ID   | Step                                                                                                                                                                                                                   | Exit test                              | State |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----- |
| B4.1 | `app/icon.svg` — the delivered Piggles mark, matching the account app. No `.ico` or `apple-icon`: Next generates what it needs from the SVG, and two more raster copies of one mark is two more things to keep in step | The console tab shows the Piggles mark | ✅    |
| B4.2 | `app/robots.ts` — blanket disallow. Not `public/robots.txt`: a route composes with the layout's `robots` metadata and cannot go stale against it                                                                       | Served, and it disallows everything    | ✅    |
| B4.3 | Real-time presence — decision below                                                                                                                                                                                    | A yes/no is written down here          | ⬜    |

## B5 · Open, and named so it is not carried silently

| ID   | Step                                                                                                                                                                                                     | Exit test                                                                  | State |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| B5.1 | The platform email fallback PALETTE. A tenant with no branding still gets sparx's colours; only the NAME was fixed (A2.4). Needs a decision: brand-neutral chrome, or per-brand values in `brand-core`   | An unbranded Piggles tenant's receipt looks like neither brand by accident | ⬜    |
| B5.2 | Confirm `PIGGLES_SUPPORT_EMAIL`. Set to `support@meetpiggles.com` in the configmaps with a CONFIRM-BEFORE-USE comment. Unset is safe (the reply-to is omitted); a wrong value bounces a customer's reply | The address accepts mail, or the line is deleted                           | ⬜    |

**B4.3, stated so it is not carried silently.** Neither console has presence, and
neither ever did — no SSE, no WebSocket, no "who is looking at this". socket.io
ships in both but serves only the builder's live session and chat. So this is not
something the fork lost and it is not a migration item; it is a platform feature
nobody has built. It stays open and unticked until somebody decides they want it,
because the alternative — closing it because it was never promised — is how a gap
becomes invisible.
